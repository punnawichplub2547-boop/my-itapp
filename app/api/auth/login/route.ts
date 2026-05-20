import { NextResponse } from 'next/server';
import {
  REMEMBERED_SESSION_MAX_AGE,
  SESSION_COOKIE_NAME,
  STANDARD_SESSION_MAX_AGE,
  authenticateAdmin,
  createSessionToken,
  shouldUseSecureSessionCookie,
} from '../../../lib/auth/mockUser';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: Partial<{ username: string; password: string; rememberMe: boolean }>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid login request.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const rememberMe = body.rememberMe === true;

  if (!username.trim() || !password) {
    return NextResponse.json(
      { error: 'Username and password are required.' },
      { status: 400 }
    );
  }

  const user = authenticateAdmin(username, password);

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    user,
    redirectTo: '/dashboard',
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(user.username),
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureSessionCookie(),
    path: '/',
    maxAge: rememberMe ? REMEMBERED_SESSION_MAX_AGE : STANDARD_SESSION_MAX_AGE,
  });

  return response;
}
