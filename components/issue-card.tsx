import Link from 'next/link';
import { PriorityIndicator } from '@/components/priority-indicator';
import { timeAgo, ageOpacity } from '@/lib/format';
import type { Issue } from '@/lib/types';

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps): React.ReactNode {
  const opacity = ageOpacity(issue.updated_at);
  const isRecent = opacity <= 0.4;

  return (
    <Link
      href={`/issue/${issue.id}`}
      className="block rounded-md bg-white px-3 py-2.5 hover:bg-white/80 transition-colors"
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
