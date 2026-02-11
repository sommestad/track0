# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Next.js dev server
npm run build         # Production build
npm run lint          # ESLint (quiet mode)
npm run test          # Vitest (CI mode, dot reporter)
npm run test:watch    # Vitest interactive
npx vitest run lib/__tests__/db.test.ts  # Run a single test file
npm run format        # Prettier write
npm run format:check  # Prettier check
```

## Architecture

track0 is an AI-native issue tracker where issues are conversation threads, not forms. A server-side LLM continuously derives structured fields (title, type, status, priority, labels, summary) from the thread history.

### MCP Server (`app/[transport]/route.ts`)

Three tools exposed via `mcp-handler`, authenticated with bearer token (`TRACK0_TOKEN`):

- **`track0_tell`** → `lib/tell-agent.ts`: Agentic orchestrator (Claude Sonnet 4.5, max 5 steps) that classifies messages as "new work" vs "directive", searches for duplicates via vector similarity, and creates or updates issues. Duplicate threshold: ≥85% similarity + same unit of work. P5 issues are auto-rejected.
- **`track0_ask`** → `lib/ask-agent.ts`: Agentic Q&A over tracked issues. Routes to semantic search, active issue listing, or detail retrieval.
- **`track0_get`** → `lib/tools.ts`: Direct issue lookup by ID with full thread.

### Data Flow

1. Tell/ask agents use `generateText` with tool definitions (search, create, update, get)
2. `lib/ai.ts` extracts structured `IssueFields` from thread via `generateObject` + Zod schema
3. `lib/ai.ts` generates 1536-dim embeddings (OpenAI text-embedding-3-small) for vector search
4. `lib/db.ts` stores in Neon Postgres with pgvector; `vectorSearch` uses cosine similarity

### Dashboard (`app/`)

- `app/page.tsx`: Issues grouped by status (open/active/done) with thread stats
- `app/issue/[id]/page.tsx`: Single issue detail with full thread
- `middleware.ts`: Cookie-based auth protecting `/` and `/issue/*`
- Two rendering modes controlled by CSS class `.llm` on `<html>`:
  - **Human mode**: Card grid, Inter font, rounded corners, larger text
  - **LLM mode**: Monospace, compact text lines, tight spacing

### Key Types (`lib/types.ts`)

- `Issue`: id (`wi_` prefix), title, type (bug|feature|task), status (open|active|done), priority (1-5), labels, summary, embedding, timestamps
- `ThreadMessage`: role (user|assistant|system), content, timestamp
- `IssueFieldsSchema`: Zod schema used for LLM extraction

## Code Conventions

- Path alias: `@/*` maps to project root
- Prettier: single quotes, trailing commas
- ESLint: next/core-web-vitals + typescript + prettier
- TypeScript strict mode
- Tailwind CSS v4 (PostCSS plugin, not config file)
- Dark mode variant targets `.llm *` class, not media query (`globals.css`)
- Test fixtures: `lib/test-util.ts` provides `createBaseIssue()` and `createBaseIssueFields()`

## Environment Variables

- `DATABASE_URL` — Neon Postgres connection string
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key for LLM/embedding calls
- `TRACK0_TOKEN` — Bearer token for MCP tool authentication
- `TRACK0_DASHBOARD_TOKEN` — Token for dashboard login
