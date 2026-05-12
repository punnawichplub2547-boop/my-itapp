import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  GET,
  POST,
  setTicketNotificationDispatcherForTest,
} from './route';
import { resetDefaultTicketRepositoryForTest } from '../../lib/tickets/ticketService';

const ENV_KEYS = ['NODE_ENV', 'TICKET_DEMO_STORE_PATH'] as const;
const DB_ENV_KEYS = [
  'DATABASE_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_CONNECTION_LIMIT',
] as const;

test('GET /api/tickets and POST /api/tickets persist tickets', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-tickets-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  setTicketNotificationDispatcherForTest(() => undefined);

  try {
    const emptyResponse = await GET();
    const emptyResult = (await emptyResponse.json()) as { tickets?: unknown };

    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(emptyResult.tickets, []);

    const postResponse = await POST(
      new Request('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: 'OptiPlex 360',
          employeeName: 'chakrit',
          employeeEmail: 'chakrit@car-1996.com',
          department: 'IT',
          problemType: 'Hardware Failure',
          description: 'No display after boot.',
          priority: 'High',
          notifyRecipients: ['employee'],
        }),
      })
    );
    const postResult = (await postResponse.json()) as {
      ticket?: { id?: string; status?: string };
    };

    assert.equal(postResponse.status, 201);
    assert.equal(postResult.ticket?.status, 'Pending');
    assert.ok(postResult.ticket?.id);

    const listResponse = await GET();
    const listResult = (await listResponse.json()) as { tickets?: Array<{ id?: string }> };

    assert.equal(listResponse.status, 200);
    assert.equal(listResult.tickets?.[0]?.id, postResult.ticket?.id);
  } finally {
    setTicketNotificationDispatcherForTest(null);
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/tickets does not persist when recipient validation fails', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-tickets-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  setTicketNotificationDispatcherForTest(() => undefined);

  try {
    const response = await POST(
      new Request('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: 'OptiPlex 360',
          employeeName: 'chakrit',
          employeeEmail: 'chakrit@car-1996.com',
          department: 'IT',
          problemType: 'Hardware Failure',
          description: 'No display after boot.',
          customerEmail: 'not-an-email',
          notifyRecipients: ['customer'],
        }),
      })
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.match(result.error ?? '', /valid customer or employee recipient email/i);

    const listResponse = await GET();
    const listResult = (await listResponse.json()) as { tickets?: unknown[] };

    assert.deepEqual(listResult.tickets, []);
  } finally {
    setTicketNotificationDispatcherForTest(null);
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/tickets returns 400 for malformed JSON and service validation errors', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-tickets-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  setTicketNotificationDispatcherForTest(() => undefined);

  try {
    const malformedResponse = await POST(
      new Request('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    );
    const malformedResult = (await malformedResponse.json()) as { error?: string };

    assert.equal(malformedResponse.status, 400);
    assert.match(malformedResult.error ?? '', /invalid ticket payload/i);

    const invalidPriorityResponse = await POST(
      new Request('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: 'OptiPlex 360',
          employeeName: 'chakrit',
          employeeEmail: 'chakrit@car-1996.com',
          department: 'IT',
          problemType: 'Hardware Failure',
          description: 'No display after boot.',
          priority: 'Super High',
        }),
      })
    );
    const invalidPriorityResult = (await invalidPriorityResponse.json()) as { error?: string };

    assert.equal(invalidPriorityResponse.status, 400);
    assert.match(invalidPriorityResult.error ?? '', /priority must be Low, Medium, High, or Critical/i);
  } finally {
    setTicketNotificationDispatcherForTest(null);
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/tickets rejects non-string recipient overrides with 400', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-tickets-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  setTicketNotificationDispatcherForTest(() => undefined);

  try {
    const response = await POST(
      new Request('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: 'OptiPlex 360',
          employeeName: 'chakrit',
          employeeEmail: 'chakrit@car-1996.com',
          department: 'IT',
          problemType: 'Hardware Failure',
          description: 'No display after boot.',
          customerName: 123,
          notifyRecipients: ['customer'],
        }),
      })
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.match(result.error ?? '', /customerName|customerEmail/i);

    const listResponse = await GET();
    const listResult = (await listResponse.json()) as { tickets?: unknown[] };

    assert.deepEqual(listResult.tickets, []);
  } finally {
    setTicketNotificationDispatcherForTest(null);
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

function captureEnv(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Record<
    string,
    string | undefined
  >;
}

function clearEnv(keys: readonly string[]) {
  for (const key of keys) {
    delete process.env[key];
  }
}

function setEnvValue(key: string, value: string) {
  (process.env as Record<string, string | undefined>)[key] = value;
}

function restoreEnv(entries: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
