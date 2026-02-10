'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">
      <h1 className="text-xl font-bold mb-4">Failed to load issue</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Could not load this issue. It may not exist or there was a server error.
      </p>
      <div className="flex gap-4 justify-center">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
