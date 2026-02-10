import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSchema, getIssue, getThreadMessages } from '@/lib/db';
import { STATUS_COLORS, ROLE_COLORS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
      <Button
        variant="link"
        asChild
        className="p-0 mb-4 text-muted-foreground hover:text-foreground text-xs"
      >
        <Link href="/">&larr; back</Link>
      </Button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[0.625rem] text-muted-foreground">
            {issue.id}
          </span>
          <Badge variant="secondary" className="uppercase">
            {issue.type}
          </Badge>
          <Badge variant="secondary">P{issue.priority}</Badge>
          <span
            className={`text-[0.625rem] font-medium uppercase ${STATUS_COLORS[issue.status]}`}
          >
            {issue.status}
          </span>
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
                className="border-l-2 border-border bg-card/30 px-3 py-2"
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
    </main>
  );
}
