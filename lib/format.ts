import { Issue, ThreadMessage } from './types';

export function formatIssueConfirmation(
  issue: Issue,
  action: 'Created' | 'Updated',
): string {
  const labels =
    issue.labels.length > 0 ? issue.labels.join(', ') : 'none';

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
  const labels =
    issue.labels.length > 0 ? issue.labels.join(', ') : 'none';

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
