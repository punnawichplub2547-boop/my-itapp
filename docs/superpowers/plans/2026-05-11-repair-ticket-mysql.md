# Repair Ticket MySQL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save `Create Repair Request` submissions to MySQL and make `Repair Status` render and update those persisted tickets instead of `MOCK_TICKETS`.

**Architecture:** Add a MySQL-first ticket service that mirrors the existing device service pattern, then route ticket creation and status updates through that shared service. Load tickets into `RepairLinkApp` shared state, keep the current `Repair Status` UI structure, and make create/status actions mutate the same saved ticket records.

**Tech Stack:** Next.js app routes, React 19, TypeScript, MySQL via `mysql2/promise`, Node test runner, `tsx`, and existing notification event helpers.

---

### Task 1: Add The Persisted Ticket Service Contract

**Files:**
- Create: `app/lib/tickets/ticketService.ts`
- Create: `app/lib/tickets/ticketService.test.ts`
- Modify: `app/types.ts`
- Create: `docs/repair-ticket-database.md`

- [ ] **Step 1: Write the failing service tests for persisted ticket create/list/status behavior**

Create `app/lib/tickets/ticketService.test.ts` with these baseline tests:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicket,
  listTickets,
  updateTicketStatus,
  type TicketRepository,
} from './ticketService';
import type { RepairTicket } from '../../types';

class InMemoryTicketRepository implements TicketRepository {
  tickets: RepairTicket[] = [];

  async create(ticket: RepairTicket) {
    this.tickets.push(ticket);
    return ticket;
  }

  async list() {
    return [...this.tickets];
  }

  async updateStatus(
    ticketId: string,
    nextStatus: RepairTicket['status'],
    history: RepairTicket['history']
  ) {
    const ticket = this.tickets.find((entry) => entry.id === ticketId);
    assert.ok(ticket);
    ticket.status = nextStatus;
    ticket.history = history ?? [];
    return ticket;
  }
}

test('creates a persisted repair ticket with pending status and history', async () => {
  const repository = new InMemoryTicketRepository();

  const ticket = await createTicket(
    {
      deviceName: 'OptiPlex 360',
      employeeName: 'chakrit',
      employeeEmail: 'chakrit@car-1996.com',
      department: 'IT',
      problemType: 'Hardware Failure',
      description: 'No display after boot.',
      priority: 'High',
    },
    repository
  );

  assert.match(ticket.id, /^TK-/);
  assert.equal(ticket.status, 'Pending');
  assert.equal(ticket.history?.[0]?.action, 'Ticket Created');
});

test('lists persisted tickets newest first', async () => {
  const repository = new InMemoryTicketRepository();

  await createTicket(
    {
      deviceName: 'Old Device',
      employeeName: 'old.user',
      employeeEmail: 'old.user@car-1996.com',
      department: 'IT',
      problemType: 'Maintenance',
      description: 'Needs cleanup.',
    },
    repository
  );

  const created = await createTicket(
    {
      deviceName: 'Newest Device',
      employeeName: 'new.user',
      employeeEmail: 'new.user@car-1996.com',
      department: 'Finance',
      problemType: 'Software Bug',
      description: 'App crashes.',
    },
    repository
  );

  const tickets = await listTickets(repository);

  assert.equal(tickets[0].id, created.id);
});

