import { IssueDetailSkeleton } from '@/components/issue-detail-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Skeleton className="h-4 w-16 mb-6" />
      <IssueDetailSkeleton />
    </main>
  );
}
