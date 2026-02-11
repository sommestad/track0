import { ensureSchema, getIssue, getThreadMessages } from './db';
import { formatIssueDetail } from './format';
import { runTellAgent } from './tell-agent';
import { runAskAgent } from './ask-agent';

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function safeExecute(
  error_prefix: string,
  fn: () => Promise<string>,
): Promise<string> {
  try {
    return await fn();
  } catch (error) {
    console.error(error);
    return `${error_prefix}: ${formatErrorMessage(error)}`;
  }
}

export async function handleTell(
  message: string,
  issue_id?: string,
): Promise<string> {
  return safeExecute('Error processing message', () =>
    runTellAgent(message, issue_id),
  );
}

export async function handleAsk(question: string): Promise<string> {
  return safeExecute('Error answering question', () => runAskAgent(question));
}

export async function handleGet(id: string): Promise<string> {
  return safeExecute('Error retrieving issue', async () => {
    await ensureSchema();

    const issue = await getIssue(id);
    if (!issue) {
      return `Issue not found: ${id}`;
    }

    const messages = await getThreadMessages(id);

    return formatIssueDetail(issue, messages);
  });
}
