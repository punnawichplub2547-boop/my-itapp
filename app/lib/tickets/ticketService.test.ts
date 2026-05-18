import assert from 'node:assert/strict';
import test from 'node:test';

import type { RepairTicket, TicketNote } from '../../types';
import {
  MySqlTicketRepository,
  createTicket,
  findTicketById,
  listTickets,
  TicketStatusConflictError,
  TicketValidationError,
  transitionTicketStatusWithActor,
  updateTicketStatus,
  TicketNotFoundError,
  type TicketRepository,
} from './ticketService';

class InMemoryTicketRepository implements TicketRepository {
  tickets: RepairTicket[] = [];

  async create(ticket: RepairTicket) {
    this.tickets.push(ticket);
    return ticket;
  }

  async list() {
    return [...this.tickets];
  }

  async findById(ticketId: string) {
    const ticket = this.tickets.find((entry) => entry.id === ticketId);

    assert.ok(ticket, `Expected ticket ${ticketId} to exist`);
    return ticket;
  }

  async updateStatus(
    ticketId: string,
    nextStatus: RepairTicket['status'],
    history: RepairTicket['history']
  ) {
    const ticket = this.tickets.find((entry) => entry.id === ticketId);

    assert.ok(ticket, `Expected ticket ${ticketId} to exist`);
    ticket.status = nextStatus;
    ticket.history = history ?? [];
    return ticket;
  }

  async transitionStatus(
    ticketId: string,
    expectedPreviousStatus: RepairTicket['status'],
    nextStatus: RepairTicket['status'],
    actorEmail: string
  ) {
    const ticket = this.tickets.find((entry) => entry.id === ticketId);

    assert.ok(ticket, `Expected ticket ${ticketId} to exist`);

    if (ticket.status === nextStatus) {
      return { ticket, changed: false };
    }

    if (ticket.status !== expectedPreviousStatus) {
      throw new TicketStatusConflictError(ticketId, expectedPreviousStatus, ticket.status);
    }

    ticket.status = nextStatus;
    ticket.history = [
      ...(ticket.history ?? []),
      {
        id: `history-${(ticket.history?.length ?? 0) + 1}`,
        action: `Status Changed to ${nextStatus}`,
        user: actorEmail,
        timestamp: '2026-05-11T11:00:00.000Z',
      },
    ];

    return { ticket, changed: true };
  }

  async addNote(ticketId: string, note: TicketNote) {
    const ticket = this.tickets.find((entry) => entry.id === ticketId);
    assert.ok(ticket, `Expected ticket ${ticketId} to exist`);
    ticket.notes = [...(ticket.notes ?? []), note];
    ticket.history = [
      ...(ticket.history ?? []),
      { id: `note-hist-${ticket.notes.length}`, action: 'Note Added', user: note.author, timestamp: note.timestamp },
    ];
    return ticket;
  }

  async deleteById(ticketId: string) {
    const index = this.tickets.findIndex((entry) => entry.id === ticketId);
    assert.ok(index !== -1, `Expected ticket ${ticketId} to exist`);
    this.tickets.splice(index, 1);
  }

  async listCompletedWithin() {
    return [];
  }

  async deleteCompletedOlderThan() {
    return 0;
  }
}

class FakeTransactionConnection {
  queries: Array<{ sql: string; params?: unknown[] }> = [];
  executeCalls: Array<{ sql: string; params?: unknown[] }> = [];
  began = false;
  committed = false;
  rolledBack = false;
  released = false;
  row: RepairTicket | null = null;
  createdAtValue: Date | string = '2026-05-11 10:00:00';

  constructor(row?: RepairTicket) {
    this.row = row ?? null;
  }

  async beginTransaction() {
    this.began = true;
  }

  async commit() {
    this.committed = true;
  }

  async rollback() {
    this.rolledBack = true;
  }

  release() {
    this.released = true;
  }

