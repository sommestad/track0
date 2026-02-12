import Link from 'next/link';
import { PriorityIndicator } from '@/components/priority-indicator';
import { timeAgo, ageOpacity } from '@/lib/format';
import type { Issue } from '@/lib/types';

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps): React.ReactNode {
  const opacity = ageOpacity(issue.updated_at);

  return (
    <Link
      href={`/issue/${issue.id}`}
      className="block rounded-md border border-border bg-card/30 px-3 py-2.5 hover:bg-card transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{issue.title}</span>
        <PriorityIndicator priority={issue.priority} />
      </div>
      <p className="text-xs text-muted-foreground mt-1" style={{ opacity }}>
        {timeAgo(issue.updated_at)}
      </p>
    </Link>
  );
}
