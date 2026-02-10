import { Issue, ThreadMessage } from './types';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 2592000;
const YEAR = 31536000;

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000,
  );
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

export function formatIssueConfirmation(
  issue: Issue,
  action: 'Created' | 'Updated',
): string {
  const labels = issue.labels.length > 0 ? issue.labels.join(', ') : 'none';

  return [
    `${action} ${issue.id}: "${issue.title}"`,
    `TYPE: ${issue.type} | STATUS: ${issue.status} | PRIORITY: ${issue.priority}`,
    `LABELS: ${labels}`,
    '',
    `SUMMARY: ${issue.summary || 'No summary yet.'}`,
  ].join('\n');
}

export function formatIssueDetail(
  issue: Issue,
  messages: ThreadMessage[],
): string {
  const labels = issue.labels.length > 0 ? issue.labels.join(', ') : 'none';

  const header = [
    `${issue.id} | ${issue.title}`,
    `STATUS: ${issue.status} | TYPE: ${issue.type} | PRIORITY: ${issue.priority}`,
    `LABELS: ${labels}`,
    '',
    `SUMMARY: ${issue.summary || 'No summary yet.'}`,
  ].join('\n');

  if (messages.length === 0) {
    return header;
  }

  const thread = messages
    .map((m) => {
      const ts = new Date(m.timestamp)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');
      return `[${ts} ${m.role}] ${m.content}`;
    })
    .join('\n\n');

  return `${header}\n\nTHREAD:\n${thread}`;
}

export function formatIssueList(issues: Issue[]): string {
  if (issues.length === 0) {
    return 'No issues found.';
  }

  return issues
    .map(
      (i) =>
        `${i.id} | P${i.priority} ${i.type} | ${i.status} | ${i.title}\n  ${i.summary || 'No summary yet.'}`,
    )
    .join('\n\n');
}
