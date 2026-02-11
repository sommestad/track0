'use client';

import { useTransition } from 'react';
import { changeStatus } from '@/app/issue/[id]/actions';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Issue } from '@/lib/types';

const STATUSES: Issue['status'][] = ['open', 'active', 'done'];

interface StatusSelectorProps {
  issueId: string;
  currentStatus: Issue['status'];
}

export function StatusSelector({
  issueId,
  currentStatus,
}: StatusSelectorProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    if (value === currentStatus) return;
    startTransition(() => changeStatus(issueId, value));
  }

  return (
    <Tabs
      value={currentStatus}
      onValueChange={handleChange}
      className={cn('gap-0 flex-row h-7', isPending && 'opacity-50 pointer-events-none')}
    >
      <TabsList className="[&]:h-auto gap-0 rounded-md p-1">
        {STATUSES.map((status) => (
          <TabsTrigger
            key={status}
            value={status}
            className={cn(
              'h-5 px-1.5 py-0 text-[0.625rem] rounded-sm uppercase',
              status === currentStatus && STATUS_COLORS[status],
            )}
          >
            {status}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
