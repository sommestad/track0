import { ensureSchema, getIssuesByStatus } from '@/lib/db';
import { STATUS_ORDER, STATUS_COLORS, STATUS_BORDERS } from '@/lib/constants';
import { IssueCard } from '@/components/issue-card';
import { LogoutButton } from './logout-button';
import { ThemeToggle } from '@/components/theme-toggle';

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
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-base font-bold">track0</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {open_count} open / {total} total
          </span>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <p className="text-sm mb-2">No issues yet</p>
          <p className="text-xs">
            Use{' '}
            <code className="bg-muted px-1 py-0.5 text-[0.625rem]">
              track0_tell
            </code>{' '}
            from Claude Code to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ status, issues }) => (
            <section key={status}>
              <div className={`border-l-2 pl-2 mb-2 ${STATUS_BORDERS[status]}`}>
                <h2
                  className={`text-[0.625rem] font-medium uppercase tracking-wider ${STATUS_COLORS[status]}`}
                >
                  {status} ({issues.length})
                </h2>
              </div>
              <div className="space-y-1">
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
