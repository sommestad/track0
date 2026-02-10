import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { Issue, ThreadMessage } from './types';

let _sql: NeonQueryFunction<false, false>;

function sql() {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
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

  schema_initialized = true;
}

export function generateIssueId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
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
  const row = rows[0];
  return {
    ...row,
    labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels,
  } as Issue;
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
    SELECT id, title, type, status, priority, labels, summary, created_at, updated_at
    FROM issues
    ORDER BY
      CASE status
        WHEN 'active' THEN 0
        WHEN 'open' THEN 1
        WHEN 'done' THEN 2
      END,
      priority ASC
  `;
  return rows.map((row) => ({
    ...row,
    labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels,
  })) as Issue[];
}

export async function getNonDoneIssues(): Promise<Issue[]> {
  const rows = await sql()`
    SELECT id, title, type, status, priority, labels, summary, created_at, updated_at
    FROM issues
    WHERE status != 'done'
    ORDER BY priority ASC
  `;
  return rows.map((row) => ({
    ...row,
    labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels,
  })) as Issue[];
}

export async function vectorSearch(
  embedding: number[],
  limit: number = 10,
): Promise<(Issue & { similarity: number })[]> {
  const vectorString = `[${embedding.join(',')}]`;
  const rows = await sql()`
    SELECT id, title, type, status, priority, labels, summary, created_at, updated_at,
           1 - (embedding <=> ${vectorString}::vector) as similarity
    FROM issues
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    ...row,
    labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels,
  })) as (Issue & { similarity: number })[];
}
