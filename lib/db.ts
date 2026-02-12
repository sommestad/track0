import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { Issue, ThreadMessage, ThreadStats } from './types';

let _sql: NeonQueryFunction<false, false>;

function sql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

function parseRow(row: Record<string, unknown>): Issue {
  let labels: string[];
  try {
    labels =
      typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels;
  } catch {
    labels = [];
  }
  return {
    ...row,
    labels,
    last_message_by: (row.last_message_by as Issue['last_message_by']) ?? null,
  } as Issue;
}

let schema_initialized = false;

export async function ensureSchema() {
  if (schema_initialized) return;

  await sql()`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql()`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'task',
      status TEXT NOT NULL DEFAULT 'open',
      priority INTEGER DEFAULT 3,
      labels JSONB DEFAULT '[]',
      summary TEXT DEFAULT '',
      embedding vector(1536),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql()`
    CREATE TABLE IF NOT EXISTS thread_messages (
      id SERIAL PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
      role TEXT NOT NULL,
      content TEXT NOT NULL
    )
  `;

  await sql()`CREATE INDEX IF NOT EXISTS idx_status ON issues(status)`;
  await sql()`CREATE INDEX IF NOT EXISTS idx_thread_issue ON thread_messages(issue_id)`;
  await sql()`
    CREATE INDEX IF NOT EXISTS idx_embedding ON issues
      USING hnsw (embedding vector_cosine_ops)
  `;

  await sql()`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'thread_messages_issue_id_fkey'
          AND table_name = 'thread_messages'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints
        WHERE constraint_name = 'thread_messages_issue_id_fkey'
          AND delete_rule = 'CASCADE'
      ) THEN
        ALTER TABLE thread_messages
          DROP CONSTRAINT thread_messages_issue_id_fkey,
          ADD CONSTRAINT thread_messages_issue_id_fkey
            FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE;
      END IF;
    END $$
  `;

  schema_initialized = true;
}

export function generateIssueId(): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'wi_';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function createIssue(id: string): Promise<void> {
  await sql()`
    INSERT INTO issues (id, title, type, status, priority, labels, summary)
    VALUES (${id}, 'New issue', 'task', 'open', 3, '[]'::jsonb, '')
  `;
}

export async function getIssue(id: string): Promise<Issue | null> {
  const rows = await sql()`SELECT * FROM issues WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return parseRow(rows[0]);
}

export async function updateIssueFields(
  id: string,
  fields: {
    title: string;
    type: string;
    status: string;
    priority: number;
    labels: string[];
    summary: string;
  },
): Promise<void> {
  await sql()`
    UPDATE issues
    SET title = ${fields.title},
        type = ${fields.type},
        status = ${fields.status},
        priority = ${fields.priority},
        labels = ${JSON.stringify(fields.labels)}::jsonb,
        summary = ${fields.summary},
        updated_at = now()
    WHERE id = ${id}
  `;
}

export async function updateIssueStatus(
  id: string,
  status: string,
): Promise<void> {
  await sql()`
    UPDATE issues SET status = ${status}, updated_at = now() WHERE id = ${id}
  `;
}

export async function updateIssueEmbedding(
  id: string,
  embedding: number[],
): Promise<void> {
  const vectorString = `[${embedding.join(',')}]`;
  await sql()`
    UPDATE issues
    SET embedding = ${vectorString}::vector
    WHERE id = ${id}
  `;
}

export async function addThreadMessage(
  issue_id: string,
  role: string,
  content: string,
): Promise<void> {
  await sql()`
    INSERT INTO thread_messages (issue_id, role, content)
    VALUES (${issue_id}, ${role}, ${content})
  `;
}

export async function getThreadMessages(
  issue_id: string,
  limit?: number,
): Promise<ThreadMessage[]> {
  if (limit) {
    const rows = await sql()`
      SELECT * FROM thread_messages
      WHERE issue_id = ${issue_id}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
    return rows.reverse() as ThreadMessage[];
  }
  const rows = await sql()`
    SELECT * FROM thread_messages
    WHERE issue_id = ${issue_id}
    ORDER BY timestamp ASC
  `;
  return rows as ThreadMessage[];
}

export async function getIssuesByStatus(): Promise<Issue[]> {
  const rows = await sql()`
    SELECT id, title, type, status, priority, labels, summary, created_at, updated_at,
           (SELECT role FROM thread_messages WHERE issue_id = issues.id ORDER BY timestamp DESC LIMIT 1) AS last_message_by
    FROM issues
    ORDER BY
      CASE status
        WHEN 'active' THEN 0
        WHEN 'open' THEN 1
        WHEN 'done' THEN 2
      END,
      priority ASC
  `;
  return rows.map(parseRow);
}

export async function getNonDoneIssues(): Promise<Issue[]> {
  const rows = await sql()`
    SELECT id, title, type, status, priority, labels, summary, created_at, updated_at,
           (SELECT role FROM thread_messages WHERE issue_id = issues.id ORDER BY timestamp DESC LIMIT 1) AS last_message_by
    FROM issues
    WHERE status != 'done'
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'open' THEN 1 END,
      CASE WHEN status = 'open' THEN updated_at END DESC,
      CASE WHEN status = 'active' THEN updated_at END DESC
  `;
  return rows.map(parseRow);
}

export async function vectorSearch(
  embedding: number[],
  limit: number = 10,
): Promise<(Issue & { similarity: number })[]> {
  const vectorString = `[${embedding.join(',')}]`;
  const rows = await sql()`
    SELECT id, title, type, status, priority, labels, summary, created_at, updated_at,
           1 - (embedding <=> ${vectorString}::vector) as similarity,
           (SELECT role FROM thread_messages WHERE issue_id = issues.id ORDER BY timestamp DESC LIMIT 1) AS last_message_by
    FROM issues
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `;
  return rows.map((row) => parseRow(row) as Issue & { similarity: number });
}

export async function getThreadStats(issue_id: string): Promise<ThreadStats> {
  const rows = await sql()`
    SELECT COUNT(*)::int AS message_count,
           COALESCE(SUM(LENGTH(content)), 0)::int AS total_chars
    FROM thread_messages
    WHERE issue_id = ${issue_id}
  `;
  return {
    message_count: rows[0].message_count,
    total_chars: rows[0].total_chars,
  };
}

export async function getThreadStatsBatch(
  issue_ids: string[],
): Promise<Map<string, ThreadStats>> {
  if (issue_ids.length === 0) return new Map();

  const rows = await sql()`
    SELECT issue_id,
           COUNT(*)::int AS message_count,
           COALESCE(SUM(LENGTH(content)), 0)::int AS total_chars
    FROM thread_messages
    WHERE issue_id = ANY(${issue_ids})
    GROUP BY issue_id
  `;

  const map = new Map<string, ThreadStats>();
  for (const row of rows) {
    map.set(row.issue_id as string, {
      message_count: row.message_count as number,
      total_chars: row.total_chars as number,
    });
  }
  return map;
}
