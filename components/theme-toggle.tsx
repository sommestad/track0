'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function ThemeToggle(): React.ReactNode {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-xs" disabled>
        <Sun className="size-3" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="text-muted-foreground hover:text-foreground"
    >
      {theme === 'dark' ? (
        <Sun className="size-3" />
      ) : (
        <Moon className="size-3" />
      )}
    </Button>
  );
}
