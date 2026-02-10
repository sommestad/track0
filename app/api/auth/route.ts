import { NextRequest, NextResponse } from 'next/server';

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    mismatch |= bufA[i] ^ bufB[i];
  }
  return mismatch === 0;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST(request: NextRequest) {
  const dashboard_token = process.env.TRACK0_DASHBOARD_TOKEN;
  if (!dashboard_token) {
    return NextResponse.json(
      { error: 'Dashboard authentication not configured' },
      { status: 503 },
    );
  }

  const body = await request.json();
  const provided_token = body.token;

  if (
    typeof provided_token !== 'string' ||
    !timingSafeEqual(provided_token, dashboard_token)
  ) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('track0_session', dashboard_token, COOKIE_OPTIONS);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('track0_session', '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}