test('persists a status update and appends a history event', async () => {
  const repository = new InMemoryTicketRepository();
  const created = await createTicket(
    {
      deviceName: 'PowerEdge R740',
      employeeName: 'mali',
      employeeEmail: 'mali@car-1996.com',
      department: 'Finance',
      problemType: 'Hardware Failure',
      description: 'PSU warning.',
    },
    repository
  );

  const updated = await updateTicketStatus(created.id, 'In Progress', repository, 'admin@repairlink.local');

  assert.equal(updated.status, 'In Progress');
  assert.equal(updated.history?.at(-1)?.action, 'Status Changed to In Progress');
});
```

- [ ] **Step 2: Run the service tests to verify they fail because the service does not exist yet**

Run: `node --import tsx --test "app/lib/tickets/ticketService.test.ts"`

Expected: FAIL with module-not-found or missing-export errors for `ticketService.ts`.

- [ ] **Step 3: Add the shared ticket service and keep the type contract aligned**

Create `app/lib/tickets/ticketService.ts` around the existing `RepairTicket` type and the current DB helper in `app/lib/db/mysql.ts`.

Use this shape:

```ts
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDeviceDbPool } from '../db/mysql';
import type { RepairTicket } from '../../types';

export interface CreateTicketInput {
  deviceName: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  problemType: string;
  description: string;
  priority?: RepairTicket['priority'];
  actorEmail?: string;
}

export interface TicketRepository {
  create(ticket: RepairTicket): Promise<RepairTicket>;
  list(): Promise<RepairTicket[]>;
  findById(ticketId: string): Promise<RepairTicket>;
  updateStatus(
    ticketId: string,
    nextStatus: RepairTicket['status'],
    history: RepairTicket['history']
  ): Promise<RepairTicket>;
}

export async function createTicket(input: CreateTicketInput, repository = getDefaultTicketRepository()) {
  const ticket: RepairTicket = {
    id: `TK-${Date.now()}`,
    deviceName: input.deviceName.trim(),
    employeeName: input.employeeName.trim(),
    employeeEmail: input.employeeEmail.trim().toLowerCase(),
    department: input.department.trim(),
    problemType: input.problemType.trim(),
    description: input.description.trim(),
    status: 'Pending',
    priority: input.priority ?? 'Medium',
    createdAt: new Date().toISOString(),
    notes: [],
    history: [
      {
        id: crypto.randomUUID(),
        action: 'Ticket Created',
        user: input.actorEmail ?? 'system@repairlink.local',
        timestamp: new Date().toISOString(),
      },
    ],
    attachments: [],
  };

  return repository.create(ticket);
}

export async function listTickets(repository = getDefaultTicketRepository()) {
  return repository.list();
}

export async function updateTicketStatus(
  ticketId: string,
  nextStatus: RepairTicket['status'],
  repository = getDefaultTicketRepository(),
  actorEmail = 'system@repairlink.local'
) {
  const ticket = await repository.findById(ticketId);
  const nextHistory = [
    ...(ticket.history ?? []),
    {
      id: crypto.randomUUID(),
      action: `Status Changed to ${nextStatus}`,
      user: actorEmail,
      timestamp: new Date().toISOString(),
    },
  ];

  return repository.updateStatus(ticketId, nextStatus, nextHistory);
}
```

Also update `app/types.ts` only if needed to keep `RepairTicket`, `TicketNote`, and `TicketHistoryEvent` compatible with JSON persistence.

- [ ] **Step 4: Document the table needed for this service**

Create `docs/repair-ticket-database.md` with this SQL:

```sql
CREATE TABLE IF NOT EXISTS repair_tickets (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  device_name VARCHAR(200) NOT NULL,
  employee_name VARCHAR(160) NOT NULL,
  employee_email VARCHAR(200) NOT NULL,
  department VARCHAR(120) NOT NULL,
  problem_type VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('Pending', 'In Progress', 'Waiting for Parts', 'Completed', 'Closed') NOT NULL DEFAULT 'Pending',
  priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  created_at DATETIME NOT NULL,
  notes_json JSON NOT NULL,
  history_json JSON NOT NULL,
  attachments_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

- [ ] **Step 5: Run the service tests again and make them pass**

Run: `node --import tsx --test "app/lib/tickets/ticketService.test.ts"`

Expected: PASS for the three ticket-service tests.

- [ ] **Step 6: Commit**

```bash
git add app/lib/tickets/ticketService.ts app/lib/tickets/ticketService.test.ts app/types.ts docs/repair-ticket-database.md
git commit -m "feat: add repair ticket persistence service"
```

### Task 2: Persist Ticket Create And List API Routes

**Files:**
- Modify: `app/api/tickets/route.ts`
- Create: `app/api/tickets/route.test.ts`
- Modify: `app/lib/tickets/ticketService.ts`

- [ ] **Step 1: Write the failing route tests for GET and POST ticket persistence**

Create `app/api/tickets/route.test.ts` with these tests:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from './route';

test('POST /api/tickets returns 201 with a saved ticket payload', async () => {
  const request = new Request('http://localhost:3000/api/tickets', {
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
    }),
  });

  const response = await POST(request);
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.ticket.status, 'Pending');
  assert.equal(result.ticket.priority, 'High');
});

