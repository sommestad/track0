'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">
      <h1 className="text-xl font-bold mb-4">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Failed to load the dashboard. This is likely a temporary issue.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
