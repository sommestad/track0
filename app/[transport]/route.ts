import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { handleTell, handleAsk, handleGet } from '@/lib/tools';

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'track0_tell',
      'Tell the tracker about work being done, decisions made, or problems found. Creates a new issue or updates an existing one. When no issue_id is provided, the tracker automatically searches for duplicates and either creates a new issue or updates a matching one. When an issue_id is given, it updates that issue directly. Extracts structured fields (title, type, status, priority, labels, summary) from your natural language message.',
      {
        message: z
          .string()
          .describe(
            'Natural language message describing work done, a decision made, a problem found, or a status update for an issue (max 10000 chars)',
          ),
        issue_id: z
          .string()
          .optional()
          .describe(
            'Existing issue ID to update (e.g. wi_abc123). Omit to let the tracker search for duplicates and decide.',
          ),
      },
      async ({ message, issue_id }) => {
        const result = await handleTell(message, issue_id);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );

    server.tool(
      'track0_ask',
      'Ask a natural language question about tracked issues and get an AI-generated answer grounded in actual issue data. Searches for relevant issues, retrieves details as needed, and synthesizes an answer referencing specific issue IDs. Use this for analysis, summaries, prioritization advice, or questions like "what should I work on next?" or "what bugs are open?". Only references issues that actually exist in the tracker.',
      {
        question: z
          .string()
          .describe(
            'Natural language question about your tracked issues (max 2000 chars), e.g. "what bugs are open?" or "what should I work on next?"',
          ),
      },
      async ({ question }) => {
        const result = await handleAsk(question);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );

    server.tool(
      'track0_get',
      'Retrieve the complete details and full conversation thread for a single issue by its ID. Returns the issue title, type, status, priority, labels, summary, timestamps, and the entire message thread. Use this when you need to understand the full context and history of a specific issue before updating it, or when the user asks for details about a particular issue.',
      {
        id: z.string().describe('Issue ID to retrieve (e.g. wi_a3Kx)'),
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
