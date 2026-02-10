import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureSchema, getIssue, getThreadMessages } from '@/lib/db';

const ROLE_COLORS: Record<string, string> = {
  claude: 'text-[var(--accent)]',
  human: 'text-[var(--green)]',
  system: 'text-[var(--muted)]',
};

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
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="text-sm text-muted hover:text-foreground transition-colors mb-6 inline-block"
      >
        &larr; back
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-muted text-sm">{issue.id}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-border uppercase">
            {issue.type}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-border">
            P{issue.priority}
          </span>
          <span
            className={`text-xs font-medium uppercase ${
              issue.status === 'active'
                ? 'text-[var(--green)]'
                : issue.status === 'open'
                  ? 'text-[var(--yellow)]'
                  : 'text-[var(--muted)]'
            }`}
          >
            {issue.status}
          </span>
        </div>

        <h1 className="text-xl font-bold mb-3">{issue.title}</h1>

        {issue.labels.length > 0 && (
          <div className="flex gap-1.5 mb-4">
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
          <p className="text-sm text-muted leading-relaxed">{issue.summary}</p>
        )}
      </div>

      {messages.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-4">
            Thread ({messages.length})
          </h2>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="border border-border rounded-md p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`text-xs font-medium ${ROLE_COLORS[msg.role] || 'text-muted'}`}
                  >
                    {msg.role}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(msg.timestamp)
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' ')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