  async query(sql: string, params?: unknown[]) {
    this.queries.push({ sql, params });

    if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
      return [
        [
          {
            id: this.row?.id ?? 'TK-1',
            device_name: this.row?.deviceName ?? 'OptiPlex 360',
            employee_name: this.row?.employeeName ?? 'chakrit',
            employee_email: this.row?.employeeEmail ?? 'chakrit@car-1996.com',
            department: this.row?.department ?? 'IT',
            problem_type: this.row?.problemType ?? 'Hardware Failure',
            description: this.row?.description ?? 'No display after boot.',
            status: this.row?.status ?? 'Pending',
            priority: this.row?.priority ?? 'High',
            created_at: this.createdAtValue,
            notes_json: '[]',
            history_json: JSON.stringify(this.row?.history ?? []),
            attachments_json: '[]',
            updated_at: this.createdAtValue,
          },
        ],
      ];
    }

    if (sql.startsWith('SELECT')) {
      return [[this.rowToRowData(this.row)]];
    }

    return [[]];
  }

  async execute(sql: string, params?: unknown[]) {
    this.executeCalls.push({ sql, params });

    if (sql.startsWith('INSERT')) {
      this.row = {
        id: String(params?.[0] ?? 'TK-1'),
        deviceName: String(params?.[1] ?? 'OptiPlex 360'),
        employeeName: String(params?.[2] ?? 'chakrit'),
        employeeEmail: String(params?.[3] ?? 'chakrit@car-1996.com'),
        department: String(params?.[4] ?? 'IT'),
        problemType: String(params?.[5] ?? 'Hardware Failure'),
        description: String(params?.[6] ?? 'No display after boot.'),
        status: String(params?.[7] ?? 'Pending') as RepairTicket['status'],
        priority: String(params?.[8] ?? 'High') as RepairTicket['priority'],
        createdAt: '2026-05-11T10:00:00.000Z',
        notes: [],
        history: [],
        attachments: [],
      };
      this.createdAtValue = '2026-05-11 10:00:00';
      return [{ affectedRows: 1 }];
    }

    if (sql.startsWith('UPDATE')) {
      if (this.row) {
        this.row = {
          ...this.row,
          status: String(params?.[0] ?? this.row.status) as RepairTicket['status'],
          history: JSON.parse(String(params?.[1] ?? '[]')) as RepairTicket['history'],
        };
      }
      return [{ affectedRows: 1 }];
    }

    return [{ affectedRows: 0 }];
  }

  private rowToRowData(row: RepairTicket | null) {
    const ticket = row ?? {
      id: 'TK-1',
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
    };

    return {
      id: ticket.id,
      device_name: ticket.deviceName,
      employee_name: ticket.employeeName,
      employee_email: ticket.employeeEmail,
      department: ticket.department,
      problem_type: ticket.problemType,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      created_at: this.createdAtValue,
      notes_json: JSON.stringify(ticket.notes ?? []),
      history_json: JSON.stringify(ticket.history ?? []),
      attachments_json: JSON.stringify(ticket.attachments ?? []),
      updated_at: this.createdAtValue,
    };
  }
}

class FakePool {
  connection: FakeTransactionConnection;

  constructor(connection: FakeTransactionConnection) {
    this.connection = connection;
  }

  async execute(sql: string, params?: unknown[]) {
    return this.connection.execute(sql, params);
  }

  async query(sql: string, params?: unknown[]) {
    return this.connection.query(sql, params);
  }

  async getConnection() {
    return this.connection;
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
  assert.equal(ticket.history?.[0]?.user, 'system@repairlink.local');
});

test('creates ticket ids with a safer unique suffix than Date.now alone', async () => {
  const repository = new InMemoryTicketRepository();

  const first = await createTicket(
    {
      deviceName: 'Device A',
      employeeName: 'user a',
      employeeEmail: 'a@example.com',
      department: 'IT',
      problemType: 'Hardware Failure',
      description: 'A.',
    },
    repository
  );
  const second = await createTicket(
    {
      deviceName: 'Device B',
      employeeName: 'user b',
      employeeEmail: 'b@example.com',
      department: 'IT',
      problemType: 'Hardware Failure',
      description: 'B.',
    },
    repository
  );

  assert.match(first.id, /^TK-/);
  assert.match(second.id, /^TK-/);
  assert.notEqual(first.id, second.id);
});

