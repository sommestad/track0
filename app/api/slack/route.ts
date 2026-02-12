import { after, NextResponse } from 'next/server';
import {
  verifySlackSignature,
  parseSlackMessage,
  postSlackMessage,
  formatForSlack,
} from '@/lib/slack';
import { handleTell, handleAsk, handleGet } from '@/lib/tools';

export const maxDuration = 60;

export async function POST(request: Request) {
  const bot_token = process.env.SLACK_BOT_TOKEN;
  const signing_secret = process.env.SLACK_SIGNING_SECRET;

  if (!bot_token || !signing_secret) {
    return NextResponse.json(
      { error: 'Slack integration not configured' },
      { status: 503 },
    );
  }

  const raw_body = await request.text();
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
  const signature = request.headers.get('x-slack-signature') ?? '';

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw_body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!verifySlackSignature(signing_secret, timestamp, raw_body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (request.headers.get('x-slack-retry-num')) {
    console.warn(
      'Slack retry dropped:',
      request.headers.get('x-slack-retry-reason'),
    );
    return new NextResponse(null, { status: 200 });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) {
    return new NextResponse(null, { status: 200 });
  }

  // Only handle DMs from real users
  if (
    event.type !== 'message' ||
    event.channel_type !== 'im' ||
    event.bot_id ||
    event.subtype
  ) {
    return new NextResponse(null, { status: 200 });
  }

  const text = String(event.text ?? '');
  const channel = String(event.channel);
  const thread_ts = String(event.ts);

  after(async () => {
    try {
      const parsed = parseSlackMessage(text);
      let result: string;

      switch (parsed.mode) {
        case 'ask':
          result = await handleAsk(parsed.body);
          break;
        case 'get':
          result = await handleGet(parsed.body);
          break;
        case 'tell':
          result = await handleTell(parsed.body, parsed.issue_id);
          break;
      }

      const base_url = process.env.TRACK0_BASE_URL;
      await postSlackMessage(
        bot_token,
        channel,
        formatForSlack(result, base_url),
        thread_ts,
      );
    } catch (error) {
      console.error('Slack handler error:', error);
    }
  });

  return new NextResponse(null, { status: 200 });
}
