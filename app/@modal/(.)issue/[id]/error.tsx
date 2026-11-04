'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted-foreground mb-4">
        Could not load this issue.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
