'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Terminal, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function ThemeToggle(): React.ReactNode {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current = mounted ? theme : 'llm';

  return (
    <div className="inline-flex items-center rounded-[6px] bg-muted/50 p-[3px] gap-[2px]">
      <button
        onClick={() => setTheme('llm')}
        disabled={!mounted}
        className={cn(
          'inline-flex items-center justify-center rounded-[4px] p-[6px] transition-colors',
          current === 'llm'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Terminal className="size-[14px]" />
      </button>
      <button
        onClick={() => setTheme('human')}
        disabled={!mounted}
        className={cn(
          'inline-flex items-center justify-center rounded-[4px] p-[6px] transition-colors',
          current === 'human'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Eye className="size-[14px]" />
      </button>
    </div>
  );
}
