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
        question: z.string().max(2000).describe('Natural language question'),
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

const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<
  { token: string; clientId: string; scopes: string[] } | undefined
> => {
  if (!bearerToken || bearerToken !== process.env.TRACK0_TOKEN) return undefined;
  return { token: bearerToken, clientId: 'tracker', scopes: [] };
};

const authedHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