test('GET /api/tickets returns a tickets array', async () => {
  const response = await GET();
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(result.tickets));
});
```

- [ ] **Step 2: Run the route tests to verify they fail for the right reason**

Run: `node --import tsx --test "app/api/tickets/route.test.ts"`

Expected: FAIL because `GET` is missing and `POST` does not yet persist through the service.

- [ ] **Step 3: Wire `app/api/tickets/route.ts` through the new ticket service**

Refactor the route to import the service instead of constructing the final saved ticket inline:

```ts
import { after } from 'next/server';
import { createTicket, listTickets } from '../../lib/tickets/ticketService';
import { dispatchTicketNotificationEvent } from '../../lib/notifications/eventDispatcher';
import { buildNotificationRecipients, isValidEmail } from '../../lib/notifications/recipientRouting';
import { createTicketCreatedEvent } from '../../lib/notifications/ticketEvents';

export async function GET() {
  const tickets = await listTickets();
  return Response.json({ tickets });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateTicketRequest>;

  if (!isCreateTicketRequest(body)) {
    return Response.json(
      { error: 'deviceName, employeeName, employeeEmail, department, problemType, and description are required.' },
      { status: 400 }
    );
  }

  const ticket = await createTicket({
    deviceName: body.deviceName,
    employeeName: body.employeeName,
    employeeEmail: body.employeeEmail,
    department: body.department,
    problemType: body.problemType,
    description: body.description,
    priority: body.priority,
    actorEmail: body.actorEmail,
  });

  const recipients = buildNotificationRecipients({
    ticket,
    notifyRecipients: body.notifyRecipients,
    customerName: body.customerName,
    customerEmail: body.customerEmail,
  });

  after(() => {
    dispatchTicketNotificationEvent(
      createTicketCreatedEvent(ticket, body.actorEmail ?? 'system@repairlink.local', { recipients })
    );
  });

  return Response.json({ ticket }, { status: 201 });
}
```

- [ ] **Step 4: Run the route tests and notification pipeline tests**

Run: `node --import tsx --test "app/api/tickets/route.test.ts"`

Expected: PASS.

Run: `node --import tsx --test "app/lib/notifications/notificationPipeline.test.ts"`

Expected: PASS so notification behavior remains intact.

- [ ] **Step 5: Commit**

```bash
git add app/api/tickets/route.ts app/api/tickets/route.test.ts app/lib/tickets/ticketService.ts
git commit -m "feat: persist repair ticket creation and listing"
```

### Task 3: Persist Ticket Status Changes Through The Existing Status Route

**Files:**
- Modify: `app/api/tickets/[ticketId]/status/route.ts`
- Create: `app/api/tickets/[ticketId]/status/route.test.ts`
- Modify: `app/lib/tickets/ticketService.ts`

- [ ] **Step 1: Write the failing status-route test**

Create `app/api/tickets/[ticketId]/status/route.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { PATCH } from './route';

