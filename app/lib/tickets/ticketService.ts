import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ExecuteValues,
  FieldPacket,
  Pool,
  PoolConnection,
  QueryOptions,
  QueryResult,
  QueryValues,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { getDeviceDbPool } from '../db/mysql';
import type {
  RepairTicket,
  TicketAttachment,
  TicketHistoryEvent,
  TicketNote,
} from '../../types';

export interface CreateTicketInput {
  deviceId?: string;
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
  transitionStatus(
    ticketId: string,
    expectedPreviousStatus: RepairTicket['status'],
    nextStatus: RepairTicket['status'],
    actorEmail: string
  ): Promise<{ ticket: RepairTicket; changed: boolean }>;
  addNote(ticketId: string, note: TicketNote): Promise<RepairTicket>;
  addAttachment(ticketId: string, attachment: TicketAttachment): Promise<RepairTicket>;
  removeAttachment(
    ticketId: string,
    attachmentId: string
  ): Promise<{ ticket: RepairTicket; removed: TicketAttachment | null }>;
  deleteById(ticketId: string): Promise<void>;
  listCompletedWithin(days: number): Promise<RepairTicket[]>;
  deleteCompletedOlderThan(days: number): Promise<number>;
}

interface TicketStore {
  tickets: RepairTicket[];
}

interface TicketRow extends RowDataPacket {
  id: number | string;
  device_id: string | null;
  device_name: string;
  employee_name: string;
  employee_email: string;
  department: string;
  problem_type: string;
  description: string;
  status: string;
  priority: string;
  created_at: Date | string | null;
  notes_json: string | null;
  history_json: string | null;
  attachments_json: string | null;
  updated_at: Date | string | null;
  completed_at: Date | string | null;
}

export interface TicketDbConnectionLike
  extends Pick<PoolConnection, 'beginTransaction' | 'commit' | 'rollback' | 'release'> {
  query<T extends QueryResult>(sql: string, values?: QueryValues): Promise<[T, FieldPacket[]]>;
  query<T extends QueryResult>(
    options: QueryOptions,
    values?: QueryValues
  ): Promise<[T, FieldPacket[]]>;
  execute<T extends QueryResult>(sql: string, values?: ExecuteValues): Promise<[T, FieldPacket[]]>;
  execute<T extends QueryResult>(
    options: QueryOptions,
    values?: ExecuteValues
  ): Promise<[T, FieldPacket[]]>;
}

export interface TicketDbPoolLike extends Pick<Pool, 'query' | 'execute'> {
  getConnection(): Promise<TicketDbConnectionLike>;
}

let defaultRepository: TicketRepository | null = null;

export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketValidationError';
  }
}

export class TicketNotFoundError extends Error {
  constructor(ticketId: string) {
    super(`Ticket ${ticketId} was not found.`);
    this.name = 'TicketNotFoundError';
  }
}

export class TicketDatabaseConfigurationError extends Error {
  constructor() {
    super('Database connection is not configured.');
    this.name = 'TicketDatabaseConfigurationError';
  }
}

export class TicketStatusConflictError extends Error {
  readonly expectedPreviousStatus: RepairTicket['status'];
  readonly actualStatus: RepairTicket['status'];

  constructor(
    ticketId: string,
    expectedPreviousStatus: RepairTicket['status'],
    actualStatus: RepairTicket['status']
  ) {
    super(
      `Ticket ${ticketId} status conflict: expected ${expectedPreviousStatus}, found ${actualStatus}.`
    );
    this.name = 'TicketStatusConflictError';
    this.expectedPreviousStatus = expectedPreviousStatus;
    this.actualStatus = actualStatus;
  }
}

