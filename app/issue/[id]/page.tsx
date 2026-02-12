import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSchema, getIssue, getThreadMessages } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { ModeAwareIssueDetail } from '@/components/mode-aware-issue-detail';
import { AutoRefresh } from '@/components/auto-refresh';

export const dynamic = 'force-dynamic';

export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureSchema();

  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();

  const messages = await getThreadMessages(id);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <AutoRefresh />
      <Button
        variant="link"
        asChild
        className="p-0 mb-4 text-muted-foreground hover:text-foreground text-xs"
      >
        <Link href="/">&larr; back</Link>
      </Button>

      <ModeAwareIssueDetail issue={issue} messages={messages} />
    </main>
  );
}