test('rejects missing required ticket fields and invalid priority', async () => {
  const repository = new InMemoryTicketRepository();

  await assert.rejects(
    () =>
      createTicket(
        {
          deviceName: '',
          employeeName: 'user',
          employeeEmail: 'user@example.com',
          department: 'IT',
          problemType: 'Hardware Failure',
          description: 'Missing device.',
        },
        repository
      ),
    TicketValidationError
  );

  await assert.rejects(
    () =>
      createTicket(
        {
          deviceName: 'Device',
          employeeName: 'user',
          employeeEmail: 'user@example.com',
          department: 'IT',
          problemType: 'Hardware Failure',
          description: 'Bad priority.',
          priority: 'Urgent' as RepairTicket['priority'],
        },
        repository
      ),
    TicketValidationError
  );
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

  repository.tickets[0].createdAt = '2026-05-10T10:00:00.000Z';
  repository.tickets[1].createdAt = '2026-05-11T10:00:00.000Z';

  const tickets = await listTickets(repository);

  assert.equal(tickets[0].id, created.id);
});

test('finds a persisted ticket through the exported service helper', async () => {
  const repository = new InMemoryTicketRepository();
  const created = await createTicket(
    {
      deviceName: 'Searchable Device',
      employeeName: 'search.user',
      employeeEmail: 'search.user@car-1996.com',
      department: 'IT',
      problemType: 'Maintenance',
      description: 'Needs lookup.',
    },
    repository
  );

  const ticket = await findTicketById(created.id, repository);

  assert.equal(ticket.id, created.id);
  assert.equal(ticket.deviceName, 'Searchable Device');
});

test('rejects missing tickets through the exported service helper', async () => {
  const repository: TicketRepository = {
    async create(ticket) {
      return ticket;
    },
    async list() {
      return [];
    },
    async findById(ticketId: string) {
      throw new TicketNotFoundError(ticketId);
    },
    async updateStatus(ticketId: string) {
      throw new TicketNotFoundError(ticketId);
    },
    async transitionStatus(ticketId: string) {
      throw new TicketNotFoundError(ticketId);
    },
    async addNote(ticketId: string) {
      throw new TicketNotFoundError(ticketId);
    },
    async deleteById(ticketId: string) {
      throw new TicketNotFoundError(ticketId);
    },
    async listCompletedWithin() {
      return [];
    },
    async deleteCompletedOlderThan() {
      return 0;
    },
  };

  await assert.rejects(() => findTicketById('TK-missing', repository), TicketNotFoundError);
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

  const history = [
    ...(created.history ?? []),
    {
      id: 'history-2',
      action: 'Status Changed to In Progress',
      user: 'admin@repairlink.local',
      timestamp: '2026-05-11T11:00:00.000Z',
    },
  ];

  const updated = await updateTicketStatus(created.id, 'In Progress', history, repository);

  assert.equal(updated.status, 'In Progress');
  assert.equal(updated.history?.at(-1)?.action, 'Status Changed to In Progress');
});

test('transitionTicketStatusWithActor rejects stale conflicting updates without mutating state', async () => {
  const repository = new InMemoryTicketRepository();
  const created = await createTicket(
    {
      deviceName: 'ThinkCentre M70',
      employeeName: 'arta',
      employeeEmail: 'arta@example.com',
      department: 'Finance',
      problemType: 'Hardware Failure',
      description: 'SSD warning alert.',
    },
    repository
  );

  const first = await transitionTicketStatusWithActor(
    created.id,
    'In Progress',
    'Pending',
    repository,
    'admin@repairlink.local'
  );

  await assert.rejects(
    () =>
      transitionTicketStatusWithActor(
        created.id,
        'Completed',
        'Pending',
        repository,
        'admin@repairlink.local'
      ),
    TicketStatusConflictError
  );

  assert.equal(first.changed, true);
  assert.equal(repository.tickets[0].status, 'In Progress');
  assert.equal(
    repository.tickets[0].history?.filter((entry) => entry.action === 'Status Changed to Completed')
      .length,
    0
  );
});

