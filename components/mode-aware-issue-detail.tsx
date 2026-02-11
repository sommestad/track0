'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { StatusSelector } from '@/components/status-selector';
import { STATUS_COLORS, ROLE_COLORS } from '@/lib/constants';
import { formatCharCount, computeThreadStats } from '@/lib/format';
import type { Issue, ThreadMessage } from '@/lib/types';

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

interface ModeAwareIssueDetailProps {
  issue: Issue;
  messages: ThreadMessage[];
}

function formatDate(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

function LlmIssueDetail({
  issue,
  messages,
}: ModeAwareIssueDetailProps): React.ReactNode {
  const labels = issue.labels.length > 0 ? issue.labels.join(', ') : 'none';
  const stats = computeThreadStats(messages);

  return (
    <div className="text-xs font-mono space-y-3">
      <div>
        <div>
          <span className="text-muted-foreground">{issue.id}:</span>{' '}
          <span className="font-bold text-foreground">
            &quot;{issue.title}&quot;
          </span>
        </div>
        <div>
          <span className="text-[var(--yellow)]">
            P{issue.priority} {issue.type}
          </span>
          <span className="text-muted-foreground"> | </span>
          <span className="text-[var(--green)]">{issue.status}</span>
          <span className="text-muted-foreground"> | </span>
          <span className="text-muted-foreground">{labels}</span>
        </div>
        <div className="text-muted-foreground">
          Created {formatDate(issue.created_at)} | Updated{' '}
          {formatDate(issue.updated_at)}
        </div>
      </div>

      <div className="text-foreground">
        {issue.summary || 'No summary yet.'}
      </div>

      {messages.length > 0 && (
        <div>
          <div className="text-[var(--blue)] font-bold mb-2">
            THREAD ({stats.message_count} msg
            {stats.message_count !== 1 ? 's' : ''},{' '}
            {formatCharCount(stats.total_chars)}):
          </div>
          <div className="space-y-3">
            {messages.map((m) => {
              const ts = new Date(m.timestamp)
                .toISOString()
                .slice(0, 16)
                .replace('T', ' ');
              return (
                <div key={m.id}>
                  <span className="text-muted-foreground">[{ts}</span>{' '}
                  <span className="text-[var(--green)] font-bold">
                    {m.role}
                  </span>
                  <span className="text-muted-foreground">]</span>{' '}
                  <span className="text-foreground whitespace-pre-wrap">
                    {m.content}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ModeAwareIssueDetail({
  issue,
  messages,
}: ModeAwareIssueDetailProps): React.ReactNode {
  const { theme } = useTheme();
  const mounted = useMounted();

  const isLlm = !mounted || theme === 'llm';

  if (isLlm) {
    return <LlmIssueDetail issue={issue} messages={messages} />;
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[0.625rem] text-muted-foreground">
            {issue.id}
          </span>
          <Badge variant="secondary" className="uppercase">
            {issue.type}
          </Badge>
          <Badge variant="secondary">P{issue.priority}</Badge>
          <div className="ml-auto">
            <StatusSelector issueId={issue.id} currentStatus={issue.status} />
          </div>
        </div>

        <h1 className="text-base font-bold mb-2">{issue.title}</h1>

        {issue.labels.length > 0 && (
          <div className="flex gap-1 mb-3">
            {issue.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        )}

        {issue.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {issue.summary}
          </p>
        )}
      </div>

      {messages.length > 0 && (
        <section>
          <div className="border-l-2 border-primary pl-2 mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Thread ({messages.length})
            </h2>
          </div>
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-md border border-border bg-card/30 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[0.625rem] font-medium ${ROLE_COLORS[msg.role]}`}
                  >
                    {msg.role}
                  </span>
                  <span className="text-[0.625rem] text-muted-foreground">
                    {new Date(msg.timestamp)
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' ')}
                  </span>
                </div>
                <p className="text-xs whitespace-pre-wrap mt-1">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
