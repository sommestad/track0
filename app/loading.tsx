import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-baseline justify-between mb-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-4">
        {[1, 2].map((section) => (
          <div key={section} className="space-y-1">
            <div className="border-l-2 border-muted pl-2 mb-2">
              <Skeleton className="h-3 w-20" />
            </div>
            {[1, 2].map((card) => (
              <div
                key={card}
                className="border-l-2 border-muted pl-2 pr-3 py-2"
              >
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2 mt-1" />
                <Skeleton className="h-2.5 w-12 mt-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