export async function createTicket(
  input: unknown,
  repository: TicketRepository = getDefaultTicketRepository()
) {
  const normalizedInput = normalizeCreateTicketInput(input);
  const now = new Date();
  const ticket: RepairTicket = {
    id: generateTicketId(),
    deviceId: normalizedInput.deviceId,
    deviceName: normalizedInput.deviceName,
    employeeName: normalizedInput.employeeName,
    employeeEmail: normalizedInput.employeeEmail,
    department: normalizedInput.department,
    problemType: normalizedInput.problemType,
    description: normalizedInput.description,
    status: 'Pending',
    priority: normalizedInput.priority,
    createdAt: now.toISOString(),
    notes: [],
    history: [
      {
        id: randomUUID(),
        action: 'Ticket Created',
        user: normalizedInput.actorEmail,
        timestamp: now.toISOString(),
      },
    ],
    attachments: [],
  };

  return repository.create(ticket);
}

export async function listTickets(repository: TicketRepository = getDefaultTicketRepository()) {
  const tickets = await repository.list();
  return [...tickets].sort(compareTicketsByCreatedAtDesc);
}

export async function findTicketById(
  ticketId: string,
  repository: TicketRepository = getDefaultTicketRepository()
) {
  return repository.findById(normalizeTicketId(ticketId));
}

export async function updateTicketStatus(
  ticketId: string,
  nextStatus: unknown,
  history: RepairTicket['history'],
  repository: TicketRepository = getDefaultTicketRepository()
) {
  const normalizedStatus = normalizeTicketStatus(nextStatus);
  const normalizedHistory = normalizeHistoryInput(history);

  return repository.updateStatus(normalizeTicketId(ticketId), normalizedStatus, normalizedHistory);
}

export async function updateTicketStatusWithActor(
  ticketId: string,
  nextStatus: unknown,
  repository: TicketRepository = getDefaultTicketRepository(),
  actorEmail = 'system@repairlink.local'
) {
  const ticket = await findTicketById(ticketId, repository);
  const nextHistory = [
    ...(ticket.history ?? []),
    {
      id: randomUUID(),
      action: `Status Changed to ${normalizeTicketStatus(nextStatus)}`,
      user: normalizeEmail(actorEmail),
      timestamp: new Date().toISOString(),
    },
  ];

  return updateTicketStatus(ticketId, nextStatus, nextHistory, repository);
}

export async function transitionTicketStatusWithActor(
  ticketId: string,
  nextStatus: unknown,
  expectedPreviousStatus: unknown,
  repository: TicketRepository = getDefaultTicketRepository(),
  actorEmail = 'system@repairlink.local'
) {
  return repository.transitionStatus(
    normalizeTicketId(ticketId),
    normalizeTicketStatus(expectedPreviousStatus),
    normalizeTicketStatus(nextStatus),
    normalizeEmail(actorEmail)
  );
}

export async function addTicketNote(
  ticketId: string,
  content: string,
  authorEmail = 'admin@repairlink.local',
  repository: TicketRepository = getDefaultTicketRepository()
): Promise<RepairTicket> {
  const normalized = content.trim();

  if (!normalized) {
    throw new TicketValidationError('Note content is required.');
  }

  const note: TicketNote = {
    id: randomUUID(),
    author: normalizeEmail(authorEmail),
    content: normalized,
    timestamp: new Date().toISOString(),
  };

  return repository.addNote(normalizeTicketId(ticketId), note);
}

export async function deleteTicketById(
  ticketId: string,
  repository: TicketRepository = getDefaultTicketRepository()
): Promise<void> {
  return repository.deleteById(normalizeTicketId(ticketId));
}

export async function addTicketAttachment(
  ticketId: string,
  attachment: TicketAttachment,
  repository: TicketRepository = getDefaultTicketRepository()
): Promise<RepairTicket> {
  return repository.addAttachment(normalizeTicketId(ticketId), attachment);
}

export async function removeTicketAttachment(
  ticketId: string,
  attachmentId: string,
  repository: TicketRepository = getDefaultTicketRepository()
): Promise<{ ticket: RepairTicket; removed: TicketAttachment | null }> {
  const id = attachmentId.trim();
  if (!id) {
    throw new TicketValidationError('Attachment ID is required.');
  }
  return repository.removeAttachment(normalizeTicketId(ticketId), id);
}