test('transitionTicketStatusWithActor keeps same-status retries idempotent', async () => {
  const repository = new InMemoryTicketRepository();
  const created = await createTicket(
    {
      deviceName: 'ThinkPad X1',
      employeeName: 'suda',
      employeeEmail: 'suda@example.com',
      department: 'IT',
      problemType: 'Software Bug',
      description: 'VPN client keeps crashing.',
    },
    repository
  );

  const first = await transitionTicketStatusWithActor(
    created.id,
    'In Progress',
    'Pending',
    repository,
    'admin@repairlink.local'
  );
  const retry = await transitionTicketStatusWithActor(
    created.id,
    'In Progress',
    'Pending',
    repository,
    'admin@repairlink.local'
  );

  assert.equal(first.changed, true);
  assert.equal(retry.changed, false);
  assert.equal(repository.tickets[0].status, 'In Progress');
  assert.equal(
    repository.tickets[0].history?.filter((entry) => entry.action === 'Status Changed to In Progress')
      .length,
    1
  );
});

test('rejects invalid status updates at runtime', async () => {
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

  await assert.rejects(
    () =>
      updateTicketStatus(
        created.id,
        'Broken' as RepairTicket['status'],
        created.history ?? [],
        repository
      ),
    TicketValidationError
  );
});

test('uses a UTC-safe created_at value and transaction locking for mysql updates', async () => {
  const connection = new FakeTransactionConnection();
  const repository = new MySqlTicketRepository(new FakePool(connection) as never);

  const created = await repository.create({
    id: 'TK-999',
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
  });

  assert.equal(connection.executeCalls[0]?.sql.startsWith('INSERT INTO repair_tickets'), true);
  assert.match(String(connection.executeCalls[0]?.params?.[9]), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2}T/);

  connection.row = {
    ...connection.row!,
    history: [
      {
        id: 'history-1',
        action: 'Ticket Created',
        user: 'system@repairlink.local',
        timestamp: '2026-05-11T10:00:00.000Z',
      },
    ],
  };
  connection.createdAtValue = '2026-05-11 10:00:00';

  const history = [
    {
      id: 'history-1',
      action: 'Ticket Created',
      user: 'system@repairlink.local',
      timestamp: '2026-05-11T10:00:00.000Z',
    },
    {
      id: 'history-2',
      action: 'Status Changed to Completed',
      user: 'admin@repairlink.local',
      timestamp: '2026-05-11T11:00:00.000Z',
    },
  ];

  const updated = await updateTicketStatus(created.id, 'Completed', history, repository);

  assert.equal(connection.began, true);
  assert.equal(connection.committed, true);
  assert.equal(connection.released, true);
  assert.ok(connection.queries.some((entry) => entry.sql.includes('FOR UPDATE')));
  assert.equal(updated.status, 'Completed');
  assert.deepEqual(updated.history, [
    {
      id: 'history-1',
      action: 'Ticket Created',
      user: 'system@repairlink.local',
      timestamp: '2026-05-11T10:00:00.000Z',
    },
    {
      id: 'history-2',
      action: 'Status Changed to Completed',
      user: 'admin@repairlink.local',
      timestamp: '2026-05-11T11:00:00.000Z',
    },
  ]);
});

