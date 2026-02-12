'use server';

import { revalidatePath } from 'next/cache';
import { updateIssueStatus } from '@/lib/db';
import { handleTell } from '@/lib/tools';

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

export async function tellIssue(
  issueId: string,
  message: string,
): Promise<string> {
  const result = await handleTell(message, issueId, 'user');
  revalidatePath(`/issue/${issueId}`);
  revalidatePath('/');
  return result;
}
