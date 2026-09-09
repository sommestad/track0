import { after, NextResponse } from 'next/server';
import {
  verifySlackSignature,
  parseSlackMessage,
  postSlackMessage,
  formatForSlack,
  stripBotMention,
  fetchThreadMessages,
  formatThreadContext,
  parseAllowedBotIds,
  isAllowedSender,
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

  const allowed_bot_ids = parseAllowedBotIds(process.env.SLACK_ALLOWED_BOT_IDS);
  const sender = {
    user: event.user ? String(event.user) : undefined,
    bot_id: event.bot_id ? String(event.bot_id) : undefined,
  };
  // Slack includes the app's own bot user ID in `authorizations`; used to make
  // sure track0 never reacts to its own messages.
  const authorizations = payload.authorizations as
    | Array<{ user_id?: string }>
    | undefined;
  const self_user_id = authorizations?.[0]?.user_id;

  // DMs are human-only. @mentions from bots are accepted only when the bot is
  // allowlisted via SLACK_ALLOWED_BOT_IDS (or it is `*`), to avoid bot-to-bot
  // reply loops.
  const is_dm =
    event.type === 'message' &&
    event.channel_type === 'im' &&
    !event.bot_id &&
    !event.subtype;
  const is_mention =
    event.type === 'app_mention' &&
    isAllowedSender(sender, allowed_bot_ids, self_user_id);

  if (!is_dm && !is_mention) {
    if (event.type === 'app_mention' && event.bot_id) {
      console.log(
        `Slack: ignored @mention from bot (bot_id=${sender.bot_id}, user=${sender.user})`,
      );
    }
    return new NextResponse(null, { status: 200 });
  }

  let text = String(event.text ?? '');
  if (is_mention) text = stripBotMention(text);

  const channel = String(event.channel);
  const thread_ts = String(event.thread_ts ?? event.ts);

  after(async () => {
    try {
      let thread_context = '';
      if (is_mention && event.thread_ts) {
        const messages = await fetchThreadMessages(
          bot_token,
          channel,
          String(event.thread_ts),
        );
        thread_context = formatThreadContext(
          messages,
          String(event.ts),
          allowed_bot_ids,
          self_user_id,
        );
      }

      const parsed = parseSlackMessage(text);

      if (thread_context && parsed.mode !== 'get') {
        parsed.body = `${thread_context}\n\n${parsed.body}`;
      }

      let result: string;

      switch (parsed.mode) {
        case 'ask':
          result = await handleAsk(parsed.body);
          break;
        case 'get':
          result = await handleGet(parsed.body);
          break;
        case 'tell':
          result = await handleTell(parsed.body, parsed.issue_id, 'user');
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
