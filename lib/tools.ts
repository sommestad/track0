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
} from './db';
import { extractFields, generateEmbedding, answerQuestion } from './ai';
import { formatIssueConfirmation, formatIssueDetail } from './format';
import { Issue } from './types';

const THREAD_CONTEXT_LIMIT = 20;

export async function handleTell(
  message: string,
  issue_id?: string,
): Promise<string> {
  try {
    await ensureSchema();

    const is_new = !issue_id;
    if (!issue_id) {
      issue_id = generateIssueId();
      await createIssue(issue_id);
    }

    const existing = await getIssue(issue_id);
    if (!existing) {
      return `Issue not found: ${issue_id}`;
    }

    await addThreadMessage(issue_id, 'claude', message);

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

    return formatIssueConfirmation(updated, is_new ? 'Created' : 'Updated');
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

    const answer = await answerQuestion(question, all_issues);
    return answer;
  } catch (error) {
    console.error('handleAsk failed:', error);
    return `Error answering question: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