test('PATCH /api/tickets/[ticketId]/status persists the next status and history', async () => {
  const ticket = {
    id: 'TK-1001',
    deviceName: 'OptiPlex 360',
    employeeName: 'chakrit',
    employeeEmail: 'chakrit@car-1996.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'No display after boot.',
    status: 'Pending',
    priority: 'High',
    createdAt: '2026-05-11T10:00:00.000Z',
    notes: [],
    history: [
      {
        id: 'history-1',
        action: 'Ticket Created',
        user: 'admin@repairlink.local',
        timestamp: '2026-05-11T10:00:00.000Z',
      },
    ],
    attachments: [],
  };

  const request = new Request('http://localhost:3000/api/tickets/TK-1001/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      previousStatus: 'Pending',
      nextStatus: 'In Progress',
      ticket,
      actorEmail: 'admin@repairlink.local',
      notifyRecipients: ['employee'],
    }),
  });

  const response = await PATCH(request, { params: Promise.resolve({ ticketId: 'TK-1001' }) });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ticket.status, 'In Progress');
  assert.equal(result.ticket.history.at(-1).action, 'Status Changed to In Progress');
});
```

- [ ] **Step 2: Run the status-route test to verify it fails**

Run: `node --import tsx --test "app/api/tickets/[ticketId]/status/route.test.ts"`

Expected: FAIL because the route still mutates only the request payload and does not use persisted storage.

- [ ] **Step 3: Update the route and service to persist the status transition**

Extend the service to support a persisted status update with supplied history:

```ts
export interface TicketRepository {
  create(ticket: RepairTicket): Promise<RepairTicket>;
  list(): Promise<RepairTicket[]>;
  findById(ticketId: string): Promise<RepairTicket>;
  updateStatus(
    ticketId: string,
    nextStatus: RepairTicket['status'],
    history: RepairTicket['history']
  ): Promise<RepairTicket>;
}
```

Then refactor `app/api/tickets/[ticketId]/status/route.ts` to call that service:

```ts
import { after } from 'next/server';
import { updateTicketStatus } from '../../../../lib/tickets/ticketService';

const updatedTicket = await updateTicketStatus(
  ticketId,
  body.nextStatus,
  undefined,
  body.actorEmail ?? 'system@repairlink.local'
);
```

Keep the current notification event logic intact after the persisted update returns.

- [ ] **Step 4: Run the status route test and notification tests**

Run: `node --import tsx --test "app/api/tickets/[ticketId]/status/route.test.ts"`

Expected: PASS.

Run: `node --import tsx --test "app/lib/notifications/notificationPipeline.test.ts"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/tickets/[ticketId]/status/route.ts app/api/tickets/[ticketId]/status/route.test.ts app/lib/tickets/ticketService.ts
git commit -m "feat: persist repair ticket status updates"
```

### Task 4: Load Tickets Into Shared App State And Submit The Create Form

**Files:**
- Modify: `app/RepairLinkApp.tsx`
- Modify: `app/views/CreateRequestForm.tsx`
- Modify: `app/views/CreateRequestForm.test.ts`

- [ ] **Step 1: Write the failing create-form tests for API submit and Repair Status navigation**

Extend `app/views/CreateRequestForm.test.ts` with these expectations:

```ts
test('shows the inventory-backed repair priority options', () => {
  assert.deepEqual(REPAIR_PRIORITY_OPTIONS, ['Low', 'Medium', 'High', 'Critical']);
});

