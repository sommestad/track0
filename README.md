# track0

AI-native issue tracker. Issues are conversations, not forms.

Claude Code talks to it via 3 MCP tools. A server-side LLM derives structured state from the thread. Humans get a read-only dashboard.

## Tools

| Tool | Purpose |
|------|---------|
| `track0_tell` | Tell the tracker something. Creates or updates issues from natural language. |
| `track0_ask` | Ask a question. Server-side LLM answers based on stored data + vector search. |
| `track0_get` | Get full thread + derived state for one issue. |

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AEsset/track0&stores=[{"type":"neon"}])

You'll need:
- **OPENAI_API_KEY** — for LLM extraction and embeddings
- **TRACK0_TOKEN** — bearer token for MCP auth (generate a random string)
- **DATABASE_URL** — auto-provisioned by Neon integration

## Connect from Claude Code

Add to `.mcp.json` in any repo:

```json
{
  "mcpServers": {
    "tracker": {
      "type": "http",
      "url": "https://your-track0.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer <your-track0-token>"
      }
    }
  }
}
```

## Stack

- Next.js (App Router)
- Vercel AI SDK + gpt-4o-mini
- Neon Postgres + pgvector
- mcp-handler
