import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/', '/issue'];
const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const dashboard_token = process.env.TRACK0_DASHBOARD_TOKEN;
  if (!dashboard_token) {
    return new NextResponse('Dashboard authentication not configured', {
      status: 503,
    });
  }

  const session_cookie = request.cookies.get('track0_session')?.value;
  if (!session_cookie || !timingSafeEqual(session_cookie, dashboard_token)) {
    const login_url = new URL('/login', request.url);
    return NextResponse.redirect(login_url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/issue/:path*'],
};