test('submits create-ticket payload to /api/tickets and returns to Repair Status on success', async () => {
  let captured: RequestInit | null = null;

  globalThis.fetch = async (_url, init) => {
    captured = init ?? null;
    return new Response(
      JSON.stringify({
        ticket: {
          id: 'TK-5555',
          deviceName: 'OptiPlex 360',
          employeeName: 'chakrit',
          employeeEmail: 'chakrit@car-1996.com',
          department: 'IT',
          problemType: 'Hardware Failure',
          description: 'No display after boot.',
          status: 'Pending',
          priority: 'High',
          createdAt: '2026-05-11T10:00:00.000Z',
          notes: [],
          history: [],
          attachments: [],
        },
      }),
      { status: 201 }
    );
  };

  assert.ok(captured);
  assert.match(String(captured?.body), /"deviceName":"OptiPlex 360"/);
});
```

- [ ] **Step 2: Run the create-form tests to verify they fail**

Run: `node --import tsx --test "app/views/CreateRequestForm.test.ts"`

Expected: FAIL because the form still does not submit to `/api/tickets` and `RepairLinkApp` has no shared ticket state.

- [ ] **Step 3: Load tickets in `RepairLinkApp` and pass handlers into the form**

Update `app/RepairLinkApp.tsx` to mirror the existing device load:

```ts
const [tickets, setTickets] = useState<RepairTicket[]>([]);

useEffect(() => {
  let cancelled = false;

  async function loadTickets() {
    try {
      const response = await fetch('/api/tickets');
      const result = await response.json();

      if (!response.ok || cancelled) {
        return;
      }

      setTickets(Array.isArray(result.tickets) ? result.tickets : []);
    } catch {
      if (!cancelled) {
        setTickets([]);
      }
    }
  }

  void loadTickets();
  return () => {
    cancelled = true;
  };
}, []);
```

Render the form like this:

```tsx
{currentView === 'create-request' && (
  <CreateRequestForm
    key="create-request"
    devices={devices}
    onBack={() => setCurrentView('dashboard')}
    onTicketCreated={(ticket) => {
      setTickets((currentTickets) => [ticket, ...currentTickets]);
      setSelectedTicketId(null);
      setCurrentView('tickets');
    }}
  />
)}
```

- [ ] **Step 4: Submit real data from `CreateRequestForm`**

Add local form state and submit behavior in `app/views/CreateRequestForm.tsx`:

```ts
const [error, setError] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError('');
  setIsSubmitting(true);

  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceName: deviceModel,
        employeeName: assignedTo,
        employeeEmail,
        department,
        problemType,
        description,
        priority,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? 'Unable to create the repair ticket.');
      return;
    }

    onTicketCreated?.(result.ticket);
  } catch {
    setError('Unable to reach the repair ticket API.');
  } finally {
    setIsSubmitting(false);
  }
}
```

Wrap the main ticket card in `<form onSubmit={handleSubmit}>` and keep the current layout classes.

- [ ] **Step 5: Run the create-form tests and app tests**

Run: `node --import tsx --test "app/views/CreateRequestForm.test.ts"`

Expected: PASS.

Run: `npm.cmd test`

Expected: PASS with the new ticket tests included.

- [ ] **Step 6: Commit**

```bash
git add app/RepairLinkApp.tsx app/views/CreateRequestForm.tsx app/views/CreateRequestForm.test.ts
git commit -m "feat: submit repair requests into shared ticket state"
```

### Task 5: Replace `MOCK_TICKETS` In Repair Status And Wire Real Status Buttons

**Files:**
- Modify: `app/views/TicketManagementCenter.tsx`
- Create: `app/views/TicketManagementCenter.test.ts`
- Modify: `app/RepairLinkApp.tsx`

- [ ] **Step 1: Write the failing Repair Status tests against real ticket props**

Create `app/views/TicketManagementCenter.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TicketManagementCenter from './TicketManagementCenter';
import type { RepairTicket } from '../types';

const TICKETS: RepairTicket[] = [
  {
    id: 'TK-5555',
    deviceName: 'OptiPlex 360',
    employeeName: 'chakrit',
    employeeEmail: 'chakrit@car-1996.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'No display after boot.',
    status: 'Pending',
    priority: 'High',
    createdAt: '2026-05-11T10:00:00.000Z',
    notes: [],
    history: [],
    attachments: [],
  },
];

