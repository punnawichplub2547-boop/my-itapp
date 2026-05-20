import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSessionToken,
  isValidSessionToken,
  SESSION_COOKIE_NAME,
  shouldUseSecureSessionCookie,
} from './mockUser';

test('creates a session token that is tied to the username and validates successfully', () => {
  const token = createSessionToken('admin');

  assert.ok(token.length > 20);
  assert.equal(isValidSessionToken(token), true);
  assert.equal(isValidSessionToken(`${token}-tampered`), false);
});

test('rejects a forged legacy-style session token', () => {
  assert.equal(
    isValidSessionToken('admin.repairlink-dev-session'),
    false
  );
});

test('rejects an expired session token', () => {
  const token = createSessionToken('admin', { issuedAt: 0, maxAge: 1 });

  assert.equal(isValidSessionToken(token, { now: 5_000 }), false);
});

test('exports the stable session cookie name', () => {
  assert.equal(SESSION_COOKIE_NAME, 'repairlink_session');
});

test('allows secure session cookies to be disabled for HTTP deployments', () => {
  const originalValue = process.env.AUTH_COOKIE_SECURE;
  process.env.AUTH_COOKIE_SECURE = 'false';

  try {
    assert.equal(shouldUseSecureSessionCookie(), false);
  } finally {
    if (originalValue === undefined) {
      delete process.env.AUTH_COOKIE_SECURE;
    } else {
      process.env.AUTH_COOKIE_SECURE = originalValue;
    }
  }
});
