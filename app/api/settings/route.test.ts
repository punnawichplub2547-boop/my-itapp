import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, PATCH } from './route';
import { POST as RESET_POST } from './reset/route';
import {
  DEFAULT_SYSTEM_SETTINGS,
  InMemorySettingsRepository,
  setSettingsRepositoryForTest,
} from '../../lib/settings/settingsService';
import { createSessionToken, SESSION_COOKIE_NAME } from '../../lib/auth/mockUser';

function createAuthHeaders() {
  return {
    'content-type': 'application/json',
    cookie: `${SESSION_COOKIE_NAME}=${createSessionToken('admin')}`,
  };
}

test('GET /api/settings returns settings', async () => {
  const repo = new InMemorySettingsRepository();
  setSettingsRepositoryForTest(repo);

  const response = await GET();
  assert.equal(response.status, 200);

  const data = (await response.json()) as { settings: typeof DEFAULT_SYSTEM_SETTINGS };
  assert.deepEqual(data.settings, DEFAULT_SYSTEM_SETTINGS);
});

test('PATCH /api/settings updates settings when authorized', async () => {
  const repo = new InMemorySettingsRepository();
  setSettingsRepositoryForTest(repo);

  const response = await PATCH(
    new Request('http://localhost:3000/api/settings', {
      method: 'PATCH',
      headers: createAuthHeaders(),
      body: JSON.stringify({
        settings: {
          departments: ['IT', 'NEW_DEPT'],
          warrantyExpiringSoonDays: 45,
        },
      }),
    })
  );

  assert.equal(response.status, 200);
  const data = (await response.json()) as { settings: typeof DEFAULT_SYSTEM_SETTINGS };
  assert.deepEqual(data.settings.departments, ['IT', 'NEW_DEPT']);
  assert.equal(data.settings.warrantyExpiringSoonDays, 45);
});

test('POST /api/settings/reset resets settings', async () => {
  const repo = new InMemorySettingsRepository({
    departments: ['CUSTOM'],
    warrantyExpiringSoonDays: 90,
  });
  setSettingsRepositoryForTest(repo);

  const response = await RESET_POST(
    new Request('http://localhost:3000/api/settings/reset', {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify({ keys: ['departments'] }),
    })
  );

  assert.equal(response.status, 200);
  const data = (await response.json()) as { settings: typeof DEFAULT_SYSTEM_SETTINGS };
  assert.deepEqual(data.settings.departments, DEFAULT_SYSTEM_SETTINGS.departments);
  assert.equal(data.settings.warrantyExpiringSoonDays, 90);
});

test('PATCH /api/settings rejects unauthenticated requests in production', async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevUser = process.env.AUTH_ADMIN_USERNAME;
  const prevPass = process.env.AUTH_ADMIN_PASSWORD;
  const prevSecret = process.env.AUTH_SESSION_SECRET;

  process.env.NODE_ENV = 'production';
  process.env.AUTH_ADMIN_USERNAME = 'admin';
  process.env.AUTH_ADMIN_PASSWORD = 'password';
  process.env.AUTH_SESSION_SECRET = 'secret';

  try {
    const response = await PATCH(
      new Request('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ departments: ['IT'] }),
      })
    );

    assert.equal(response.status, 401);
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.AUTH_ADMIN_USERNAME = prevUser;
    process.env.AUTH_ADMIN_PASSWORD = prevPass;
    process.env.AUTH_SESSION_SECRET = prevSecret;
  }
});