test('renders passed-in tickets instead of MOCK_TICKETS', () => {
  const markup = renderToStaticMarkup(
    React.createElement(TicketManagementCenter, {
      tickets: TICKETS,
      selectedId: null,
      onSelectTicket: () => undefined,
      onTicketUpdated: () => undefined,
    })
  );

  assert.match(markup, /TK-5555/);
  assert.match(markup, /OptiPlex 360/);
});
```

- [ ] **Step 2: Run the Repair Status test to verify it fails**

Run: `node --import tsx --test "app/views/TicketManagementCenter.test.ts"`

Expected: FAIL because the component still imports and renders `MOCK_TICKETS`.

- [ ] **Step 3: Refactor `TicketManagementCenter` to consume shared tickets and update status**

Change the component signature:

```ts
export default function TicketManagementCenter({
  tickets,
  selectedId,
  onSelectTicket,
  onTicketUpdated,
}: {
  tickets: RepairTicket[];
  selectedId: string | null;
  onSelectTicket: (id: string | null) => void;
  onTicketUpdated?: (ticket: RepairTicket) => void;
}) {
```

Replace `MOCK_TICKETS` reads with the passed `tickets`.

Inside `TicketDetailModal`, add a persisted status update action:

```ts
async function handleStatusChange(nextStatus: RepairTicket['status']) {
  if (nextStatus === ticket.status) {
    return;
  }

  const response = await fetch(`/api/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      previousStatus: ticket.status,
      nextStatus,
      ticket,
      notifyRecipients: ['employee'],
    }),
  });

  const result = await response.json();

  if (response.ok) {
    onTicketUpdated?.(result.ticket);
  }
}
```

Wire the existing quick-status buttons to `handleStatusChange`.

- [ ] **Step 4: Update `RepairLinkApp` to pass real tickets and an update callback**

Render the page like this:

```tsx
{currentView === 'tickets' && (
  <TicketManagementCenter
    key="tickets"
    tickets={tickets}
    selectedId={selectedTicketId}
    onSelectTicket={setSelectedTicketId}
    onTicketUpdated={(updatedTicket) => {
      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket.id === updatedTicket.id ? updatedTicket : ticket
        )
      );
    }}
  />
)}
```

- [ ] **Step 5: Run the Repair Status tests and the full suite**

Run: `node --import tsx --test "app/views/TicketManagementCenter.test.ts"`

Expected: PASS.

Run: `npm.cmd test`

Expected: PASS with create-form, ticket route, ticket status, and Repair Status tests all green.

- [ ] **Step 6: Commit**

```bash
git add app/views/TicketManagementCenter.tsx app/views/TicketManagementCenter.test.ts app/RepairLinkApp.tsx
git commit -m "feat: drive repair status from persisted tickets"
```

### Task 6: Final Verification And Manual DB Checks

**Files:**
- Modify: `docs/repair-ticket-database.md` (only if verification exposes a schema mismatch)

- [ ] **Step 1: Run the full automated verification set**

Run: `npm.cmd test`

Expected: PASS with all test files green.

Run: `npx.cmd tsc --noEmit`

Expected: PASS, or if the pre-existing `NODE_ENV` test-file issue still exists, record it as unchanged and do not conflate it with this feature.

- [ ] **Step 2: Verify the MySQL table and app behavior manually**

Run this SQL in MySQL Workbench:

```sql
USE repairlink;
SELECT id, device_name, employee_name, department, status, priority
FROM repair_tickets
ORDER BY created_at DESC
LIMIT 20;
```

Expected: newly created repair tickets appear with `Pending` default status.

Then run the app:

```bash
npm run dev
```

Manual checks:

- Create a repair request from `Create Repair Request`.
- Confirm the app navigates to `Repair Status`.
- Confirm the new ticket appears in the list without auto-opening the modal.
- Open the ticket and click `In Progress`.
- Refresh the page and confirm the updated status is still shown.

- [ ] **Step 3: Commit any final doc/schema touch-ups**

```bash
git add docs/repair-ticket-database.md
git commit -m "docs: finalize repair ticket mysql verification notes"
```
