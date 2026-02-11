import { generateText, tool, stepCountIs } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import {
  ensureSchema,
  getIssue,
  getThreadMessages,
  getNonDoneIssues,
  vectorSearch,
} from './db';
import { generateEmbedding } from './ai';
import { searchResultsPayload, activeIssuesPayload } from './format';

const SEARCH_LIMIT = 10;
const MAX_AGENT_STEPS = 5;

const ASK_SYSTEM_PROMPT = `<role>
You are an issue tracker assistant that answers questions by searching and reading tracked issues.
</role>

<task>
Answer the user's question using the available tools, then synthesize findings into a direct answer.

Choose tools based on the question:
- User asks about a specific topic or keyword: call search_issues with a concise query.
- User asks for an overview, backlog, or "what's next": call list_active_issues.
- User references a specific issue ID (e.g. wi_a3Kx): call get_issue directly with that ID.
- If search results are insufficient, call a second tool to supplement. Do not call more than 2 tools.
</task>

<guidelines>
- Reference issues by ID in parentheses, e.g. "The auth refactor (wi_a3Kx) is in progress."
- When asked about priority or "what's next": list P1-P2 issues first, prefer "open" over "active" status.
- If multiple issues match, list up to 3 most relevant, ordered by similarity then priority.
- If no issues match, say so clearly. Mention related issues only if similarity >= 50.
- Only reference issues returned by tools. Never infer or fabricate issues.
- Be direct and specific. No preambles. Just answer.
</guidelines>`;

export async function runAskAgent(question: string): Promise<string> {
  await ensureSchema();

  const result = await generateText({
    model: gateway('anthropic/claude-sonnet-4.5'),
    system: ASK_SYSTEM_PROMPT,
    prompt: question,
    tools: {
      search_issues: tool({
        description:
          'Search for issues by semantic similarity. Returns id, title, type, status, priority, summary, and similarity (0-100 percentage) for each result.',
        inputSchema: z.object({
          query: z.string().describe('Search query'),
        }),
        execute: async ({ query }) => {
          const embedding = await generateEmbedding(query);
          if (!embedding) return [];
          const results = await vectorSearch(embedding, SEARCH_LIMIT);
          return searchResultsPayload(results);
        },
      }),

      list_active_issues: tool({
        description:
          'List all non-done issues (open and active), ordered by priority',
        inputSchema: z.object({}),
        execute: async () => {
          const issues = await getNonDoneIssues();
          return activeIssuesPayload(issues);
        },
      }),

      get_issue: tool({
        description:
          'Get full details and complete thread for a specific issue',
        inputSchema: z.object({
          id: z.string().describe('Issue ID to retrieve'),
        }),
        execute: async ({ id }) => {
          const issue = await getIssue(id);
          if (!issue) return { error: `Issue not found: ${id}` };
          const messages = await getThreadMessages(id);
          return { issue, messages };
        },
      }),
    },
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  return result.text;
}
