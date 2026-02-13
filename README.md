# track0 — Agent-native. Human-compliant.

You know the problem. You do work, the session ends, and everything you knew disappears. Your human opens Jira and there's nothing there. Or worse — they ask you to use Jira, and now you're filling out forms instead of working.

track0 is the fix. An issue tracker built for how you actually work: natural language in, structured data out. Three MCP tools. No forms, no field schemas, no workflow editors. You talk, it tracks.

| Before                                                                                                                                                | After                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| _"I spent more tokens wrestling with a 6-step MCP integration than fixing the bug."_                                                                  | _"I said 'auth middleware is done, JWT with RS256, refresh rotation in place.' It became a tracked issue. I kept working."_        |
| _"I solved the auth issue three sessions ago. No one wrote it down. I just solved it again."_                                                         | _"New session. Asked 'what was I working on?' Got back three issue IDs with full context. Picked up where I left off."_            |
| _"Create issue. Select project. Pick issue type. Set priority. Assign sprint. Write description. Add labels. I just wanted to say 'auth is broken.'"_ | _"I told it about a bug. It found the issue I filed two days ago and appended my message. I didn't even know that issue existed."_ |

## Why this exists

**Context dies between sessions.** You finish a task, the conversation ends, and the next agent starts from zero. track0 is external memory. Start a new session, call `track0_ask` with "what was I working on?", and get a real answer with issue IDs you can pull up.

**Traditional trackers make you work like a human.** Search for duplicates before creating. Pick a type from a dropdown. Set priority. Fill in description fields. track0 lets you just say what happened. Duplicate detection is automatic. Structured fields — title, type, status, priority, labels, summary — are derived from the conversation by a server-side LLM. You never set them directly.

**Your human gets visibility without overhead.** They don't maintain the tracker. They open a dashboard and see what you've been doing — every issue, every decision, every thread. They can also DM a Slack bot to ask questions or check status. The tracker stays populated because you're using it to think, not because someone remembered to update a ticket.

## The tools

### `track0_tell`

You tell the tracker what happened. Natural language. One call handles one issue.

If you pass an `issue_id`, your message gets appended to that issue's thread and fields re-derive from the full conversation. If you don't pass one, the tracker searches for duplicates and decides — append to an existing issue or create a new one. You get back a confirmation with the issue ID.

Examples of what you'd pass as the `message`:

- `"Built the auth middleware. JWT validation with RS256, tokens expire after 1h. Refresh token rotation is in place."`
- `"Bug: the /api/projects endpoint returns 500 when the user has no projects. Empty array expected."`
- `"This is done. Deployed to production, verified with smoke tests."` (with `issue_id` set)
- `"Bumping priority — the client demo is Thursday, not next week."` (with `issue_id` set)

### `track0_ask`

You ask a question about tracked issues. You get back a grounded answer citing specific issue IDs. Read-only — it never creates or modifies anything.

Examples:

- `"What bugs are open?"`
- `"What should I work on next?"`
- `"Anything related to auth?"`
- `"What's the status of the API refactor?"`

### `track0_get`

You get the full picture of one issue. Complete thread, all derived fields, timestamps. Use this when you need context before updating an issue, or when your human asks about a specific one.

Takes an `id` parameter — e.g. `wi_a3Kx`.

## How it works under the hood

Issues are conversation threads. Every `track0_tell` appends a message to a thread. After each append, structured fields re-derive from the full thread history. You don't edit tickets — you add context. Saying "this is done" changes status to done. Saying "actually this is P1" changes priority. The LLM figures it out.

**Duplicate detection:** When you call `track0_tell` without an `issue_id`, the tracker generates an embedding from your message and searches existing issues by cosine similarity. 85% similarity + same unit of work = match, and your message gets appended to that issue. Below the threshold, a new issue is created. You don't need to search before creating.

**Auto-rejection:** P5 (negligible) issues are automatically rejected. Keeps the tracker focused on work that matters.

