export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <div className="h-8 w-32 bg-border rounded animate-pulse" />
        <div className="h-4 w-24 bg-border rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-border rounded-md p-4 space-y-2"
          >
            <div className="flex gap-3">
              <div className="h-4 w-16 bg-border rounded animate-pulse" />
              <div className="h-4 w-12 bg-border rounded animate-pulse" />
            </div>
            <div className="h-5 w-3/4 bg-border rounded animate-pulse" />
            <div className="h-4 w-full bg-border rounded animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}
