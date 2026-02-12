import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifySlackSignature,
  parseSlackMessage,
  postSlackMessage,
  formatForSlack,
} from '../slack';

function makeSignature(secret: string, timestamp: string, body: string) {
  return (
    'v0=' +
    createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')
  );
}

describe('parseSlackMessage', () => {
  it('routes ?<question> to ask', () => {
    const result = parseSlackMessage('?what bugs are open');
    expect(result).toEqual({ mode: 'ask', body: 'what bugs are open' });
  });

  it('routes ? with extra whitespace', () => {
    const result = parseSlackMessage('?  what is the status  ');
    expect(result).toEqual({ mode: 'ask', body: 'what is the status' });
  });

  it('routes get <id> to get', () => {
    const result = parseSlackMessage('get wi_a3Kx');
    expect(result).toEqual({ mode: 'get', body: 'wi_a3Kx' });
  });

  it('routes get case-insensitively', () => {
    const result = parseSlackMessage('GET wi_xyz');
    expect(result).toEqual({ mode: 'get', body: 'wi_xyz' });
  });

  it('routes tell <id>: <msg> to tell with issue_id', () => {
    const result = parseSlackMessage('tell wi_a3Kx: this is done');
    expect(result).toEqual({
      mode: 'tell',
      body: 'this is done',
      issue_id: 'wi_a3Kx',
    });
  });

  it('routes tell case-insensitively', () => {
    const result = parseSlackMessage('TELL wi_abc: updated');
    expect(result).toEqual({
      mode: 'tell',
      body: 'updated',
      issue_id: 'wi_abc',
    });
  });

  it('routes plain text to tell without issue_id', () => {
    const result = parseSlackMessage('Add rate limiting to the API');
    expect(result).toEqual({
      mode: 'tell',
      body: 'Add rate limiting to the API',
    });
  });
});

describe('formatForSlack', () => {
  it('converts **bold** to *bold*', () => {
    expect(formatForSlack('This is **important** text')).toBe(
      'This is *important* text',
    );
  });

  it('converts Markdown links to Slack links', () => {
    expect(formatForSlack('[click here](https://example.com)')).toBe(
      '<https://example.com|click here>',
    );
  });

  it('linkifies standalone wi_ IDs when base_url provided', () => {
    expect(formatForSlack('See wi_a3Kx for details', 'https://t0.app')).toBe(
      'See <https://t0.app/issue/wi_a3Kx|wi_a3Kx> for details',
    );
  });

  it('leaves wi_ IDs as plain text when no base_url', () => {
    expect(formatForSlack('See wi_a3Kx for details')).toBe(
      'See wi_a3Kx for details',
    );
  });

  it('does not double-linkify IDs already inside converted links', () => {
    const md = 'Check [wi_a3Kx](https://t0.app/issue/wi_a3Kx)';
    expect(formatForSlack(md, 'https://t0.app')).toBe(
      'Check <https://t0.app/issue/wi_a3Kx|wi_a3Kx>',
    );
  });

  it('handles mixed bold and issue IDs', () => {
    expect(
      formatForSlack('**Created** wi_x1 and wi_x2', 'https://t0.app'),
    ).toBe(
      '*Created* <https://t0.app/issue/wi_x1|wi_x1> and <https://t0.app/issue/wi_x2|wi_x2>',
    );
  });
});

describe('verifySlackSignature', () => {
  const secret = 'test_signing_secret';
  const body = '{"type":"event_callback"}';

  it('returns true for valid signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = makeSignature(secret, timestamp, body);

    expect(verifySlackSignature(secret, timestamp, body, signature)).toBe(true);
  });

  it('returns false for wrong signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifySlackSignature(secret, timestamp, body, 'v0=bad_signature_hex'),
    ).toBe(false);
  });

  it('returns false for non-numeric timestamp', () => {
    const timestamp = 'not-a-number';
    const signature = makeSignature(secret, timestamp, body);

    expect(verifySlackSignature(secret, timestamp, body, signature)).toBe(
      false,
    );
  });

  it('returns false for expired timestamp', () => {
    const old_timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signature = makeSignature(secret, old_timestamp, body);

    expect(verifySlackSignature(secret, old_timestamp, body, signature)).toBe(
      false,
    );
  });
});

describe('postSlackMessage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('sends correct request shape', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    await postSlackMessage('xoxb-token', 'C123', 'hello', '1234.5678');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer xoxb-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'C123',
          text: 'hello',
          thread_ts: '1234.5678',
        }),
      }),
    );
  });

  it('omits thread_ts when not provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    await postSlackMessage('xoxb-token', 'C123', 'hello');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ channel: 'C123', text: 'hello' });
    expect(body.thread_ts).toBeUndefined();
  });

  it('throws on Slack API error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }),
    });

    await expect(
      postSlackMessage('xoxb-token', 'C999', 'hello'),
    ).rejects.toThrow('Slack API error: channel_not_found');
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      postSlackMessage('xoxb-token', 'C999', 'hello'),
    ).rejects.toThrow('Slack API HTTP 500');
  });
});
