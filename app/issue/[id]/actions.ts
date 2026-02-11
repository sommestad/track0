'use server';

import { revalidatePath } from 'next/cache';
import { updateIssueStatus } from '@/lib/db';

const VALID_STATUSES = new Set(['open', 'active', 'done']);

export async function changeStatus(
  issueId: string,
  status: string,
): Promise<void> {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  await updateIssueStatus(issueId, status);
  revalidatePath(`/issue/${issueId}`);
}
