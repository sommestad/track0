import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Skeleton className="h-4 w-16 mb-6" />
      <div className="mb-8 space-y-3">
        <div className="flex gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-8" />
        </div>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="p-4 gap-2 rounded-md">
            <div className="flex gap-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
          </Card>
        ))}
      </div>
    </main>
  );
}
