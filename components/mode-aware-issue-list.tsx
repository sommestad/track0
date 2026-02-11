'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { IssueCard } from '@/components/issue-card';
import {
  STATUS_COLORS,
  STATUS_BORDERS,
  LLM_STATUS_ORDER,
} from '@/lib/constants';
import type { Issue, ThreadStats } from '@/lib/types';
import { formatCharCount } from '@/lib/format';

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

interface GroupedIssues {
  status: string;
  issues: Issue[];
}

interface ModeAwareIssueListProps {
  grouped: GroupedIssues[];
  thread_stats: Map<string, ThreadStats>;
}

function LlmIssueLine({
  issue,
  stats,
}: {
  issue: Issue;
  stats: ThreadStats | undefined;
}): React.ReactNode {
  const updated = new Date(issue.updated_at).toISOString().slice(0, 10);
  const thread_info = stats
    ? `${stats.message_count} msg${stats.message_count !== 1 ? 's' : ''} ${formatCharCount(stats.total_chars)}`
    : undefined;

  return (
    <Link
      href={`/issue/${issue.id}`}
      className="block hover:bg-accent/50 px-1 -mx-1 py-1"
    >
      <span className="text-muted-foreground">{issue.id}</span>
      <span className="text-muted-foreground"> | </span>
      <span className="text-[var(--yellow)]">
        P{issue.priority} {issue.type}
      </span>
      <span className="text-muted-foreground"> | </span>
      <span className="text-[var(--green)]">{issue.status}</span>
      <span className="text-muted-foreground"> | </span>
      <span className="font-bold text-foreground">{issue.title}</span>
      <span className="text-muted-foreground"> | </span>
      <span className="text-muted-foreground">updated {updated}</span>
      {thread_info && (
        <>
          <span className="text-muted-foreground"> | </span>
          <span className="text-muted-foreground">{thread_info}</span>
        </>
      )}
      <br />
      <span className="text-muted-foreground">
        {'  '}
        {issue.summary || 'No summary yet.'}
      </span>
    </Link>
  );
}

export function ModeAwareIssueList({
  grouped,
  thread_stats,
}: ModeAwareIssueListProps): React.ReactNode {
  const { theme } = useTheme();
  const mounted = useMounted();

  const isLlm = !mounted || theme === 'llm';

  if (isLlm) {
    const nonEmpty = [...grouped]
      .sort(
        (a, b) =>
          LLM_STATUS_ORDER.indexOf(a.status) -
          LLM_STATUS_ORDER.indexOf(b.status),
      )
      .filter((g) => g.issues.length > 0);
    return (
      <div className="space-y-5 text-xs font-mono">
        {nonEmpty.map(({ status, issues }) => (
          <section key={status}>
            <div className="text-muted-foreground mb-2">
              --- {status} ({issues.length}) ---
            </div>
            <div className="space-y-2">
              {issues.map((issue) => (
                <LlmIssueLine
                  key={issue.id}
                  issue={issue}
                  stats={thread_stats.get(issue.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {grouped.map(({ status, issues }) => (
        <section
          key={status}
          className="bg-muted/30 rounded-lg p-3 min-h-[120px]"
        >
          <div
            className={`border-l-2 pl-2 mb-3 ${STATUS_BORDERS[status as Issue['status']]}`}
          >
            <h2
              className={`text-[0.625rem] font-medium uppercase tracking-wider ${STATUS_COLORS[status as Issue['status']]}`}
            >
              {status} ({issues.length})
            </h2>
          </div>
          {issues.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">No issues</p>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
