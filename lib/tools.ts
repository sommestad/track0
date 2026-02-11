import {
  ensureSchema,
  generateIssueId,
  createIssue,
  getIssue,
  updateIssueFields,
  updateIssueEmbedding,
  addThreadMessage,
  getThreadMessages,
  getNonDoneIssues,
  vectorSearch,
  getThreadStats,
  getThreadStatsBatch,
} from './db';
import { extractFields, generateEmbedding, answerQuestion } from './ai';
import {
  formatIssueConfirmation,
  formatIssueDetail,
  formatLowPriorityRejection,
  formatFindResults,
  computeThreadStats,
} from './format';
import { Issue, ThreadMessage } from './types';

const THREAD_CONTEXT_LIMIT = 20;
const MAX_TRACKABLE_PRIORITY = 4;

function createVirtualMessage(content: string): ThreadMessage {
  return {
    id: 0,
    issue_id: '',
    timestamp: new Date().toISOString(),
    role: 'assistant',
    content,
  };
}

async function handleNewIssue(message: string): Promise<string> {
  const virtual_message = createVirtualMessage(message);

  const fields = await extractFields([virtual_message]);
  if (!fields) {
    return 'Could not extract issue details. Please provide more context.';
  }

  if (fields.priority > MAX_TRACKABLE_PRIORITY) {
    return formatLowPriorityRejection(fields);
  }

  const issue_id = generateIssueId();
  await createIssue(issue_id);

  await addThreadMessage(issue_id, 'assistant', message);
  await updateIssueFields(issue_id, fields);

  const embedding = await generateEmbedding(fields.summary);
  if (embedding) {
    await updateIssueEmbedding(issue_id, embedding);
  }

  const issue = await getIssue(issue_id);
  if (!issue) {
    return 'Failed to create issue';
  }

  const stats = computeThreadStats([virtual_message]);
  return formatIssueConfirmation(issue, 'Created', stats);
}

async function handleExistingIssue(
  issue_id: string,
  message: string,
): Promise<string> {
  const existing = await getIssue(issue_id);
  if (!existing) {
    return `Issue not found: ${issue_id}`;
  }

  await addThreadMessage(issue_id, 'assistant', message);

  const messages = await getThreadMessages(issue_id, THREAD_CONTEXT_LIMIT);

  const fields = await extractFields(messages, existing.summary);

  if (fields) {
    await updateIssueFields(issue_id, fields);

    const embedding = await generateEmbedding(fields.summary);
    if (embedding) {
      await updateIssueEmbedding(issue_id, embedding);
    }
  }

  const updated = await getIssue(issue_id);
  if (!updated) {
    return `Issue not found: ${issue_id}`;
  }

  const stats = await getThreadStats(issue_id);
  return formatIssueConfirmation(updated, 'Updated', stats);
}

export async function handleTell(
  message: string,
  issue_id?: string,
): Promise<string> {
  try {
    await ensureSchema();
    if (!issue_id) return handleNewIssue(message);
    return handleExistingIssue(issue_id, message);
  } catch (error) {
    console.error('handleTell failed:', error);
    return `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function handleAsk(question: string): Promise<string> {
  try {
    await ensureSchema();

    const non_done = await getNonDoneIssues();

    const embedding = await generateEmbedding(question);
    let vector_results: Issue[] = [];
    if (embedding) {
      vector_results = await vectorSearch(embedding, 10);
    }

    const issue_map = new Map<string, Issue>();
    for (const issue of non_done) {
      issue_map.set(issue.id, issue);
    }
    for (const issue of vector_results) {
      issue_map.set(issue.id, issue);
    }

    const all_issues = Array.from(issue_map.values());

    if (all_issues.length === 0) {
      return 'No issues found.';
    }

    const stats_map = await getThreadStatsBatch(all_issues.map((i) => i.id));
    const answer = await answerQuestion(question, all_issues, stats_map);
    const matched = vector_results.length;
    const total_active = non_done.length;
    return `[${matched} issues matched, ${total_active} total active]\n${answer}`;
  } catch (error) {
    console.error('handleAsk failed:', error);
    return `Error answering question: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function handleFind(
  message: string,
  limit: number = 5,
): Promise<string> {
  try {
    await ensureSchema();

    const embedding = await generateEmbedding(message);
    if (!embedding) {
      return 'Could not generate embedding for search.';
    }

    const results = await vectorSearch(embedding, limit);
    if (results.length === 0) {
      return 'No similar issues found.';
    }

    return formatFindResults(results);
  } catch (error) {
    console.error('handleFind failed:', error);
    return `Error searching issues: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function handleGet(id: string): Promise<string> {
  try {
    await ensureSchema();

    const issue = await getIssue(id);
    if (!issue) {
      return `Issue not found: ${id}`;
    }

    const messages = await getThreadMessages(id);

    return formatIssueDetail(issue, messages);
  } catch (error) {
    console.error('handleGet failed:', error);
    return `Error retrieving issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
