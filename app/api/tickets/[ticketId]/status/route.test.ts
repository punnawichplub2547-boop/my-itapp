import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import type { EmailJob } from '../../../../lib/notifications/notificationJobs';
import {
  createTicket,
  findTicketById,
  listTickets,
  resetDefaultTicketRepositoryForTest,
} from '../../../../lib/tickets/ticketService';

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

class FakeEmailQueue {
  jobs: EmailJob[] = [];

  enqueue(job: EmailJob) {
    this.jobs.push(job);
  }

  reset() {
    this.jobs = [];
  }
}

const notificationQueue = new FakeEmailQueue();
let routeModulePromise: Promise<typeof import('./route')> | null = null;

test('PATCH /api/tickets/[ticketId]/status persists the update and returns the saved ticket with history', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'PowerEdge R740',
      employeeName: 'mali',
      employeeEmail: ' MALI@car-1996.com ',
      department: 'Finance',
      problemType: 'Hardware Failure',
      description: 'PSU warning.',
    });
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          actorEmail: 'Admin@RepairLink.local',
          notifyRecipients: ['employee'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const result = (await response.json()) as {
      ticket?: { id?: string; status?: string; history?: Array<{ action?: string; user?: string }> };
      notificationEventsQueued?: number;
    };

    assert.equal(response.status, 200);
    assert.equal(result.ticket?.id, created.id);
    assert.equal(result.ticket?.status, 'In Progress');
    assert.equal(result.notificationEventsQueued, 1);
    assert.equal(result.ticket?.history?.length, (created.history?.length ?? 0) + 1);
    assert.equal(result.ticket?.history?.at(-1)?.action, 'Status Changed to In Progress');
    assert.equal(result.ticket?.history?.at(-1)?.user, 'admin@repairlink.local');

    const persisted = await findTicketById(created.id);
    const listed = await listTickets();

    assert.equal(persisted.status, 'In Progress');
    assert.equal(persisted.history?.length, result.ticket?.history?.length);
    assert.equal(result.ticket?.id, persisted.id);
    assert.equal(result.ticket?.status, persisted.status);
    assert.equal(result.ticket?.history?.at(-1)?.action, persisted.history?.at(-1)?.action);
    assert.equal(result.ticket?.history?.at(-1)?.user, persisted.history?.at(-1)?.user);
    assert.equal(listed[0]?.status, 'In Progress');
    assert.equal(notificationQueue.jobs.length, 1);
    assert.equal(notificationQueue.jobs[0]?.to, 'mali@car-1996.com');
    assert.equal(notificationQueue.jobs[0]?.metadata.ticketId, created.id);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status queues the default employee notification when notifyRecipients is omitted', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'EliteBook 840',
      employeeName: 'niran',
      employeeEmail: 'niran@example.com',
      department: 'Operations',
      problemType: 'Software Bug',
      description: 'Printer driver install fails.',
    });
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          actorEmail: 'admin@repairlink.local',
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const result = (await response.json()) as {
      ticket?: { status?: string };
      notificationEventsQueued?: number;
    };

    assert.equal(response.status, 200);
    assert.equal(result.ticket?.status, 'In Progress');
    assert.equal(result.notificationEventsQueued, 1);
    assert.equal(notificationQueue.jobs.length, 1);
    assert.equal(notificationQueue.jobs[0]?.to, 'niran@example.com');
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status falls back to the system actor for blank actorEmail', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'Latitude 5440',
      employeeName: 'ploy',
      employeeEmail: 'ploy@example.com',
      department: 'Admin',
      problemType: 'Software Bug',
      description: 'Outlook profile keeps resetting.',
    });
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          actorEmail: '   ',
          notifyRecipients: ['employee'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const result = (await response.json()) as {
      ticket?: { history?: Array<{ user?: string }> };
    };

    assert.equal(response.status, 200);
    assert.equal(result.ticket?.history?.at(-1)?.user, 'system@repairlink.local');
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status allows an explicit empty notifyRecipients list for status-only updates', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'Surface Laptop',
      employeeName: 'pim',
      employeeEmail: 'pim@example.com',
      department: 'HR',
      problemType: 'Software Bug',
      description: 'Teams sign-in loop.',
    });
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          actorEmail: 'admin@repairlink.local',
          notifyRecipients: [],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const result = (await response.json()) as {
      ticket?: { id?: string; status?: string; history?: Array<{ action?: string; user?: string }> };
      notificationEventsQueued?: number;
    };

    assert.equal(response.status, 200);
    assert.equal(result.ticket?.id, created.id);
    assert.equal(result.ticket?.status, 'In Progress');
    assert.equal(result.notificationEventsQueued, 0);
    assert.equal(result.ticket?.history?.at(-1)?.action, 'Status Changed to In Progress');
    assert.equal(result.ticket?.history?.at(-1)?.user, 'admin@repairlink.local');
    assert.equal(notificationQueue.jobs.length, 0);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status treats stale retries as idempotent using persisted status', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'ThinkPad X1',
      employeeName: 'suda',
      employeeEmail: 'suda@example.com',
      department: 'IT',
      problemType: 'Software Bug',
      description: 'VPN client keeps crashing.',
    });
    const { PATCH } = await loadRouteModule();

    const firstResponse = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          actorEmail: 'admin@repairlink.local',
          notifyRecipients: ['employee'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const firstResult = (await firstResponse.json()) as {
      ticket?: { history?: Array<{ action?: string }> };
      notificationEventsQueued?: number;
    };

    const retryResponse = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          actorEmail: 'admin@repairlink.local',
          notifyRecipients: ['employee'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const retryResult = (await retryResponse.json()) as {
      ticket?: { status?: string; history?: Array<{ action?: string }> };
      notificationEventsQueued?: number;
    };

    assert.equal(firstResponse.status, 200);
    assert.equal(firstResult.notificationEventsQueued, 1);
    assert.equal(retryResponse.status, 200);
    assert.equal(retryResult.ticket?.status, 'In Progress');
    assert.equal(retryResult.notificationEventsQueued, 0);
    assert.equal(
      retryResult.ticket?.history?.length,
      firstResult.ticket?.history?.length
    );
    assert.equal(notificationQueue.jobs.length, 1);

    const persisted = await findTicketById(created.id);
    assert.equal(persisted.history?.length, firstResult.ticket?.history?.length);
    assert.equal(
      persisted.history?.filter((entry) => entry.action === 'Status Changed to In Progress').length,
      1
    );
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status returns 409 for stale conflicting updates', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'ThinkCentre M70',
      employeeName: 'arta',
      employeeEmail: 'arta@example.com',
      department: 'Finance',
      problemType: 'Hardware Failure',
      description: 'SSD warning alert.',
    });
    const { PATCH } = await loadRouteModule();

    const firstResponse = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          actorEmail: 'admin@repairlink.local',
          notifyRecipients: ['employee'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );

    const conflictResponse = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'Completed',
          ticket: created,
          actorEmail: 'admin@repairlink.local',
          notifyRecipients: ['employee'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const conflictResult = (await conflictResponse.json()) as { error?: string };

    assert.equal(firstResponse.status, 200);
    assert.equal(conflictResponse.status, 409);
    assert.match(conflictResult.error ?? '', /stale|conflict|status/i);
    assert.equal(notificationQueue.jobs.length, 1);

    const persisted = await findTicketById(created.id);
    assert.equal(persisted.status, 'In Progress');
    assert.equal(
      persisted.history?.filter((entry) => entry.action === 'Status Changed to Completed').length,
      0
    );
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status returns 400 for malformed JSON', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request('http://localhost:3000/api/tickets/TK-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      { params: Promise.resolve({ ticketId: 'TK-1' }) }
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.match(result.error ?? '', /invalid ticket payload/i);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status returns 400 for a null JSON payload', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request('http://localhost:3000/api/tickets/TK-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      }),
      { params: Promise.resolve({ ticketId: 'TK-1' }) }
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.match(result.error ?? '', /invalid ticket payload/i);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status returns 400 for invalid payloads', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request('http://localhost:3000/api/tickets/TK-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'Broken',
          ticket: {
            id: 'TK-1',
            deviceName: 'Device',
            employeeName: 'user',
            employeeEmail: 'user@example.com',
            department: 'IT',
            problemType: 'Hardware Failure',
            description: 'Broken state.',
            status: 'Pending',
          },
        }),
      }),
      { params: Promise.resolve({ ticketId: 'TK-1' }) }
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.match(result.error ?? '', /previousStatus, nextStatus, and ticket are required/i);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status rejects non-string recipient overrides with 400', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'Dell Latitude 7440',
      employeeName: 'jane',
      employeeEmail: 'jane@example.com',
      department: 'Engineering',
      problemType: 'Hardware Failure',
      description: 'Dock disconnects intermittently.',
    });
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          customerName: 123,
          notifyRecipients: ['customer'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.match(result.error ?? '', /customerName|customerEmail/i);
    assert.equal(notificationQueue.jobs.length, 0);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status returns 400 when no valid recipients resolve', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const created = await createTicket({
      deviceName: 'MacBook Pro',
      employeeName: 'lee',
      employeeEmail: 'lee@example.com',
      department: 'Design',
      problemType: 'Software Bug',
      description: 'License activation failed.',
    });
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request(`http://localhost:3000/api/tickets/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'In Progress',
          ticket: created,
          customerEmail: 'not-an-email',
          notifyRecipients: ['customer'],
        }),
      }),
      { params: Promise.resolve({ ticketId: created.id }) }
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.match(result.error ?? '', /valid customer or employee recipient email/i);
    assert.equal(notificationQueue.jobs.length, 0);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('PATCH /api/tickets/[ticketId]/status returns 404 when the ticket does not exist', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'my-itapp-ticket-status-'));
  const storePath = join(tempDir, 'tickets.json');
  const originalEnv = captureEnv([...ENV_KEYS, ...DB_ENV_KEYS]);

  setEnvValue('NODE_ENV', 'test');
  setEnvValue('TICKET_DEMO_STORE_PATH', storePath);
  clearEnv(DB_ENV_KEYS);
  resetDefaultTicketRepositoryForTest();
  notificationQueue.reset();

  try {
    const { PATCH } = await loadRouteModule();

    const response = await PATCH(
      new Request('http://localhost:3000/api/tickets/TK-missing/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousStatus: 'Pending',
          nextStatus: 'Completed',
          ticket: {
            id: 'TK-missing',
            deviceName: 'Device',
            employeeName: 'user',
            employeeEmail: 'user@example.com',
            department: 'IT',
            problemType: 'Hardware Failure',
            description: 'Missing ticket.',
            status: 'Pending',
            priority: 'Medium',
            createdAt: '2026-05-12T00:00:00.000Z',
            notes: [],
            history: [],
            attachments: [],
          },
          actorEmail: 'admin@repairlink.local',
          notifyRecipients: ['employee'],
        }),
      }),
      { params: Promise.resolve({ ticketId: 'TK-missing' }) }
    );
    const result = (await response.json()) as { error?: string };

    assert.equal(response.status, 404);
    assert.match(result.error ?? '', /not found/i);
    assert.equal(notificationQueue.jobs.length, 0);
  } finally {
    resetDefaultTicketRepositoryForTest();
    restoreEnv(originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  }
});

async function loadRouteModule() {
  if (!routeModulePromise) {
    globalThis.repairLinkEmailQueue = notificationQueue as never;
    routeModulePromise = import('./route');
  }

  return routeModulePromise;
}

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
