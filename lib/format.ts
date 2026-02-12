import {
  Issue,
  IssueFields,
  ThreadMessage,
  ThreadStats,
  QueryIssueResult,
} from './types';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 2592000;
const YEAR = 31536000;

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < MINUTE) return 'just now';
  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return `${m}m ago`;
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return `${h}h ago`;
  }
  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return `${d}d ago`;
  }
  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return `${w}w ago`;
  }
  if (seconds < YEAR) {
    const mo = Math.floor(seconds / MONTH);
    return `${mo}mo ago`;
  }
  const y = Math.floor(seconds / YEAR);
  return `${y}y ago`;
}

export function ageOpacity(date: string | Date): number {
  const hours = (Date.now() - new Date(date).getTime()) / 3600000;
  if (hours < 1) return 0.4;
  if (hours < 24) return 0.5;
  if (hours < 168) return 0.6;
  if (hours < 720) return 0.7;
  return 0.85;
}

export function computeThreadStats(messages: ThreadMessage[]): ThreadStats {
  return {
    message_count: messages.length,
    total_chars: messages.reduce((sum, m) => sum + m.content.length, 0),
  };
}

export function formatCharCount(chars: number): string {
  if (chars < 1000) return `~${chars} chars`;
  if (chars < 10000) return `~${(chars / 1000).toFixed(1)}k chars`;
  return `~${Math.round(chars / 1000)}k chars`;
}

export function formatThreadStats(stats: ThreadStats): string {
  const chars = formatCharCount(stats.total_chars);
  const base = `[thread: ${stats.message_count} msg${stats.message_count !== 1 ? 's' : ''}, ${chars}]`;

  if (stats.message_count < 2 && stats.total_chars < 200) {
    return `${base.slice(0, -1)} — context is thin, consider providing more detail]`;
  }
  return base;
}

export function formatFindResults(
  results: (Issue & { similarity: number })[],
): string {
  return results
    .map(
      (r) =>
        `${r.id} (${(r.similarity * 100).toFixed(0)}%) | P${r.priority} ${r.type} | ${r.status} | ${r.title}\n  ${r.summary || 'No summary yet.'}`,
    )
    .join('\n\n');
}

export function formatIssueConfirmation(
  issue: Issue,
  action: 'Created' | 'Updated',
  stats: ThreadStats,
): string {
  const labels = issue.labels.length > 0 ? issue.labels.join(', ') : 'none';

  return [
    `${action} ${issue.id}: "${issue.title}"`,
    `P${issue.priority} ${issue.type} | ${issue.status} | ${labels}`,
    issue.summary || 'No summary yet.',
    formatThreadStats(stats),
  ].join('\n');
}

function formatDate(date: string | Date): string {
  return new Date(date).toISOString();
}

export function formatIssueDetail(
  issue: Issue,
  messages: ThreadMessage[],
): string {
  const labels = issue.labels.length > 0 ? issue.labels.join(', ') : 'none';
  const stats = computeThreadStats(messages);

  const header = [
    `${issue.id}: "${issue.title}"`,
    `P${issue.priority} ${issue.type} | ${issue.status} | ${labels}`,
    `Created ${formatDate(issue.created_at)} | Updated ${formatDate(issue.updated_at)}`,
    ...(issue.last_message_by
      ? [`Last message by: ${issue.last_message_by}`]
      : []),
    '',
    issue.summary || 'No summary yet.',
  ].join('\n');

  if (messages.length === 0) {
    return header;
  }

  const thread = messages
    .map((m) => {
      const ts = new Date(m.timestamp).toISOString();
      return `[${ts} ${m.role}] ${m.content}`;
    })
    .join('\n\n');

  const chars = formatCharCount(stats.total_chars);
  return `${header}\n\nTHREAD (${stats.message_count} msg${stats.message_count !== 1 ? 's' : ''}, ${chars}):\n${thread}`;
}

export function formatLowPriorityRejection(fields: IssueFields): string {
  return [
    `Not tracked (P${fields.priority} — below threshold): "${fields.title}"`,
    `Evaluated as: ${fields.type} | ${fields.summary}`,
    '',
    'To track this, provide more context about its impact or urgency.',
  ].join('\n');
}

export function issueSummaryPayload(issue: Issue) {
  return {
    id: issue.id,
    title: issue.title,
    type: issue.type,
    status: issue.status,
    priority: issue.priority,
    summary: issue.summary,
    last_message_by: issue.last_message_by,
  };
}

export function searchResultsPayload(
  results: (Issue & { similarity: number })[],
) {
  return results.map((r) => ({
    ...issueSummaryPayload(r),
    similarity: Math.round(r.similarity * 100),
  }));
}

export function activeIssuesPayload(issues: Issue[]) {
  return issues.map((i) => ({
    ...issueSummaryPayload(i),
    updated_at: i.updated_at,
  }));
}

export function formatIssueLine(issue: Issue): string {
  return `${issue.id} | P${issue.priority} ${issue.type} | ${issue.status} | ${issue.title}\n  ${issue.summary || 'No summary yet.'}`;
}

export function formatIssueList(issues: Issue[]): string {
  if (issues.length === 0) {
    return 'No issues found.';
  }

  return issues.map(formatIssueLine).join('\n\n');
}

export function queryResultsPayload(results: QueryIssueResult[]) {
  return {
    count: results.length,
    issues: results.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      status: r.status,
      priority: r.priority,
      labels: r.labels,
      summary: r.summary,
      last_message_by: r.last_message_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      thread: { message_count: r.message_count, total_chars: r.total_chars },
      last_message: r.last_message_role
        ? {
            role: r.last_message_role,
            content: r.last_message_content,
            timestamp: r.last_message_timestamp,
          }
        : null,
      ...(r.similarity !== null
        ? { similarity: Math.round(r.similarity * 100) }
        : {}),
    })),
  };
}
