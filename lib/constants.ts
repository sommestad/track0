import type { Issue, ThreadMessage } from './types';

export const STATUS_ORDER = ['open', 'active', 'done'] as const;
export const LLM_STATUS_ORDER = ['active', 'open', 'done'] as const;

export const STATUS_COLORS: Record<Issue['status'], string> = {
  active: 'text-[var(--green)]',
  open: 'text-[var(--yellow)]',
  done: 'text-muted-foreground',
};

export const STATUS_BORDERS: Record<Issue['status'], string> = {
  active: 'border-[var(--green)]',
  open: 'border-[var(--yellow)]',
  done: 'border-border',
};

export const ROLE_COLORS: Record<ThreadMessage['role'], string> = {
  assistant: 'text-[var(--blue)]',
  user: 'text-[var(--green)]',
  system: 'text-muted-foreground',
};

export const TYPE_LABELS: Record<Issue['type'], string> = {
  bug: 'BUG',
  feature: 'FEAT',
  task: 'TASK',
};
