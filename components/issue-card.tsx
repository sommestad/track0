import Link from 'next/link';
import { PriorityIndicator } from '@/components/priority-indicator';
import { timeAgo, ageOpacity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Issue } from '@/lib/types';

interface IssueCardProps {
  issue: Issue;
  selected?: boolean;
}

export function IssueCard({
  issue,
  selected = false,
}: IssueCardProps): React.ReactNode {
  const opacity = ageOpacity(issue.updated_at);
  const isRecent = opacity <= 0.4;

  return (
    <Link
      href={`/issue/${issue.id}`}
      className={cn(
        'block rounded-md bg-white px-3 py-2.5 hover:bg-white/80 transition-colors',
        selected && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{issue.title}</span>
        <PriorityIndicator priority={issue.priority} />
      </div>
      {isRecent ? (
        <p className="text-xs font-medium text-sky-500 mt-1">
          {timeAgo(issue.updated_at)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1" style={{ opacity }}>
          {timeAgo(issue.updated_at)}
        </p>
      )}
    </Link>
  );
}
