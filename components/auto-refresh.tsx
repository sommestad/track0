'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AutoRefresh({ interval = 5000 }: { interval?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }, interval);
    return () => clearInterval(id);
  }, [interval, router]);

  return null;
}
