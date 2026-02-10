'use client';

import Link from 'next/link';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">
      <h1 className="text-xl font-bold mb-4">Failed to load issue</h1>
      <p className="text-sm text-muted mb-6">
        Could not load this issue. It may not exist or there was a server error.
      </p>
      <div className="flex gap-4 justify-center">
        <button
          onClick={reset}
          className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border border-border rounded-md px-4 py-2 text-sm font-medium hover:border-muted transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
