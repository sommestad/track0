import Link from 'next/link';
import { ensureSchema, getIssuesByStatus } from '@/lib/db';
import { Issue } from '@/lib/types';
import { LogoutButton } from './logout-button';

const STATUS_ORDER = ['active', 'open', 'done'] as const;

const STATUS_COLORS: Record<string, string> = {
  active: 'text-[var(--green)]',
  open: 'text-[var(--yellow)]',
  done: 'text-[var(--muted)]',
};

const TYPE_LABELS: Record<string, string> = {
  bug: 'BUG',
  feature: 'FEAT',
  task: 'TASK',
};

function PriorityIndicator({ priority }: { priority: number }) {
  const bars = 5 - priority;
  return (
    <span className="inline-flex gap-0.5 items-end h-3" title={`P${priority}`}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i <= bars ? 'bg-foreground' : 'bg-border'}`}
          style={{ height: `${40 + i * 15}%` }}
        />
      ))}
    </span>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <Link
      href={`/issue/${issue.id}`}
      className="block border border-border rounded-md p-4 hover:border-muted transition-colors"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-muted text-xs">{issue.id}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-border">
          {TYPE_LABELS[issue.type] || issue.type}
        </span>
        <PriorityIndicator priority={issue.priority} />
      </div>
      <div className="font-medium mb-2">{issue.title}</div>
      {issue.labels.length > 0 && (
        <div className="flex gap-1.5 mb-2">
          {issue.labels.map((label) => (
            <span
              key={label}
              className="text-xs text-muted px-1.5 py-0.5 rounded border border-border"
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {issue.summary && (
        <p className="text-sm text-muted line-clamp-2">{issue.summary}</p>
      )}
    </Link>
  );
}

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  await ensureSchema();
  const issues = await getIssuesByStatus();

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    issues: issues.filter((i) => i.status === status),
  })).filter((g) => g.issues.length > 0);

  const total = issues.length;
  const open_count = issues.filter(
    (i) => i.status === 'open' || i.status === 'active',
  ).length;

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-bold">track0</h1>
        <div className="flex items-baseline gap-4">
          <span className="text-sm text-muted">
            {open_count} open / {total} total
          </span>
          <LogoutButton />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center text-muted py-20">
          <p className="text-lg mb-2">No issues yet</p>
          <p className="text-sm">
            Use{' '}
            <code className="bg-border px-1.5 py-0.5 rounded">track0_tell</code>{' '}
            from Claude Code to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ status, issues }) => (
            <section key={status}>
              <h2
                className={`text-sm font-medium uppercase tracking-wider mb-3 ${STATUS_COLORS[status]}`}
              >
                {status} ({issues.length})
              </h2>
              <div className="space-y-3">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