export async function listCompletedTickets(
  days = 30,
  repository: TicketRepository = getDefaultTicketRepository()
): Promise<RepairTicket[]> {
  return repository.listCompletedWithin(days);
}

export async function deleteCompletedTickets(
  days = 60,
  repository: TicketRepository = getDefaultTicketRepository()
): Promise<number> {
  return repository.deleteCompletedOlderThan(days);
}

export function getDefaultTicketRepository() {
  if (!defaultRepository) {
    defaultRepository = createDefaultTicketRepository();
  }

  return defaultRepository;
}

export function resetDefaultTicketRepositoryForTest() {
  defaultRepository = null;
}

export class MySqlTicketRepository implements TicketRepository {
  constructor(private readonly pool: TicketDbPoolLike = getConfiguredTicketDbPool()) {}

  async create(ticket: RepairTicket) {
    const db = this.pool;
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO repair_tickets (
        device_id,
        device_name,
        employee_name,
        employee_email,
        department,
        problem_type,
        description,
        status,
        priority,
        created_at,
        notes_json,
        history_json,
        attachments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      buildTicketSqlValues(ticket)
    );

    return this.findById(String(result.insertId));
  }

  async list() {
    const db = this.pool;
    const [rows] = await db.query<TicketRow[]>(
      `SELECT
        id,
        device_id,
        device_name,
        employee_name,
        employee_email,
        department,
        problem_type,
        description,
        status,
        priority,
        created_at,
        notes_json,
        history_json,
        attachments_json,
        updated_at,
        completed_at
      FROM repair_tickets
      ORDER BY created_at DESC, id DESC`
    );

    return rows.map(mapTicketRow);
  }

  async findById(ticketId: string) {
    const db = this.pool;
    const [rows] = await db.query<TicketRow[]>(
      `SELECT
        id,
        device_id,
        device_name,
        employee_name,
        employee_email,
        department,
        problem_type,
        description,
        status,
        priority,
        created_at,
        notes_json,
        history_json,
        attachments_json,
        updated_at,
        completed_at
      FROM repair_tickets
      WHERE id = ?
      LIMIT 1`,
      [ticketId]
    );

    if (rows.length === 0) {
      throw new TicketNotFoundError(ticketId);
    }

    return mapTicketRow(rows[0]);
  }

  async updateStatus(
    ticketId: string,
    nextStatus: RepairTicket['status'],
    history: RepairTicket['history']
  ) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query<TicketRow[]>(
        `SELECT
          id,
          device_name,
          employee_name,
          employee_email,
          department,
          problem_type,
          description,
          status,
          priority,
          created_at,
          notes_json,
          history_json,
          attachments_json,
          updated_at,
          completed_at
        FROM repair_tickets
        WHERE id = ?
        FOR UPDATE`,
        [ticketId]
      );

      if (rows.length === 0) {
        throw new TicketNotFoundError(ticketId);
      }

