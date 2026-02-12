import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import {
  Issue,
  ThreadMessage,
  ThreadStats,
  QueryIssuesFilters,
  QueryIssueResult,
} from './types';

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

const QUERY_ISSUES_LIMIT = 25;

function parseQueryIssueRow(row: Record<string, unknown>): QueryIssueResult {
  let labels: string[];
  try {
    labels =
      typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels;
  } catch {
    labels = [];
  }
  return {
    id: row.id as string,
    title: row.title as string,
    type: row.type as string,
    status: row.status as string,
    priority: row.priority as number,
    labels: labels as string[],
    summary: row.summary as string,
    last_message_by: (row.last_message_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    message_count: (row.message_count as number) ?? 0,
    total_chars: (row.total_chars as number) ?? 0,
    last_message_role: (row.last_message_role as string) ?? null,
    last_message_content: (row.last_message_content as string) ?? null,
    last_message_timestamp: (row.last_message_timestamp as string) ?? null,
    similarity: (row.similarity as number) ?? null,
  };
}

export async function queryIssues(
  filters: QueryIssuesFilters,
): Promise<QueryIssueResult[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  const hasEmbedding =
    filters.search_embedding && filters.search_embedding.length > 0;

  let similarityExpr = 'NULL';
  if (hasEmbedding) {
    const vectorString = `[${filters.search_embedding!.join(',')}]`;
    similarityExpr = `1 - (i.embedding <=> $${paramIndex}::vector)`;
    params.push(vectorString);
    paramIndex++;
    conditions.push('i.embedding IS NOT NULL');
  }

  if (filters.status !== undefined) {
    if (Array.isArray(filters.status)) {
      conditions.push(`i.status = ANY($${paramIndex})`);
      params.push(filters.status);
      paramIndex++;
    } else {
      conditions.push(`i.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }
  }

  if (filters.type !== undefined) {
    if (Array.isArray(filters.type)) {
      conditions.push(`i.type = ANY($${paramIndex})`);
      params.push(filters.type);
      paramIndex++;
    } else {
      conditions.push(`i.type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }
  }

  if (filters.priority_max !== undefined) {
    conditions.push(`i.priority <= $${paramIndex}`);
    params.push(filters.priority_max);
    paramIndex++;
  }

  if (filters.last_message_by !== undefined) {
    conditions.push(`last_msg.role = $${paramIndex}`);
    params.push(filters.last_message_by);
    paramIndex++;
  }

  if (filters.labels && filters.labels.length > 0) {
    conditions.push(`jsonb_exists_any(i.labels, $${paramIndex}::text[])`);
    params.push(filters.labels);
    paramIndex++;
  }

  if (filters.min_messages !== undefined) {
    conditions.push(`ts.message_count >= $${paramIndex}`);
    params.push(filters.min_messages);
    paramIndex++;
  }

  if (filters.max_messages !== undefined) {
    conditions.push(`ts.message_count <= $${paramIndex}`);
    params.push(filters.max_messages);
    paramIndex++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const orderClause = hasEmbedding
    ? 'ORDER BY similarity DESC NULLS LAST'
    : 'ORDER BY i.priority ASC, i.updated_at DESC';

  const limitParam = `$${paramIndex}`;
  params.push(QUERY_ISSUES_LIMIT);

  const queryString = `
    SELECT i.id, i.title, i.type, i.status, i.priority, i.labels, i.summary,
           last_msg.role AS last_message_by,
           i.created_at, i.updated_at,
           COALESCE(ts.message_count, 0) AS message_count,
           COALESCE(ts.total_chars, 0) AS total_chars,
           last_msg.role AS last_message_role,
           LEFT(last_msg.content, 500) AS last_message_content,
           last_msg.timestamp AS last_message_timestamp,
           ${similarityExpr} AS similarity
    FROM issues i
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS message_count,
             COALESCE(SUM(LENGTH(content)), 0)::int AS total_chars
      FROM thread_messages WHERE issue_id = i.id
    ) ts ON true
    LEFT JOIN LATERAL (
      SELECT role, content, timestamp
      FROM thread_messages WHERE issue_id = i.id
      ORDER BY timestamp DESC LIMIT 1
    ) last_msg ON true
    ${whereClause}
    ${orderClause}
    LIMIT ${limitParam}
  `;

  // Split query on $N placeholders to create a fake TemplateStringsArray
  // for the neon tagged template function
  const parts = queryString.split(/\$\d+/);
  const strings = Object.assign([...parts], { raw: [...parts] });
  const rows = await sql()(
    strings as unknown as TemplateStringsArray,
    ...params,
  );
  return rows.map(parseQueryIssueRow);
}
