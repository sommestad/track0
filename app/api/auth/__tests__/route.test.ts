import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const VALID_TOKEN = 'test-dashboard-token';

let POST: typeof import('../route').POST;
let DELETE: typeof import('../route').DELETE;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('TRACK0_DASHBOARD_TOKEN', VALID_TOKEN);
  const mod = await import('../route');
  POST = mod.POST;
  DELETE = mod.DELETE;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/auth', () => {
  it('should return 503 when TRACK0_DASHBOARD_TOKEN not set', async () => {
    vi.stubEnv('TRACK0_DASHBOARD_TOKEN', '');
    const mod = await import('../route');

    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'anything' }),
    });

    const response = await mod.POST(request as never);

    expect(response.status).toBe(503);
  });

  it('should return 400 on malformed JSON body', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request as never);

    expect(response.status).toBe(400);
  });

  it('should return 401 on wrong token', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'wrong-token' }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(401);
  });

  it('should return 200 and set cookie on correct token', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: VALID_TOKEN }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('track0_session');
  });
});

describe('DELETE /api/auth', () => {
  it('should clear the cookie', async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('track0_session');
    expect(setCookie).toContain('Max-Age=0');
  });
});
