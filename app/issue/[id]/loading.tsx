export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="h-4 w-16 bg-border rounded animate-pulse mb-6" />
      <div className="mb-8 space-y-3">
        <div className="flex gap-3">
          <div className="h-4 w-16 bg-border rounded animate-pulse" />
          <div className="h-4 w-12 bg-border rounded animate-pulse" />
          <div className="h-4 w-8 bg-border rounded animate-pulse" />
        </div>
        <div className="h-6 w-2/3 bg-border rounded animate-pulse" />
        <div className="h-4 w-full bg-border rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-border rounded animate-pulse" />
      </div>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border border-border rounded-md p-4 space-y-2"
          >
            <div className="flex gap-3">
              <div className="h-3 w-12 bg-border rounded animate-pulse" />
              <div className="h-3 w-24 bg-border rounded animate-pulse" />
            </div>
            <div className="h-4 w-full bg-border rounded animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}
