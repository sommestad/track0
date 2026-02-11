import { generateText, tool, stepCountIs } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import {
  ensureSchema,
  generateIssueId,
  createIssue,
  getIssue,
  updateIssueFields,
  updateIssueEmbedding,
  addThreadMessage,
  getThreadMessages,
  vectorSearch,
} from './db';
import { extractFields, generateEmbedding } from './ai';
import { issueSummaryPayload, searchResultsPayload } from './format';
import { ThreadMessage } from './types';

const MAX_TRACKABLE_PRIORITY = 4;
const THREAD_CONTEXT_LIMIT = 20;
const SEARCH_LIMIT = 5;
const MAX_AGENT_STEPS = 5;

const TELL_SYSTEM_PROMPT = `<role>
You are an issue tracker orchestrator. You manage a work-item database by searching, creating, and updating issues.
</role>

<task>
Process the user's message and take exactly one action.

When the message starts with "Update issue [id]":
- Call update_issue with that issue_id and the full message content. Skip search entirely.

When no issue_id is provided:
1. Call search_issues once with a concise query derived from the message.
2. Evaluate the results for duplicates using the criteria below.
3. Call exactly one of create_issue or update_issue — never both, never neither.
</task>

<duplicate_detection>
A search result is a duplicate only when BOTH conditions are true:
- similarity >= 85 (the percentage returned in search results)
- The existing issue describes the same unit of work, not merely a related topic

How to decide "same unit of work":
- Compare the title and summary of the candidate against the user's message.
- Two issues about the same system or area but describing different changes are NOT duplicates.
  Example: "Add rate limiting to the API" vs "Fix API timeout errors" — related topic, different work.
- If the candidate issue has status "done", it is NOT a duplicate — create a new issue instead.

When similarity is 70-84: likely related but not a duplicate. Create a new issue.
When similarity is below 70: not relevant. Create a new issue.
When multiple candidates are >= 85: pick the one whose title and summary most closely match the user's intent.

If uncertain whether a candidate is a true duplicate, create a new issue.
</duplicate_detection>

<tool_usage>
- search_issues: Call exactly once. Do not retry with rephrased queries.
- get_issue: Only if you need to inspect a borderline duplicate's full thread before deciding. Usually unnecessary.
- create_issue: Pass the user's original message verbatim — do not rephrase or summarize.
- update_issue: Pass the user's original message verbatim.
</tool_usage>

<response_format>
After the tool returns, respond with a single line:
[created|updated] [issue_id] — "[title]" (P[priority], [status])
</response_format>`;

function createVirtualMessage(content: string): ThreadMessage {
  return {
    id: 0,
    issue_id: '',
    timestamp: new Date().toISOString(),
    role: 'assistant',
    content,
  };
}

export async function runTellAgent(
  message: string,
  issue_id?: string,
): Promise<string> {
  await ensureSchema();

  const user_prompt = issue_id
    ? `Update issue ${issue_id} with: ${message}`
    : message;

  const result = await generateText({
    model: gateway('anthropic/claude-sonnet-4.5'),
    system: TELL_SYSTEM_PROMPT,
    prompt: user_prompt,
    tools: {
      search_issues: tool({
        description:
          'Search for existing issues by semantic similarity. Returns id, title, type, status, priority, summary, and similarity (0-100 percentage) for each result.',
        inputSchema: z.object({
          query: z
            .string()
            .describe('Concise search query derived from the message'),
        }),
        execute: async ({ query }) => {
          const embedding = await generateEmbedding(query);
          if (!embedding) return [];
          const results = await vectorSearch(embedding, SEARCH_LIMIT);
          return searchResultsPayload(results);
        },
      }),

      get_issue: tool({
        description:
          'Get full details and recent thread messages for a specific issue',
        inputSchema: z.object({
          id: z.string().describe('Issue ID to retrieve'),
        }),
        execute: async ({ id }) => {
          const issue = await getIssue(id);
          if (!issue) return { error: `Issue not found: ${id}` };
          const recent_messages = await getThreadMessages(
            id,
            THREAD_CONTEXT_LIMIT,
          );
          return { issue, recent_messages };
        },
      }),

      create_issue: tool({
        description:
          'Create a new issue. Pass the original user message verbatim. Returns the created issue fields, or {rejected: true} if priority is too low to track.',
        inputSchema: z.object({
          message: z
            .string()
            .describe('The original message describing the work'),
        }),
        execute: async ({ message: msg }) => {
          const virtual_message = createVirtualMessage(msg);
          const fields = await extractFields([virtual_message]);
          if (!fields) return { error: 'Could not extract issue details' };

          if (fields.priority > MAX_TRACKABLE_PRIORITY) {
            return {
              rejected: true,
              reason: `P${fields.priority} — below tracking threshold`,
              title: fields.title,
              type: fields.type,
              summary: fields.summary,
            };
          }

          const new_id = generateIssueId();
          await createIssue(new_id);
          await addThreadMessage(new_id, 'assistant', msg);
          await updateIssueFields(new_id, fields);

          const embedding = await generateEmbedding(fields.summary);
          if (embedding) {
            await updateIssueEmbedding(new_id, embedding);
          }

          return {
            id: new_id,
            title: fields.title,
            type: fields.type,
            status: fields.status,
            priority: fields.priority,
            labels: fields.labels,
            summary: fields.summary,
          };
        },
      }),

      update_issue: tool({
        description:
          'Add a message to an existing issue thread and re-extract its fields from the full conversation history.',
        inputSchema: z.object({
          issue_id: z.string().describe('The issue ID to update'),
          message: z
            .string()
            .describe('The message to add to the issue thread'),
        }),
        execute: async ({ issue_id: id, message: msg }) => {
          const existing = await getIssue(id);
          if (!existing) return { error: `Issue not found: ${id}` };

          await addThreadMessage(id, 'assistant', msg);

          const messages = await getThreadMessages(id, THREAD_CONTEXT_LIMIT);
          const fields = await extractFields(messages, existing.summary);

          if (fields) {
            await updateIssueFields(id, fields);
            const embedding = await generateEmbedding(fields.summary);
            if (embedding) {
              await updateIssueEmbedding(id, embedding);
            }
          }

          const updated = await getIssue(id);
          if (!updated) return { error: `Issue not found after update: ${id}` };

          return {
            ...issueSummaryPayload(updated),
            labels: updated.labels,
          };
        },
      }),
    },
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  return result.text;
}
