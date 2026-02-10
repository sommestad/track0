import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { handleTell, handleAsk, handleGet } from '@/lib/tools';

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'track0_tell',
      'Tell the tracker something. Creates a new issue or updates an existing one. Use natural language.',
      {
        message: z
          .string()
          .min(1)
          .max(10000)
          .describe('Natural language message about an issue'),
        issue_id: z
          .string()
          .max(20)
          .optional()
          .describe(
            'Existing issue ID to update (e.g. wi_abc123). Omit to create new.',
          ),
      },
      async ({ message, issue_id }) => {
        const result = await handleTell(message, issue_id);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );

    server.tool(
      'track0_ask',
      'Ask a question about your issues. Uses semantic search to find relevant items.',
      {
        question: z.string().min(1).max(2000).describe('Natural language question'),
      },
      async ({ question }) => {
        const result = await handleAsk(question);
        return { content: [{ type: 'text' as const, text: result }] };
      },
    );

    server.tool(
      'track0_get',
      'Get full details and conversation thread for one issue.',
      {
        id: z.string().max(20).describe('Issue ID (e.g. wi_a3Kx)'),
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
