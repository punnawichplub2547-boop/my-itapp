import { createHmac } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'repairlink_session';
export const STANDARD_SESSION_MAX_AGE = 60 * 60 * 8;
export const REMEMBERED_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const DEV_ADMIN_USERNAME = 'admin';
const DEV_ADMIN_PASSWORD = 'Admincar_1996';
const DEV_SESSION_SECRET = 'repairlink-dev-session';
const SESSION_TOKEN_VERSION = 'v1';

type SessionTokenOptions = {
  issuedAt?: number;
  maxAge?: number;
};

type SessionValidationOptions = {
  now?: number;
};

function getMockAdminUser() {
  return {
    username:
      process.env.AUTH_ADMIN_USERNAME ??
      (process.env.NODE_ENV === 'production' ? '' : DEV_ADMIN_USERNAME),
    password:
      process.env.AUTH_ADMIN_PASSWORD ??
      (process.env.NODE_ENV === 'production' ? '' : DEV_ADMIN_PASSWORD),
    displayName: 'Admin User',
    role: 'Global Administrator',
  };
}

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET ?? DEV_SESSION_SECRET;
}

export function shouldUseSecureSessionCookie() {
  if (process.env.AUTH_COOKIE_SECURE === 'true') {
    return true;
  }

  if (process.env.AUTH_COOKIE_SECURE === 'false') {
    return false;
  }

  return process.env.NODE_ENV === 'production';
}

export function authenticateAdmin(username: string, password: string) {
  const mockAdminUser = getMockAdminUser();

  if (username.trim() !== mockAdminUser.username || password !== mockAdminUser.password) {
    return null;
  }

  return {
    username: mockAdminUser.username,
    displayName: mockAdminUser.displayName,
    role: mockAdminUser.role,
  };
}

export function createSessionToken(username: string, options: SessionTokenOptions = {}) {
  const issuedAt = options.issuedAt ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAge ?? STANDARD_SESSION_MAX_AGE;
  const payload = `${username}:${issuedAt}:${maxAge}`;
  const signature = signSessionPayload(payload);

  return `${SESSION_TOKEN_VERSION}.${toBase64Url(payload)}.${signature}`;
}

export function isValidSessionToken(token?: string, options: SessionValidationOptions = {}) {
  const mockAdminUser = getMockAdminUser();

  if (!token || !mockAdminUser.username) {
    return false;
  }

  const [version, encodedPayload, signature] = token.split('.');

  if (version !== SESSION_TOKEN_VERSION || !encodedPayload || !signature) {
    return false;
  }

  const payload = fromBase64Url(encodedPayload);

  if (signature !== signSessionPayload(payload)) {
    return false;
  }

  const [username, issuedAtRaw, maxAgeRaw] = payload.split(':');
  const issuedAt = Number(issuedAtRaw);
  const maxAge = Number(maxAgeRaw);
  const now = options.now ?? Math.floor(Date.now() / 1000);

  return (
    username === mockAdminUser.username &&
    Number.isFinite(issuedAt) &&
    Number.isFinite(maxAge) &&
    now < issuedAt + maxAge
  );
}

export function requireAuthenticatedRequest(request?: Request | null) {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const token = getCookieValue(request?.headers.get('cookie') ?? null, SESSION_COOKIE_NAME);

  if (isValidSessionToken(token)) {
    return null;
  }

  return Response.json({ error: 'Authentication required.' }, { status: 401 });
}

function signSessionPayload(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getCookieValue(header: string | null, cookieName: string) {
  if (!header) {
    return undefined;
  }

  for (const segment of header.split(';')) {
    const [name, ...valueParts] = segment.trim().split('=');

    if (name === cookieName) {
      return valueParts.join('=');
    }
  }

  return undefined;
}
