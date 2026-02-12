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
