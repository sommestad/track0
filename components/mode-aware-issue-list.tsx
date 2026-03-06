'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  useState,
  useSyncExternalStore,
  useOptimistic,
  useTransition,
  useRef,
} from 'react';
import { changeStatus } from '@/app/issue/[id]/actions';
import { cn } from '@/lib/utils';
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
  status: Issue['status'];
  issues: Issue[];
}

interface ModeAwareIssueListProps {
  grouped: GroupedIssues[];
  thread_stats: Map<string, ThreadStats>;
}

type MoveAction = {
  issueId: string;
  fromStatus: Issue['status'];
  toStatus: Issue['status'];
};

function LlmIssueLine({
  issue,
  stats,
}: {
  issue: Issue;
  stats: ThreadStats | undefined;
}): React.ReactNode {
  const updated = new Date(issue.updated_at).toISOString();
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [optimisticGrouped, moveIssue] = useOptimistic(
    grouped,
    (current, { issueId, fromStatus, toStatus }: MoveAction) =>
      current.map((group) => {
        if (group.status === fromStatus)
          return {
            ...group,
            issues: group.issues.filter((i) => i.id !== issueId),
          };
        if (group.status === toStatus) {
          const moved = current
            .find((g) => g.status === fromStatus)
            ?.issues.find((i) => i.id === issueId);
          return moved
            ? {
                ...group,
                issues: [{ ...moved, status: toStatus }, ...group.issues],
              }
            : group;
        }
        return group;
      }),
  );

  const [, startTransition] = useTransition();
  const dragRef = useRef<{
    issueId: string;
    fromStatus: Issue['status'];
  } | null>(null);
  const didDragRef = useRef(false);
  const [dragOverLane, setDragOverLane] = useState<Issue['status'] | null>(
    null,
  );

  const isLlm = !mounted || theme === 'llm';

  if (isLlm) {
    const nonEmpty = [...grouped]
      .sort(
        (a, b) =>
          LLM_STATUS_ORDER.indexOf(
            a.status as (typeof LLM_STATUS_ORDER)[number],
          ) -
          LLM_STATUS_ORDER.indexOf(
            b.status as (typeof LLM_STATUS_ORDER)[number],
          ),
      )
      .filter((g) => g.issues.length > 0 && g.status !== 'done');
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

  const LANE_LIMIT = 5;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {optimisticGrouped.map(({ status, issues }) => {
        const isExpanded = expanded.has(status);
        const visible = isExpanded ? issues : issues.slice(0, LANE_LIMIT);
        const remaining = issues.length - LANE_LIMIT;
        const laneStatus = status as Issue['status'];

        return (
          <section
            key={status}
            className={cn(
              'bg-muted/30 rounded-lg p-3 min-h-[120px] transition-colors',
              dragOverLane === laneStatus &&
                'ring-2 ring-primary/50 bg-muted/50',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverLane !== laneStatus) setDragOverLane(laneStatus);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverLane(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverLane(null);
              const drag = dragRef.current;
              if (!drag || drag.fromStatus === laneStatus) return;
              const toStatus = laneStatus;
              startTransition(async () => {
                moveIssue({
                  issueId: drag.issueId,
                  fromStatus: drag.fromStatus,
                  toStatus,
                });
                await changeStatus(drag.issueId, toStatus);
              });
            }}
          >
            <div
              className={`border-l-2 pl-2 mb-3 ${STATUS_BORDERS[laneStatus]}`}
            >
              <h2
                className={`text-[0.625rem] font-medium uppercase tracking-wider ${STATUS_COLORS[laneStatus]}`}
              >
                {status} ({issues.length})
              </h2>
            </div>
            {issues.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">No issues</p>
            ) : (
              <div className="space-y-2.5">
                {visible.map((issue) => (
                  <div
                    key={issue.id}
                    draggable
                    className="cursor-grab"
                    onDragStart={(e) => {
                      dragRef.current = {
                        issueId: issue.id,
                        fromStatus: laneStatus,
                      };
                      didDragRef.current = true;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', issue.id);
                      requestAnimationFrame(() => {
                        (e.target as HTMLElement).style.opacity = '0.4';
                      });
                    }}
                    onDragEnd={(e) => {
                      (e.target as HTMLElement).style.opacity = '';
                      dragRef.current = null;
                      setDragOverLane(null);
                      requestAnimationFrame(() => {
                        didDragRef.current = false;
                      });
                    }}
                    onClickCapture={(e) => {
                      if (didDragRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  >
                    <IssueCard issue={issue} />
                  </div>
                ))}
                {remaining > 0 && (
                  <button
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (isExpanded) next.delete(status);
                        else next.add(status);
                        return next;
                      })
                    }
                    className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? 'Show less' : `More (${remaining})`}
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
