import assert from 'node:assert/strict';
import test from 'node:test';

import { GET } from './route';

test('GET /api/devices returns 503 when database is not configured in production', async () => {
  const originalEnv = { ...process.env };

  delete process.env.DATABASE_URL;
  delete process.env.DB_HOST;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DEVICE_REPOSITORY;
  process.env.NODE_ENV = 'production';

  try {
    const response = await GET();
    const body = (await response.json()) as { error?: string };

    assert.equal(response.status, 503);
    assert.match(body.error ?? '', /Database is not configured/);
  } finally {
    process.env = originalEnv;
  }
});
