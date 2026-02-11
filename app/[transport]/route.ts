import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { handleTell, handleAsk, handleGet, handleFind } from '@/lib/tools';

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'track0_tell',
      'Tell the tracker about work being done, decisions made, or problems found. Creates a new issue when no issue_id is provided, or appends to an existing issue thread when an issue_id is given. The tracker automatically extracts structured fields (title, type, status, priority, labels, summary) from your natural language message. Before creating a new issue, always use track0_find first to check for existing duplicates. Returns a confirmation with the issue ID and extracted fields.',
      {
        message: z
          .string()
          .min(1)
          .max(10000)
          .describe(
            'Natural language message describing work done, a decision made, a problem found, or a status update for an issue',
          ),
        issue_id: z
          .string()
          .max(20)
          .optional()
          .describe(
            'Existing issue ID to update (e.g. wi_abc123). Omit to create a new issue. Use track0_find first to check for duplicates.',
          ),
      },
      async ({ message, issue_id }) => {
        const result = await handleTell(message, issue_id);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );

    server.tool(
      'track0_ask',
      'Ask a natural language question about tracked issues and get an AI-generated answer grounded in actual issue data. Combines semantic vector search with issue lookup to find relevant items, then synthesizes an answer referencing specific issue IDs. Use this for analysis, summaries, prioritization advice, or questions like "what should I work on next?" or "what bugs are open?". Only references issues that actually exist in the tracker.',
      {
        question: z
          .string()
          .min(1)
          .max(2000)
          .describe(
            'Natural language question about your tracked issues, e.g. "what bugs are open?" or "what should I work on next?"',
          ),
      },
      async ({ question }) => {
        const result = await handleAsk(question);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );

    server.tool(
      'track0_find',
      'Find existing issues that are semantically similar to a given message using vector similarity search. Use this tool before calling track0_tell to check whether a matching issue already exists, avoiding duplicate entries. Returns up to the specified limit of matching issues ranked by similarity percentage, each with issue ID, priority, type, status, title, and summary. If no similar issues are found, it is safe to create a new one with track0_tell.',
      {
        message: z
          .string()
          .min(1)
          .max(10000)
          .describe(
            'Natural language description of the work or problem to search for similar existing issues',
          ),
        limit: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .describe('Maximum number of similar issues to return (default 5, max 20)'),
      },
      async ({ message, limit }) => {
        const result = await handleFind(message, limit);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );

    server.tool(
      'track0_get',
      'Retrieve the complete details and full conversation thread for a single issue by its ID. Returns the issue title, type, status, priority, labels, summary, timestamps, and the entire message thread. Use this when you need to understand the full context and history of a specific issue before updating it, or when the user asks for details about a particular issue.',
      {
        id: z.string().max(20).describe('Issue ID to retrieve (e.g. wi_a3Kx)'),
      },
      async ({ id }) => {
        const result = await handleGet(id);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );
  },
  {
    capabilities: {},
  },
  {
    basePath: '',
  },
);

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    mismatch |= bufA[i] ^ bufB[i];
  }
  return mismatch === 0;
}

const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<
  { token: string; clientId: string; scopes: string[] } | undefined
> => {
  const expected = process.env.TRACK0_TOKEN;
  if (!expected || !bearerToken) return undefined;
  if (!timingSafeEqual(bearerToken, expected)) return undefined;
  return { token: bearerToken, clientId: 'tracker', scopes: [] };
};

const authedHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