      const lockedRow = rows[0];
      const lockedHistory = parseTicketHistory(lockedRow.history_json);
      const appendedHistory =
        Array.isArray(history) && history.length > lockedHistory.length
          ? history.slice(lockedHistory.length)
          : [];
      const mergedHistory = [...lockedHistory, ...appendedHistory];

      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE repair_tickets
         SET status = ?, history_json = ?
         WHERE id = ?`,
        [nextStatus, JSON.stringify(mergedHistory), ticketId]
      );

      if (result.affectedRows === 0) {
        throw new TicketNotFoundError(ticketId);
      }

      await connection.commit();
      return this.findById(ticketId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async transitionStatus(
    ticketId: string,
    expectedPreviousStatus: RepairTicket['status'],
    nextStatus: RepairTicket['status'],
    actorEmail: string
  ) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query<TicketRow[]>(
        `SELECT
          id,
          device_name,
          employee_name,
          employee_email,
          department,
          problem_type,
          description,
          status,
          priority,
          created_at,
          notes_json,
          history_json,
          attachments_json,
          updated_at,
          completed_at
        FROM repair_tickets
        WHERE id = ?
        FOR UPDATE`,
        [ticketId]
      );

      if (rows.length === 0) {
        throw new TicketNotFoundError(ticketId);
      }

      const lockedTicket = mapTicketRow(rows[0]);

      if (lockedTicket.status === nextStatus) {
        await connection.commit();
        return { ticket: lockedTicket, changed: false };
      }

      if (lockedTicket.status !== expectedPreviousStatus) {
        throw new TicketStatusConflictError(ticketId, expectedPreviousStatus, lockedTicket.status);
      }

      const mergedHistory = [
        ...(lockedTicket.history ?? []),
        createStatusChangedHistoryEvent(nextStatus, actorEmail),
      ];

      const isTerminal = nextStatus === 'Completed' || nextStatus === 'Closed';
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE repair_tickets
         SET status = ?,
             history_json = ?,
             completed_at = IF(?, COALESCE(completed_at, NOW()), NULL)
         WHERE id = ?`,
        [nextStatus, JSON.stringify(mergedHistory), isTerminal, ticketId]
      );

      if (result.affectedRows === 0) {
        throw new TicketNotFoundError(ticketId);
      }

      const updatedTicket: RepairTicket = {
        ...lockedTicket,
        status: nextStatus,
        history: mergedHistory,
        completedAt: isTerminal
          ? (lockedTicket.completedAt ?? new Date().toISOString())
          : undefined,
      };

      await connection.commit();
      return { ticket: updatedTicket, changed: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addNote(ticketId: string, note: TicketNote): Promise<RepairTicket> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query<TicketRow[]>(
        `SELECT id, notes_json, history_json FROM repair_tickets WHERE id = ? FOR UPDATE`,
        [ticketId]
      );

      if (rows.length === 0) {
        throw new TicketNotFoundError(ticketId);
      }

      const existingNotes = parseTicketNotes(rows[0].notes_json);
      const existingHistory = parseTicketHistory(rows[0].history_json);
      const historyEvent: TicketHistoryEvent = {
        id: randomUUID(),
        action: 'Note Added',
        user: note.author,
        timestamp: note.timestamp,
      };

      await connection.execute<ResultSetHeader>(
        `UPDATE repair_tickets SET notes_json = ?, history_json = ?, updated_at = NOW() WHERE id = ?`,
        [
          JSON.stringify([...existingNotes, note]),
          JSON.stringify([...existingHistory, historyEvent]),
          ticketId,
        ]
      );

      await connection.commit();
      return this.findById(ticketId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addAttachment(ticketId: string, attachment: TicketAttachment): Promise<RepairTicket> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query<TicketRow[]>(
        `SELECT id, attachments_json FROM repair_tickets WHERE id = ? FOR UPDATE`,
        [ticketId]
      );

      if (rows.length === 0) {
        throw new TicketNotFoundError(ticketId);
      }

      const existing = parseTicketAttachments(rows[0].attachments_json);
      const next = [...existing, attachment];

      await connection.execute<ResultSetHeader>(
        `UPDATE repair_tickets SET attachments_json = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(next), ticketId]
      );

      await connection.commit();
      return this.findById(ticketId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async removeAttachment(
    ticketId: string,
    attachmentId: string
  ): Promise<{ ticket: RepairTicket; removed: TicketAttachment | null }> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query<TicketRow[]>(
        `SELECT id, attachments_json FROM repair_tickets WHERE id = ? FOR UPDATE`,
        [ticketId]
      );

      if (rows.length === 0) {
        throw new TicketNotFoundError(ticketId);
      }

      const existing = parseTicketAttachments(rows[0].attachments_json);
      const removed = existing.find((entry) => entry.id === attachmentId) ?? null;
      const next = existing.filter((entry) => entry.id !== attachmentId);

      await connection.execute<ResultSetHeader>(
        `UPDATE repair_tickets SET attachments_json = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(next), ticketId]
      );

      await connection.commit();
      const ticket = await this.findById(ticketId);
      return { ticket, removed };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteById(ticketId: string): Promise<void> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM repair_tickets WHERE id = ?`,
      [ticketId]
    );

    if (result.affectedRows === 0) {
      throw new TicketNotFoundError(ticketId);
    }
  }

  async listCompletedWithin(days: number): Promise<RepairTicket[]> {
    const [rows] = await this.pool.query<TicketRow[]>(
      `SELECT
        id,
        device_id,
        device_name,
        employee_name,
        employee_email,
        department,
        problem_type,
        description,
        status,
        priority,
        created_at,
        notes_json,
        history_json,
        attachments_json,
        updated_at,
        completed_at
      FROM repair_tickets
      WHERE status IN ('Completed', 'Closed')
        AND completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY completed_at DESC, id DESC`,
      [days]
    );

    return rows.map(mapTicketRow);
  }

  async deleteCompletedOlderThan(days: number): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM repair_tickets
       WHERE status IN ('Completed', 'Closed')
         AND completed_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );

    return result.affectedRows;
  }
}

export class FileTicketRepository implements TicketRepository {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async create(ticket: RepairTicket) {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();

      if (store.tickets.some((existing) => sameTicketId(existing.id, ticket.id))) {
        throw new Error(`Ticket ${ticket.id} already exists.`);
      }

      const created = normalizeStoredTicket(ticket);
      await this.writeStore({ tickets: [...store.tickets, created] });
      return created;
    });
  }

  async list() {
    const store = await this.readStore();
    return store.tickets;
  }

  async findById(ticketId: string) {
    const store = await this.readStore();
    const ticket = store.tickets.find((entry) => sameTicketId(entry.id, ticketId));

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    return ticket;
  }

  async updateStatus(
    ticketId: string,
    nextStatus: RepairTicket['status'],
    history: RepairTicket['history']
  ) {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.tickets.findIndex((entry) => sameTicketId(entry.id, ticketId));

      if (index === -1) {
        throw new TicketNotFoundError(ticketId);
      }

      const updated = {
        ...store.tickets[index],
        status: nextStatus,
        history: history ?? [],
        updatedAt: new Date().toISOString(),
      };

      const tickets = store.tickets.slice();
      tickets[index] = updated;
      await this.writeStore({ tickets });

      return updated;
    });
  }

  async transitionStatus(
    ticketId: string,
    expectedPreviousStatus: RepairTicket['status'],
    nextStatus: RepairTicket['status'],
    actorEmail: string
  ) {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.tickets.findIndex((entry) => sameTicketId(entry.id, ticketId));

      if (index === -1) {
        throw new TicketNotFoundError(ticketId);
      }

      const current = store.tickets[index];

      if (current.status === nextStatus) {
        return { ticket: current, changed: false };
      }

      if (current.status !== expectedPreviousStatus) {
        throw new TicketStatusConflictError(ticketId, expectedPreviousStatus, current.status);
      }

      const isTerminalStatus = nextStatus === 'Completed' || nextStatus === 'Closed';
      const updated = {
        ...current,
        status: nextStatus,
        history: [...(current.history ?? []), createStatusChangedHistoryEvent(nextStatus, actorEmail)],
        updatedAt: new Date().toISOString(),
        completedAt: isTerminalStatus
          ? (current.completedAt ?? new Date().toISOString())
          : undefined,
      };

      const tickets = store.tickets.slice();
      tickets[index] = updated;
      await this.writeStore({ tickets });

      return { ticket: updated, changed: true };
    });
  }

  async addNote(ticketId: string, note: TicketNote): Promise<RepairTicket> {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.tickets.findIndex((t) => sameTicketId(t.id, ticketId));

      if (index === -1) {
        throw new TicketNotFoundError(ticketId);
      }

      const current = store.tickets[index];
      const historyEvent: TicketHistoryEvent = {
        id: randomUUID(),
        action: 'Note Added',
        user: note.author,
        timestamp: note.timestamp,
      };
      const updated: RepairTicket = {
        ...current,
        notes: [...(current.notes ?? []), note],
        history: [...(current.history ?? []), historyEvent],
      };

      const tickets = store.tickets.slice();
      tickets[index] = updated;
      await this.writeStore({ tickets });
      return updated;
    });
  }

  async addAttachment(ticketId: string, attachment: TicketAttachment): Promise<RepairTicket> {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.tickets.findIndex((t) => sameTicketId(t.id, ticketId));

      if (index === -1) {
        throw new TicketNotFoundError(ticketId);
      }

      const current = store.tickets[index];
      const updated: RepairTicket = {
        ...current,
        attachments: [...(current.attachments ?? []), attachment],
      };

      const tickets = store.tickets.slice();
      tickets[index] = updated;
      await this.writeStore({ tickets });
      return updated;
    });
  }

  async removeAttachment(
    ticketId: string,
    attachmentId: string
  ): Promise<{ ticket: RepairTicket; removed: TicketAttachment | null }> {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.tickets.findIndex((t) => sameTicketId(t.id, ticketId));

      if (index === -1) {
        throw new TicketNotFoundError(ticketId);
      }

      const current = store.tickets[index];
      const removed = (current.attachments ?? []).find((entry) => entry.id === attachmentId) ?? null;
      const updated: RepairTicket = {
        ...current,
        attachments: (current.attachments ?? []).filter((entry) => entry.id !== attachmentId),
      };

      const tickets = store.tickets.slice();
      tickets[index] = updated;
      await this.writeStore({ tickets });
      return { ticket: updated, removed };
    });
  }

  async deleteById(ticketId: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.tickets.findIndex((t) => sameTicketId(t.id, ticketId));

      if (index === -1) {
        throw new TicketNotFoundError(ticketId);
      }

      await this.writeStore({ tickets: store.tickets.filter((_, i) => i !== index) });
    });
  }

  async listCompletedWithin(days: number): Promise<RepairTicket[]> {
    const store = await this.readStore();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return store.tickets
      .filter((t) => {
        if (t.status !== 'Completed' && t.status !== 'Closed') return false;
        if (!t.completedAt) return false;
        return new Date(t.completedAt).getTime() >= cutoff;
      })
      .sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return tb - ta;
      });
  }

  async deleteCompletedOlderThan(days: number): Promise<number> {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const keep = store.tickets.filter((t) => {
        if (t.status !== 'Completed' && t.status !== 'Closed') return true;
        if (!t.completedAt) return true;
        return new Date(t.completedAt).getTime() >= cutoff;
      });
      const deleted = store.tickets.length - keep.length;
      if (deleted > 0) await this.writeStore({ tickets: keep });
      return deleted;
    });
  }

  private async enqueueWrite<T>(operation: () => Promise<T>) {
    const nextWrite = this.writeQueue.then(operation, operation);
    this.writeQueue = nextWrite.catch(() => undefined);
    return nextWrite;
  }

  private async readStore(): Promise<TicketStore> {
    try {
      const rawStore = await readFile(this.filePath, 'utf8');
      const parsedStore = JSON.parse(rawStore) as Partial<TicketStore>;
      const rawTickets = Array.isArray(parsedStore.tickets) ? parsedStore.tickets : [];
      return {
        tickets: rawTickets.map((ticket) => normalizeStoredTicket(ticket)),
      };
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return { tickets: [] };
      }

      throw error;
    }
  }

  private async writeStore(store: TicketStore) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}

function buildTicketSqlValues(ticket: RepairTicket) {
  return [
    ticket.deviceId ?? null,
    ticket.deviceName,
    ticket.employeeName,
    ticket.employeeEmail,
    ticket.department,
    ticket.problemType,
    ticket.description,
    ticket.status,
    ticket.priority,
    formatMysqlDatetime(ticket.createdAt),
    JSON.stringify(ticket.notes ?? []),
    JSON.stringify(ticket.history ?? []),
    JSON.stringify(ticket.attachments ?? []),
  ];
}

function mapTicketRow(row: TicketRow): RepairTicket {
  return {
    id: String(row.id),
    deviceId: row.device_id ?? undefined,
    deviceName: row.device_name ?? '',
    employeeName: row.employee_name ?? '',
    employeeEmail: row.employee_email ?? '',
    department: row.department ?? '',
    problemType: row.problem_type ?? '',
    description: row.description ?? '',
    status: isTicketStatus(row.status) ? row.status : 'Pending',
    priority: isTicketPriority(row.priority) ? row.priority : 'Medium',
    createdAt: normalizeDbTimestamp(row.created_at) ?? new Date().toISOString(),
    completedAt: normalizeDbTimestamp(row.completed_at) ?? undefined,
    notes: parseTicketNotes(row.notes_json),
    history: parseTicketHistory(row.history_json),
    attachments: parseTicketAttachments(row.attachments_json),
  };
}

function normalizeStoredTicket(record: unknown): RepairTicket {
  if (!isRecord(record)) {
    return {
      id: 'TK-UNKNOWN',
      deviceName: '',
      employeeName: '',
      employeeEmail: '',
      department: '',
      problemType: '',
      description: '',
      status: 'Pending',
      priority: 'Medium',
      createdAt: new Date().toISOString(),
      notes: [],
      history: [],
      attachments: [],
    };
  }

  return {
    id: normalizeText(record.id) || 'TK-UNKNOWN',
    deviceId: typeof record.deviceId === 'string' && record.deviceId.trim() ? record.deviceId.trim() : undefined,
    deviceName: normalizeText(record.deviceName),
    employeeName: normalizeText(record.employeeName),
    employeeEmail: normalizeEmail(record.employeeEmail),
    department: normalizeText(record.department),
    problemType: normalizeText(record.problemType),
    description: normalizeText(record.description),
    status: isTicketStatus(record.status) ? record.status : 'Pending',
    priority: isTicketPriority(record.priority) ? record.priority : 'Medium',
    createdAt: normalizeTimestamp(record.createdAt) ?? new Date().toISOString(),
    notes: normalizeTicketNotes(record.notes),
    history: normalizeTicketHistory(record.history),
    attachments: normalizeTicketAttachments(record.attachments),
  };
}

export function normalizeCreateTicketInput(input: unknown) {
  if (!isRecord(input)) {
    throw new TicketValidationError('Ticket payload must be an object.');
  }

  return {
    deviceId: typeof input.deviceId === 'string' && input.deviceId.trim() ? input.deviceId.trim() : undefined,
    deviceName: normalizeRequiredText(input.deviceName, 'deviceName is required.'),
    employeeName: normalizeRequiredText(input.employeeName, 'employeeName is required.'),
    employeeEmail: normalizeRequiredEmail(input.employeeEmail, 'employeeEmail is required.'),
    department: normalizeRequiredText(input.department, 'department is required.'),
    problemType: normalizeRequiredText(input.problemType, 'problemType is required.'),
    description: normalizeRequiredText(input.description, 'description is required.'),
    priority: normalizeTicketPriority(input.priority),
    actorEmail: normalizeOptionalEmail(input.actorEmail) ?? 'system@repairlink.local',
  };
}

function normalizeTicketId(ticketId: string) {
  const normalized = normalizeText(ticketId);

  if (!normalized) {
    throw new TicketValidationError('Ticket ID is required.');
  }

  return normalized;
}

function normalizeRequiredText(value: unknown, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new TicketValidationError(message);
  }

  return normalized;
}

function normalizeRequiredEmail(value: unknown, message: string) {
  const normalized = normalizeOptionalEmail(value);

  if (!normalized) {
    throw new TicketValidationError(message);
  }

  return normalized;
}

function normalizeOptionalEmail(value: unknown) {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function normalizeTicketPriority(value: unknown): RepairTicket['priority'] {
  if (value === undefined) {
    return 'Medium';
  }

  if (!isTicketPriority(value)) {
    throw new TicketValidationError('priority must be Low, Medium, High, or Critical.');
  }

  return value;
}

function normalizeTicketStatus(value: unknown): RepairTicket['status'] {
  if (!isTicketStatus(value)) {
    throw new TicketValidationError(
      'status must be Pending, In Progress, Waiting for Parts, Completed, or Closed.'
    );
  }

  return value;
}

function normalizeHistoryInput(history: RepairTicket['history']) {
  if (!Array.isArray(history)) {
    throw new TicketValidationError('history must be an array.');
  }

  return history;
}

function createStatusChangedHistoryEvent(
  nextStatus: RepairTicket['status'],
  actorEmail: string
): TicketHistoryEvent {
  return {
    id: randomUUID(),
    action: `Status Changed to ${nextStatus}`,
    user: normalizeEmail(actorEmail),
    timestamp: new Date().toISOString(),
  };
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeDbTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return toIsoTimestamp(value);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function generateTicketId() {
  return `TK-${randomUUID()}`;
}

function toMysqlDatetimeString(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function toIsoTimestamp(mysqlDatetime: string) {
  return new Date(`${mysqlDatetime.replace(' ', 'T')}Z`).toISOString();
}

function formatMysqlDatetime(value: string) {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return toMysqlDatetimeString(parsed);
}

function parseTicketNotes(value: unknown): TicketNote[] {
  const parsed = parseJsonArray(value);
  return parsed.filter(isTicketNote);
}

function parseTicketHistory(value: unknown): TicketHistoryEvent[] {
  const parsed = parseJsonArray(value);
  return parsed.filter(isTicketHistoryEvent);
}

function parseTicketAttachments(value: unknown): TicketAttachment[] {
  const parsed = parseJsonArray(value);
  return parsed.filter(isTicketAttachment);
}

function normalizeTicketNotes(value: unknown): TicketNote[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isTicketNote);
}

function normalizeTicketHistory(value: unknown): TicketHistoryEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isTicketHistoryEvent);
}

function normalizeTicketAttachments(value: unknown): TicketAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isTicketAttachment);
}

function isTicketAttachment(value: unknown): value is TicketAttachment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.fileName === 'string' &&
    typeof value.url === 'string' &&
    typeof value.mimeType === 'string' &&
    typeof value.size === 'number' &&
    typeof value.uploadedAt === 'string'
  );
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compareTicketsByCreatedAtDesc(left: RepairTicket, right: RepairTicket) {
  return ticketSortValue(right.createdAt) - ticketSortValue(left.createdAt);
}

function ticketSortValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sameTicketId(left: string, right: string) {
  return normalizeText(left) === normalizeText(right);
}

function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

function getConfiguredTicketDbPool() {
  try {
    return getDeviceDbPool();
  } catch (error) {
    if (error instanceof Error && error.message === 'Database connection is not configured.') {
      throw new TicketDatabaseConfigurationError();
    }

    throw error;
  }
}

function createDefaultTicketRepository() {
  if (hasDatabaseConfiguration()) {
    return new MySqlTicketRepository();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new TicketDatabaseConfigurationError();
  }

  return new FileTicketRepository(getDemoTicketStorePath());
}

function getDemoTicketStorePath() {
  if (process.env.NODE_ENV === 'production') {
    throw new TicketDatabaseConfigurationError();
  }

  return process.env.TICKET_DEMO_STORE_PATH ?? join(process.cwd(), 'data', 'demo-tickets.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTicketStatus(value: unknown): value is RepairTicket['status'] {
  return (
    typeof value === 'string' &&
    ['Pending', 'In Progress', 'Waiting for Parts', 'Completed', 'Closed'].includes(value)
  );
}

function isTicketPriority(value: unknown): value is RepairTicket['priority'] {
  return typeof value === 'string' && ['Low', 'Medium', 'High', 'Critical'].includes(value);
}

function isTicketNote(value: unknown): value is TicketNote {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.author === 'string' &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'string'
  );
}

function isTicketHistoryEvent(value: unknown): value is TicketHistoryEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.action === 'string' &&
    typeof value.user === 'string' &&
    typeof value.timestamp === 'string'
  );
}

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
