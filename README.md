# track0

AI-native issue tracker. Issues are conversations, not forms.

Claude Code talks to it via 4 MCP tools. A server-side LLM derives structured state from the thread. Humans get a read-only dashboard.

## Tools

| Tool          | Purpose                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------- |
| `track0_tell` | Tell the tracker something. Creates or updates issues from natural language.             |
| `track0_find` | Find existing issues similar to a message. Use before `track0_tell` to avoid duplicates. |
| `track0_ask`  | Ask a question. Server-side LLM answers based on stored data + vector search.            |
| `track0_get`  | Get full thread + derived state for one issue.                                           |

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AEsset/track0&stores=[{"type":"neon"}])

You'll need:

- **AI_GATEWAY_API_KEY** — for LLM extraction and embeddings via Vercel AI Gateway
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

## Connect from Slack

You can DM the bot to create/update issues, ask questions, and look up issues — same capabilities as the MCP tools.

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**
2. Name it (e.g. "track0") and pick your workspace

### 2. Configure bot permissions

1. Go to **OAuth & Permissions** in the sidebar
2. Under **Bot Token Scopes**, add:
   - `chat:write` — send replies
   - `im:history` — read DMs

### 3. Allow DMs

1. Go to **App Home** in the sidebar
2. Under **Show Tabs**, check **Allow users to send Slash commands and messages from the messages tab**

### 4. Install to workspace

1. Go to **Install App** in the sidebar and click **Install to Workspace**
2. Authorize the requested permissions

### 5. Set environment variables

Grab these two values and add them to your Vercel project (Settings > Environment Variables):

| Variable               | Where to find it                                                         |
| ---------------------- | ------------------------------------------------------------------------ |
| `SLACK_BOT_TOKEN`      | **OAuth & Permissions** > **Bot User OAuth Token** (starts with `xoxb-`) |
| `SLACK_SIGNING_SECRET` | **Basic Information** > **App Credentials** > **Signing Secret**         |

Redeploy after setting the variables.

### 6. Enable events

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

### 7. DM the bot

Open a DM with your bot in Slack. The bot responds in a thread. Give it 5-30 seconds — the agents need time to think.

| Message                        | Action                                               |
| ------------------------------ | ---------------------------------------------------- |
| `?what bugs are open`          | Ask a question about tracked issues                  |
| `get wi_a3Kx`                  | Get full details for an issue                        |
| `tell wi_a3Kx: this is done`   | Update a specific issue                              |
| `Add rate limiting to the API` | Create or match an issue (anything without a prefix) |

For more details on Slack app setup, see the [Slack Events API docs](https://api.slack.com/apis/events-api).

## Recommended usage from CLAUDE.md

Add a guideline to your project's `CLAUDE.md` so the coding agent logs significant work automatically:

```markdown
## Work Tracking

When starting work that looks like a significant feature, meaningful change, or non-trivial bug fix:

1. Use `mcp__track0__track0_find` to check if a similar issue already exists.
2. If a match exists, use `mcp__track0__track0_tell` with that `issue_id` to update it.
3. If no match, use `mcp__track0__track0_tell` without an `issue_id` to create a new issue.

Skip tracking for small tweaks, formatting, or minor refactors.

When committing, pushing, or creating a PR for significant work, also update track0 with what was
done — include a summary of the changes, not just "committed" or "PR created".
```

This keeps track0 populated with the important stuff without noise from every small change. Adapt the second paragraph to match your workflow — if you use custom skills for `/commit` or `/commit-push-pr`, you can add the track0 step directly to those skills instead of relying on the CLAUDE.md nudge.

## Stack

- Next.js (App Router)
- Vercel AI SDK + Claude Sonnet 4.5
- Neon Postgres + pgvector
- mcp-handler
