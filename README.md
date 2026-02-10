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

## Recommended usage from CLAUDE.md

Add a guideline to your project's `CLAUDE.md` so the coding agent logs significant work automatically:

```markdown
## Work Tracking

When starting work that looks like a significant feature, meaningful change, or non-trivial bug fix,
use `mcp__track0__track0_tell` to log what's being worked on. Skip this for small tweaks, formatting,
or minor refactors.

When committing, pushing, or creating a PR for significant work, also update track0 with what was
done — include a summary of the changes, not just "committed" or "PR created".
```

This keeps track0 populated with the important stuff without noise from every small change. Adapt the second paragraph to match your workflow — if you use custom skills for `/commit` or `/commit-push-pr`, you can add the track0 step directly to those skills instead of relying on the CLAUDE.md nudge.

## Stack

- Next.js (App Router)
- Vercel AI SDK + gpt-4o-mini
- Neon Postgres + pgvector
- mcp-handler
