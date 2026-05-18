import assert from 'node:assert/strict';
import test from 'node:test';

import { GET } from './route';
import { createSessionToken, SESSION_COOKIE_NAME } from '../../lib/auth/mockUser';

test('GET /api/devices returns 503 when database is not configured in production', async () => {
  const originalEnv = { ...process.env };

  delete process.env.DATABASE_URL;
  delete process.env.DB_HOST;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DEVICE_REPOSITORY;
  process.env.AUTH_ADMIN_USERNAME = 'admin';
  process.env.AUTH_ADMIN_PASSWORD = 'Admincar_1996';
  process.env.AUTH_SESSION_SECRET = 'test-session-secret';
  process.env.NODE_ENV = 'production';

  try {
    const response = await GET(
      new Request('http://localhost:3000/api/devices', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${createSessionToken('admin')}`,
        },
      })
    );
    const body = (await response.json()) as { error?: string };

    assert.equal(response.status, 503);
    assert.match(body.error ?? '', /Database is not configured/);
  } finally {
    process.env = originalEnv;
  }
});
