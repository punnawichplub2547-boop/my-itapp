import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDeviceDbPool } from '../db/mysql';
import type { DeviceRepairEvent, DeviceRepairEventType } from '../../types';

export type { DeviceRepairEvent, DeviceRepairEventType };

// ── Repository interface ──────────────────────────────────────────────────────

export interface DeviceRepairEventRepository {
  append(event: DeviceRepairEvent): Promise<void>;
  listByDeviceId(deviceId: string): Promise<DeviceRepairEvent[]>;
}

// ── MySQL implementation ──────────────────────────────────────────────────────

interface DeviceRepairEventRow extends RowDataPacket {
  id: string;
  device_id: string;
  ticket_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  problem_type: string | null;
  status: string | null;
  reported_by: string | null;
  technician: string | null;
  created_by: string | null;
  created_at: Date | string | null;
  source: string;
}

export class MySqlDeviceRepairEventRepository implements DeviceRepairEventRepository {
  async append(event: DeviceRepairEvent): Promise<void> {
    const db = getDeviceDbPool();
    await db.execute<ResultSetHeader>(
      `INSERT INTO device_repair_events (
        id, device_id, ticket_id, event_type, title, description,
        problem_type, status, reported_by, technician, created_by, created_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.deviceId,
        event.ticketId ?? null,
        event.eventType,
        event.title,
        event.description ?? null,
        event.problemType ?? null,
        event.status ?? null,
        event.reportedBy ?? null,
        event.technician ?? null,
        event.createdBy ?? null,
        new Date(event.createdAt),
        event.source,
      ]
    );
  }

  async listByDeviceId(deviceId: string): Promise<DeviceRepairEvent[]> {
    const db = getDeviceDbPool();
    const [rows] = await db.query<DeviceRepairEventRow[]>(
      `SELECT id, device_id, ticket_id, event_type, title, description,
              problem_type, status, reported_by, technician, created_by, created_at, source
       FROM device_repair_events
       WHERE device_id = ?
       ORDER BY created_at ASC`,
      [deviceId]
    );
    return rows.map(mapDeviceRepairEventRow);
  }
}

// ── File implementation ───────────────────────────────────────────────────────

export class FileDeviceRepairEventRepository implements DeviceRepairEventRepository {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async append(event: DeviceRepairEvent): Promise<void> {
    await this.enqueueWrite(async () => {
      const events = await this.readEvents();
      await this.writeEvents([...events, event]);
    });
  }

  async listByDeviceId(deviceId: string): Promise<DeviceRepairEvent[]> {
    const events = await this.readEvents();
    const normalized = deviceId.trim().toUpperCase();
    return events
      .filter((e) => e.deviceId.trim().toUpperCase() === normalized)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private async enqueueWrite<T>(operation: () => Promise<T>) {
    const nextWrite = this.writeQueue.then(operation, operation);
    this.writeQueue = nextWrite.catch(() => undefined);
    return nextWrite;
  }

  private async readEvents(): Promise<DeviceRepairEvent[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isDeviceRepairEvent) : [];
    } catch (error) {
      if (isFileNotFoundError(error)) return [];
      throw error;
    }
  }

  private async writeEvents(events: DeviceRepairEvent[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
  }
}

// ── Default repository factory ────────────────────────────────────────────────

let defaultRepository: DeviceRepairEventRepository | null = null;

function getDefaultDeviceRepairEventRepository(): DeviceRepairEventRepository {
  if (!defaultRepository) {
    defaultRepository = hasDatabaseConfiguration()
      ? new MySqlDeviceRepairEventRepository()
      : new FileDeviceRepairEventRepository(getDeviceRepairEventStorePath());
  }
  return defaultRepository;
}

export function resetDefaultDeviceRepairEventRepositoryForTest(): void {
  defaultRepository = null;
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function appendDeviceRepairEvent(
  input: Omit<DeviceRepairEvent, 'id'>,
  repository: DeviceRepairEventRepository = getDefaultDeviceRepairEventRepository()
): Promise<void> {
  const event: DeviceRepairEvent = { id: randomUUID(), ...input };
  await repository.append(event);
}

export async function listDeviceRepairEvents(
  deviceId: string,
  repository: DeviceRepairEventRepository = getDefaultDeviceRepairEventRepository()
): Promise<DeviceRepairEvent[]> {
  return repository.listByDeviceId(deviceId.trim());
}

// ── Private helpers ───────────────────────────────────────────────────────────

function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

function getDeviceRepairEventStorePath() {
  return (
    process.env.DEVICE_REPAIR_EVENT_STORE_PATH ??
    join(process.cwd(), 'data', 'demo-device-repair-events.json')
  );
}

function mapDeviceRepairEventRow(row: DeviceRepairEventRow): DeviceRepairEvent {
  return {
    id: row.id,
    deviceId: row.device_id,
    ticketId: row.ticket_id ?? undefined,
    eventType: isDeviceRepairEventType(row.event_type) ? row.event_type : 'device_note',
    title: row.title ?? '',
    description: row.description ?? undefined,
    problemType: row.problem_type ?? undefined,
    status: row.status ?? undefined,
    reportedBy: row.reported_by ?? undefined,
    technician: row.technician ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: normalizeTimestamp(row.created_at) ?? new Date().toISOString(),
    source: isEventSource(row.source) ? row.source : 'system',
  };
}

function isDeviceRepairEventType(value: unknown): value is DeviceRepairEventType {
  return (
    typeof value === 'string' &&
    ['ticket_created', 'ticket_status_changed', 'ticket_completed', 'ticket_deleted', 'device_note'].includes(value)
  );
}

function isEventSource(value: unknown): value is DeviceRepairEvent['source'] {
  return typeof value === 'string' && ['ticket', 'device', 'system'].includes(value);
}

function isDeviceRepairEvent(value: unknown): value is DeviceRepairEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.deviceId === 'string' &&
    typeof value.eventType === 'string' &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.source === 'string'
  );
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFileNotFoundError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'ENOENT';
}
