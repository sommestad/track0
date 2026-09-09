import { createHmac, timingSafeEqual } from 'node:crypto';

const SLACK_TIMESTAMP_MAX_AGE = 5 * 60; // 5 minutes

export function verifySlackSignature(
  signing_secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > SLACK_TIMESTAMP_MAX_AGE) return false;

  const base = `v0:${timestamp}:${body}`;
  const expected =
    'v0=' + createHmac('sha256', signing_secret).update(base).digest('hex');

  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export type ParsedMessage =
  | { mode: 'ask'; body: string }
  | { mode: 'get'; body: string }
  | { mode: 'tell'; body: string; issue_id?: string };

export function parseSlackMessage(text: string): ParsedMessage {
  const trimmed = text.trim();

  if (trimmed.startsWith('?')) {
    return { mode: 'ask', body: trimmed.slice(1).trim() };
  }

  const getMatch = trimmed.match(/^get\s+(wi_\S+)/i);
  if (getMatch) {
    return { mode: 'get', body: getMatch[1] };
  }

  const tellMatch = trimmed.match(/^tell\s+(wi_\S+):\s*([\s\S]+)/i);
  if (tellMatch) {
    return { mode: 'tell', body: tellMatch[2].trim(), issue_id: tellMatch[1] };
  }

  return { mode: 'tell', body: trimmed };
}

export function formatForSlack(text: string, base_url?: string): string {
  // Markdown bold → Slack bold
  let result = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  // Markdown links → Slack links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');
  // Linkify standalone issue IDs (avoid double-linkifying ones already inside <...|...>)
  if (base_url) {
    result = result.replace(
      /(?<![|/])\b(wi_\w+)\b/g,
      `<${base_url}/issue/$1|$1>`,
    );
  }
  return result;
}

export function stripBotMention(text: string): string {
  return text.replace(/^<@U[A-Z0-9]+>\s*/, '');
}

export const ALL_BOTS = '*';

/**
 * Parse a comma-separated list of Slack bot IDs (`B...`) and/or bot user IDs
 * (`U...`) into a set. `*` allows every bot. Whitespace and empty entries are
 * ignored.
 */
export function parseAllowedBotIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export interface SlackSender {
  user?: string;
  bot_id?: string;
}

/**
 * Whether a message sender should be processed. Humans are always allowed.
 * Bots are allowed when the allowlist contains `*` or their `bot_id` / bot
 * `user` ID. The app's own bot user (`self_user_id`) is never allowed, so it
 * can't trigger itself even with `*`.
 */
export function isAllowedSender(
  sender: SlackSender,
  allowed_bot_ids: Set<string>,
  self_user_id?: string,
): boolean {
  if (self_user_id && sender.user === self_user_id) return false;
  if (!sender.bot_id) return true;
  return (
    allowed_bot_ids.has(ALL_BOTS) ||
    allowed_bot_ids.has(sender.bot_id) ||
    (!!sender.user && allowed_bot_ids.has(sender.user))
  );
}

export interface SlackThreadMessage {
  user?: string;
  bot_id?: string;
  bot_profile?: { name?: string };
  text: string;
  ts: string;
}

export async function fetchThreadMessages(
  bot_token: string,
  channel: string,
  thread_ts: string,
): Promise<SlackThreadMessage[]> {
  const url = new URL('https://slack.com/api/conversations.replies');
  url.searchParams.set('channel', channel);
  url.searchParams.set('ts', thread_ts);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bot_token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Slack API HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.messages as SlackThreadMessage[];
}

export function formatThreadContext(
  messages: SlackThreadMessage[],
  trigger_ts: string,
  allowed_bot_ids: Set<string> = new Set(),
  self_user_id?: string,
): string {
  const filtered = messages
    .filter(
      (m) =>
        m.ts !== trigger_ts &&
        isAllowedSender(m, allowed_bot_ids, self_user_id),
    )
    .slice(-20);

  if (filtered.length === 0) return '';

  const lines = filtered.map((m) => {
    const name = m.bot_id
      ? (m.bot_profile?.name ?? m.user ?? m.bot_id)
      : (m.user ?? 'unknown');
    return `${name}: ${m.text}`;
  });
  return `[Thread context]\n${lines.join('\n')}`;
}

export async function postSlackMessage(
  bot_token: string,
  channel: string,
  text: string,
  thread_ts?: string,
): Promise<void> {
  const payload: Record<string, string> = { channel, text };
  if (thread_ts) payload.thread_ts = thread_ts;

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bot_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Slack API HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
}
