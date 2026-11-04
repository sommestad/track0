import { ensureSchema, getIssue, getThreadMessages } from '@/lib/db';
import { ModeAwareIssueDetail } from '@/components/mode-aware-issue-detail';

export const dynamic = 'force-dynamic';

// Opened from the board via soft navigation; a direct load of /issue/[id]
// renders the full page in app/issue/[id] instead.
export default async function IssuePanelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureSchema();

  const { id } = await params;
  const [issue, messages] = await Promise.all([
    getIssue(id),
    getThreadMessages(id),
  ]);

  if (!issue) {
    return (
      <p className="text-xs text-muted-foreground py-12 text-center">
        Issue {id} not found.
      </p>
    );
  }

  return <ModeAwareIssueDetail issue={issue} messages={messages} />;
}
