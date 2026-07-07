import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, shouldUseSecureSessionCookie } from '../../../lib/auth/mockUser';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true, redirectTo: '/' });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureSessionCookie(),
    path: '/',
    maxAge: 0,
  });

  return response;
}