test('mysql transition status enforces expected previous status atomically', async () => {
  const connection = new FakeTransactionConnection({
    id: 'TK-2000',
    deviceName: 'Conflict Device',
    employeeName: 'conflict.user',
    employeeEmail: 'conflict.user@car-1996.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'Conflict row.',
    status: 'In Progress',
    priority: 'Medium',
    createdAt: '2026-05-11T10:00:00.000Z',
    notes: [],
    history: [
      {
        id: 'history-1',
        action: 'Ticket Created',
        user: 'system@repairlink.local',
        timestamp: '2026-05-11T10:00:00.000Z',
      },
    ],
    attachments: [],
  });
  const repository = new MySqlTicketRepository(new FakePool(connection) as never);

  await assert.rejects(
    () =>
      repository.transitionStatus(
        'TK-2000',
        'Pending',
        'Completed',
        'admin@repairlink.local'
      ),
    TicketStatusConflictError
  );

  assert.equal(connection.began, true);
  assert.equal(connection.rolledBack, true);
  assert.equal(connection.committed, false);
  assert.equal(
    connection.executeCalls.some((entry) => entry.sql.startsWith('UPDATE repair_tickets')),
    false
  );
});

test('mysql transition status returns the row it wrote without a post-commit re-read', async () => {
  const connection = new FakeTransactionConnection({
    id: 'TK-3000',
    deviceName: 'Atomic Device',
    employeeName: 'atomic.user',
    employeeEmail: 'atomic.user@car-1996.com',
    department: 'IT',
    problemType: 'Software Bug',
    description: 'Atomic update row.',
    status: 'Pending',
    priority: 'Medium',
    createdAt: '2026-05-11T10:00:00.000Z',
    notes: [],
    history: [
      {
        id: 'history-1',
        action: 'Ticket Created',
        user: 'system@repairlink.local',
        timestamp: '2026-05-11T10:00:00.000Z',
      },
    ],
    attachments: [],
  });
  const repository = new MySqlTicketRepository(new FakePool(connection) as never);

  const transition = await repository.transitionStatus(
    'TK-3000',
    'Pending',
    'In Progress',
    'admin@repairlink.local'
  );

  assert.equal(transition.changed, true);
  assert.equal(transition.ticket.status, 'In Progress');
  assert.equal(
    transition.ticket.history?.at(-1)?.action,
    'Status Changed to In Progress'
  );
  assert.equal(connection.committed, true);
  assert.equal(
    connection.queries.filter(
      (entry) => entry.sql.startsWith('SELECT') && !entry.sql.includes('FOR UPDATE')
    ).length,
    0
  );
});

test('maps mysql created_at values to ISO strings for both Date and DATETIME rows', async () => {
  const dateConnection = new FakeTransactionConnection({
    id: 'TK-1000',
    deviceName: 'Date Device',
    employeeName: 'date.user',
    employeeEmail: 'date.user@car-1996.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'Date row.',
    status: 'Pending',
    priority: 'Medium',
    createdAt: '2026-05-11T10:00:00.000Z',
    notes: [],
    history: [],
    attachments: [],
  });
  dateConnection.createdAtValue = new Date('2026-05-11T10:00:00.000Z');

  const stringConnection = new FakeTransactionConnection({
    id: 'TK-1001',
    deviceName: 'String Device',
    employeeName: 'string.user',
    employeeEmail: 'string.user@car-1996.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'String row.',
    status: 'Pending',
    priority: 'Medium',
    createdAt: '2026-05-11T10:00:00.000Z',
    notes: [],
    history: [],
    attachments: [],
  });
  stringConnection.createdAtValue = '2026-05-11 10:00:00';

  const dateRepository = new MySqlTicketRepository(new FakePool(dateConnection) as never);
  const stringRepository = new MySqlTicketRepository(new FakePool(stringConnection) as never);

  const dateTicket = await dateRepository.findById('TK-1000');
  const stringTicket = await stringRepository.findById('TK-1001');

  assert.equal(dateTicket.createdAt, '2026-05-11T10:00:00.000Z');
  assert.equal(stringTicket.createdAt, '2026-05-11T10:00:00.000Z');
});
