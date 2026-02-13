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

  const isArchived = currentStatus === 'archived';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        isPending && 'opacity-50 pointer-events-none',
      )}
    >
      <Tabs
        value={isArchived ? '' : currentStatus}
        onValueChange={handleChange}
        className="gap-0 flex-row h-7"
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
      <button
        onClick={() => handleChange(isArchived ? 'open' : 'archived')}
        className="h-5 px-1.5 text-[0.625rem] rounded-sm uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {isArchived ? 'unarchive' : 'archive'}
      </button>
    </div>
  );
}
