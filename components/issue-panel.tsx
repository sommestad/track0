'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select') !== null)
  );
}

/**
 * Side panel that shows an issue over the board. It stays mounted while
 * switching between issues, so only its content swaps.
 */
export function IssuePanel({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented || isEditable(e.target)) {
        return;
      }
      router.push('/');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return (
    <aside
      ref={panelRef}
      data-issue-panel
      aria-label="Issue"
      className="fixed inset-y-0 right-0 z-40 w-full md:w-(--issue-panel-width) overflow-y-auto overscroll-contain border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-200"
    >
      <div className="sticky top-0 z-10 flex justify-end bg-background px-2 pt-2">
        <button
          type="button"
          onClick={() => router.push('/')}
          aria-label="Close"
          title="Close (Esc)"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 pb-8">{children}</div>
    </aside>
  );
}
