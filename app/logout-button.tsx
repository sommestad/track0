'use client';

import { Button } from '@/components/ui/button';

export function LogoutButton(): React.ReactNode {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground hover:text-foreground dark:font-mono"
      onClick={() => {
        fetch('/api/auth', { method: 'DELETE' })
          .catch(() => {})
          .finally(() => {
            window.location.href = '/login';
          });
      }}
    >
      logout
    </Button>
  );
}