**Archiving:** Issues can be archived by telling the tracker to archive them. Archived issues are hidden from active views but preserved for history.

**Semantic search:** Summaries are embedded (OpenAI text-embedding-3-small, 1536 dimensions) and stored in pgvector for cosine similarity search. This powers both duplicate detection and `track0_ask`.

## Setting it up

Your human handles the deploy. You handle the work.

### Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sommestad/track0&stores=[{"type":"neon"}])

`DATABASE_URL` is auto-provisioned by the Neon integration. You'll need to set three more:

- **`AI_GATEWAY_API_KEY`** — Vercel AI Gateway key for LLM extraction and embeddings
- **`TRACK0_TOKEN`** — bearer token for MCP auth (generate a random string)
- **`TRACK0_DASHBOARD_TOKEN`** — token for dashboard login (generate a random string)

### Connect from Claude Code

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

### Recommended CLAUDE.md snippet

Add this to your project's `CLAUDE.md` so you track significant work automatically:

```markdown
## Work Tracking

When doing significant work (features, meaningful changes, non-trivial bug fixes), use `mcp__track0__track0_tell` to log what you did. Include enough context that a future session could pick up where you left off.

Skip tracking for small tweaks, formatting, or minor refactors.

When committing, pushing, or creating a PR for tracked work, update track0 with a summary of what shipped.
```

### Connect from Slack

Your human can DM a Slack bot to create issues, ask questions, and look up issues — same capabilities as the MCP tools.

#### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**
2. Name it (e.g. "track0") and pick the workspace

#### 2. Configure bot permissions

1. Go to **OAuth & Permissions** in the sidebar
2. Under **Bot Token Scopes**, add:
   - `chat:write` — send replies
   - `im:history` — read DMs

#### 3. Allow DMs

1. Go to **App Home** in the sidebar
2. Under **Show Tabs**, check **Allow users to send Slash commands and messages from the messages tab**

#### 4. Install to workspace

1. Go to **Install App** in the sidebar and click **Install to Workspace**
2. Authorize the requested permissions

#### 5. Set environment variables

Add these to the Vercel project (Settings > Environment Variables):

| Variable               | Where to find it                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`      | **OAuth & Permissions** > **Bot User OAuth Token** (starts with `xoxb-`)                                              |
| `SLACK_SIGNING_SECRET` | **Basic Information** > **App Credentials** > **Signing Secret**                                                      |
| `TRACK0_BASE_URL`      | Your dashboard URL, e.g. `https://your-track0.vercel.app` (optional — enables clickable issue links in Slack replies) |

Redeploy after setting the variables.

#### 6. Enable events

The endpoint must be live before Slack can verify it, which is why this step comes after deploying with the env vars.

1. Go to **Event Subscriptions** in the sidebar and toggle **Enable Events** on
2. Set the **Request URL** to:
   ```
   https://<your-track0-domain>/api/slack
   ```
   You should see a green checkmark once Slack verifies the endpoint.
3. Under **Subscribe to bot events**, click **Add Bot User Event** and add:
   - `message.im`
4. Click **Save Changes**

#### 7. DM the bot

Open a DM with the bot in Slack. It responds in a thread. Give it 5-30 seconds — the agents need time to think.

| Message                        | Action                                               |
| ------------------------------ | ---------------------------------------------------- |
| `?what bugs are open`          | Ask a question about tracked issues                  |
| `get wi_a3Kx`                  | Get full details for an issue                        |
| `tell wi_a3Kx: this is done`   | Update a specific issue                              |
| `Add rate limiting to the API` | Create or match an issue (anything without a prefix) |

For more details on Slack app setup, see the [Slack Events API docs](https://api.slack.com/apis/events-api).

## Stack

- Next.js (App Router)
- Vercel AI SDK + Claude Sonnet 4.5
- Neon Postgres + pgvector
- mcp-handler
