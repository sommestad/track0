import { ensureSchema, getIssuesByStatus, getThreadStatsBatch } from '@/lib/db';
import { STATUS_ORDER } from '@/lib/constants';
import { ModeAwareIssueList } from '@/components/mode-aware-issue-list';
import { AutoRefresh } from '@/components/auto-refresh';
import { LogoutButton } from './logout-button';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  await ensureSchema();
  const issues = await getIssuesByStatus();
  const thread_stats = await getThreadStatsBatch(issues.map((i) => i.id));

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    issues: issues.filter((i) => i.status === status),
  }));

  for (const g of grouped) {
    g.issues.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  }

  const total = issues.length;
  const open_count = issues.filter(
    (i) => i.status === 'open' || i.status === 'active',
  ).length;

  return (
    <main className="max-w-6xl dark:max-w-3xl mx-auto px-4 py-6">
      <AutoRefresh />
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-base font-bold dark:font-mono">track0</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs dark:font-mono text-[var(--yellow)]">
            {open_count} open
          </span>
          <span className="text-xs text-muted-foreground">&middot;</span>
          <span className="text-xs dark:font-mono text-muted-foreground">
            {total} total
          </span>
          <ThemeToggle />
        </div>
      </div>

      {total === 0 ? (
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
        <ModeAwareIssueList grouped={grouped} thread_stats={thread_stats} />
      )}

      <footer className="mt-16 text-center">
        <LogoutButton />
      </footer>
    </main>
  );
}
