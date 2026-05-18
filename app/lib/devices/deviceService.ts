import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import { getDeviceDbPool } from '../db/mysql';
import type { Device, DeviceStatus, DeviceType, IpMode } from '../../types';
import { syncWarrantyAlert } from './warrantyAlerts';

export { type DeviceStatus, type DeviceType, type IpMode } from '../../types';

export interface CreateDeviceInput {
  deviceId: string;
  assetNo: string;
  ipMode: IpMode;
  ipAddress: string;
  department: string;
  assignedTo: string;
  deviceType: DeviceType;
  model: string;
  hdd: string;
  ram: string;
  cpu: string;
  installDate: string;
  expireDatePrimary: string;
  expireDateSecondary: string;
  warranty: string;
  yearValue: string;
  os: string;
  osLicense: string;
  msOfficeVersion: string;
  status: DeviceStatus;
  notes: string;
}

export interface DeviceRepository {
  create(device: CreateDeviceInput): Promise<Device>;
  list(): Promise<Device[]>;
  updateStatus(deviceId: string, status: DeviceStatus): Promise<Device>;
  updateAssignedTo(deviceId: string, assignedTo: string): Promise<Device>;
  updateWarrantyAlertedAt(deviceId: string, warrantyAlertedAt?: string): Promise<Device>;
  upsertMany(devices: Device[]): Promise<void>;
  delete(deviceId: string): Promise<void>;
}

interface DemoDeviceStore {
  devices: unknown[];
}

interface DeviceRow extends RowDataPacket {
  deviceId: string;
  assetNo: string;
  ipMode: string;
  ipAddress: string;
  department: string;
  assignedTo: string;
  deviceType: string;
  model: string;
  hdd: string;
  ram: string;
  cpu: string;
  installDate: string;
  expireDatePrimary: string;
  expireDateSecondary: string;
  warranty: string;
  yearValue: string;
  os: string;
  osLicense: string;
  msOfficeVersion: string;
  status: string;
  notes: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  warrantyAlertedAt: Date | string | null;
}

const deviceTypes: DeviceType[] = ['Laptop', 'PC', 'Server', 'Notebook', 'Desktop', 'Unknown'];
const createDeviceTypes: DeviceType[] = ['Notebook', 'PC', 'Server'];
const deviceStatuses: DeviceStatus[] = ['Active', 'Inactive', 'Out of Service'];
const ipModes: IpMode[] = ['Manual', 'DHCP'];

let defaultRepository: DeviceRepository | null = null;

export class DeviceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceValidationError';
  }
}

export class DuplicateDeviceIdError extends Error {
  constructor() {
    super('A device with this device ID already exists.');
    this.name = 'DuplicateDeviceIdError';
  }
}

export class DeviceNotFoundError extends Error {
  constructor(deviceId: string) {
    super(`Device ${deviceId} was not found.`);
    this.name = 'DeviceNotFoundError';
  }
}

export class DeviceDatabaseConfigurationError extends Error {
  constructor() {
    super('Database connection is not configured.');
    this.name = 'DeviceDatabaseConfigurationError';
  }
}

export function normalizeCreateDeviceInput(input: unknown): CreateDeviceInput {
  if (!isRecord(input)) {
    throw new DeviceValidationError('Device payload must be an object.');
  }

  const deviceId = normalizeRequiredText(input.deviceId, 'Device ID is required.');
  const department = normalizeRequiredText(input.department, 'Department is required.');
  const os = normalizeRequiredText(input.os, 'Operating system is required.');
  const ipMode = normalizeIpMode(input.ipMode);
  const ipAddress = normalizeOptionalText(input.ipAddress);

  if (ipMode === 'Manual' && !ipAddress) {
    throw new DeviceValidationError('IP address is required when IP mode is Manual.');
  }

  return {
    deviceId,
    assetNo: normalizeOptionalText(input.assetNo),
    ipMode,
    ipAddress: ipMode === 'Manual' ? ipAddress : '',
    department,
    assignedTo: normalizeOptionalText(input.assignedTo),
    deviceType: normalizeCreateDeviceType(input.deviceType),
    model: normalizeOptionalText(input.model),
    hdd: normalizeOptionalText(input.hdd),
    ram: normalizeOptionalText(input.ram),
    cpu: normalizeOptionalText(input.cpu),
    installDate: normalizeOptionalText(input.installDate),
    expireDatePrimary: normalizeOptionalText(input.expireDatePrimary),
    expireDateSecondary: normalizeOptionalText(input.expireDateSecondary),
    warranty: normalizeOptionalText(input.warranty),
    yearValue: normalizeOptionalText(input.yearValue),
    os,
    osLicense: normalizeOptionalText(input.osLicense),
    msOfficeVersion: normalizeOptionalText(input.msOfficeVersion),
    status: normalizeDeviceStatus(input.status),
    notes: normalizeOptionalText(input.notes),
  };
}

export async function createDevice(
  input: unknown,
  repository: DeviceRepository = getDefaultDeviceRepository()
) {
  return repository.create(normalizeCreateDeviceInput(input));
}

export async function listDevices(repository: DeviceRepository = getDefaultDeviceRepository()) {
  const devices = await repository.list();
  return syncDeviceWarrantyAlerts(devices, repository);
}

export async function updateDeviceStatus(
  deviceId: string,
  status: unknown,
  repository: DeviceRepository = getDefaultDeviceRepository()
) {
  return repository.updateStatus(normalizeDeviceId(deviceId), normalizeDeviceStatus(status));
}

export async function updateDeviceAssignedTo(
  deviceId: string,
  assignedTo: unknown,
  repository: DeviceRepository = getDefaultDeviceRepository()
) {
  if (typeof assignedTo !== 'string') {
    throw new DeviceValidationError('assignedTo must be a string.');
  }

  return repository.updateAssignedTo(normalizeDeviceId(deviceId), assignedTo.trim());
}

export async function upsertDevices(
  devices: Device[],
  repository: DeviceRepository = getDefaultDeviceRepository()
) {
  await repository.upsertMany(devices.map((device) => normalizeStoredDevice(device)));
}

export async function deleteDevice(
  deviceId: string,
  repository: DeviceRepository = getDefaultDeviceRepository()
) {
  await repository.delete(normalizeDeviceId(deviceId));
}

export function normalizeTimestampForSql(value: string | undefined) {
  const normalized = normalizeTimestamp(value);

  if (!normalized) {
    return null;
  }

  return new Date(normalized);
}

async function syncDeviceWarrantyAlerts(devices: Device[], repository: DeviceRepository) {
  const synchronizedDevices = [...devices];

  for (const [index, device] of devices.entries()) {
    const alert = syncWarrantyAlert(device);
    const nextAlertedAt = alert.nextAlertedAt;
    const currentAlertedAt = normalizeTimestamp(device.warrantyAlertedAt);

    if (currentAlertedAt === nextAlertedAt) {
      synchronizedDevices[index] = {
        ...device,
        warrantyAlertedAt: nextAlertedAt,
      };
      continue;
    }

    const updated = await repository.updateWarrantyAlertedAt(device.deviceId, nextAlertedAt);
    synchronizedDevices[index] = updated;
  }

  return synchronizedDevices;
}

export function getDefaultDeviceRepository() {
  if (!defaultRepository) {
    defaultRepository = shouldUseDemoRepository()
      ? new FileDeviceRepository(getDemoDeviceStorePath())
      : hasDatabaseConfiguration()
      ? new MySqlDeviceRepository()
      : new FileDeviceRepository(getDemoDeviceStorePath());
  }

  return defaultRepository;
}

export class MySqlDeviceRepository implements DeviceRepository {
  async create(device: CreateDeviceInput) {
    try {
      const db = getConfiguredDeviceDbPool();
      await db.execute<ResultSetHeader>(
        `INSERT INTO devices (
          deviceId, assetNo, ipMode, ipAddress, department, assignedTo, deviceType,
          model, hdd, ram, cpu, installDate, expireDatePrimary, expireDateSecondary,
          warranty, yearValue, os, osLicense, msOfficeVersion, status, notes, warrantyAlertedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        buildDeviceSqlValues(device)
      );

      return this.findByDeviceId(device.deviceId);
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new DuplicateDeviceIdError();
      }

      throw error;
    }
  }

  async list() {
    const db = getConfiguredDeviceDbPool();
    const [rows] = await db.query<DeviceRow[]>(
      `SELECT
        deviceId,
        assetNo,
        ipMode,
        ipAddress,
        department,
        assignedTo,
        deviceType,
        model,
        hdd,
        ram,
        cpu,
        installDate,
        expireDatePrimary,
        expireDateSecondary,
        warranty,
        yearValue,
        os,
        osLicense,
        msOfficeVersion,
        status,
        notes,
        createdAt,
        updatedAt,
        warrantyAlertedAt
      FROM devices
      ORDER BY deviceId ASC`
    );

    return rows.map(mapDeviceRow);
  }

  async updateStatus(deviceId: string, status: DeviceStatus) {
    const db = getConfiguredDeviceDbPool();
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE devices SET status = ? WHERE deviceId = ?',
      [status, deviceId]
    );

    if (result.affectedRows === 0) {
      throw new DeviceNotFoundError(deviceId);
    }

    return this.findByDeviceId(deviceId);
  }

  async updateAssignedTo(deviceId: string, assignedTo: string) {
    const db = getConfiguredDeviceDbPool();
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE devices SET assignedTo = ? WHERE deviceId = ?',
      [assignedTo, deviceId]
    );

    if (result.affectedRows === 0) {
      throw new DeviceNotFoundError(deviceId);
    }

    return this.findByDeviceId(deviceId);
  }

  async updateWarrantyAlertedAt(deviceId: string, warrantyAlertedAt?: string) {
    const db = getConfiguredDeviceDbPool();
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE devices SET warrantyAlertedAt = ? WHERE deviceId = ?',
      [normalizeTimestampForSql(warrantyAlertedAt), deviceId]
    );

    if (result.affectedRows === 0) {
      throw new DeviceNotFoundError(deviceId);
    }

    return this.findByDeviceId(deviceId);
  }

  async upsertMany(devices: Device[]) {
    const db = getConfiguredDeviceDbPool();

    for (const device of devices) {
      await db.execute<ResultSetHeader>(
        `INSERT INTO devices (
          deviceId, assetNo, ipMode, ipAddress, department, assignedTo, deviceType,
          model, hdd, ram, cpu, installDate, expireDatePrimary, expireDateSecondary,
          warranty, yearValue, os, osLicense, msOfficeVersion, status, notes, warrantyAlertedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          assetNo = VALUES(assetNo),
          ipMode = VALUES(ipMode),
          ipAddress = VALUES(ipAddress),
          department = VALUES(department),
          assignedTo = VALUES(assignedTo),
          deviceType = VALUES(deviceType),
          model = VALUES(model),
          hdd = VALUES(hdd),
          ram = VALUES(ram),
          cpu = VALUES(cpu),
          installDate = VALUES(installDate),
          expireDatePrimary = VALUES(expireDatePrimary),
          expireDateSecondary = VALUES(expireDateSecondary),
          warranty = VALUES(warranty),
          yearValue = VALUES(yearValue),
          os = VALUES(os),
          osLicense = VALUES(osLicense),
          msOfficeVersion = VALUES(msOfficeVersion),
          status = VALUES(status),
          notes = VALUES(notes),
          warrantyAlertedAt = COALESCE(VALUES(warrantyAlertedAt), warrantyAlertedAt)`,
        buildDeviceSqlValues(normalizeStoredDevice(device))
      );
    }
  }

  async delete(deviceId: string) {
    const db = getConfiguredDeviceDbPool();
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM devices WHERE deviceId = ?',
      [deviceId]
    );

    if (result.affectedRows === 0) {
      throw new DeviceNotFoundError(deviceId);
    }
  }

  private async findByDeviceId(deviceId: string) {
    const db = getConfiguredDeviceDbPool();
    const [rows] = await db.query<DeviceRow[]>(
      `SELECT
        deviceId,
        assetNo,
        ipMode,
        ipAddress,
        department,
        assignedTo,
        deviceType,
        model,
        hdd,
        ram,
        cpu,
        installDate,
        expireDatePrimary,
        expireDateSecondary,
        warranty,
        yearValue,
        os,
        osLicense,
        msOfficeVersion,
        status,
        notes,
        createdAt,
        updatedAt,
        warrantyAlertedAt
      FROM devices
      WHERE deviceId = ?
      LIMIT 1`,
      [deviceId]
    );

    if (rows.length === 0) {
      throw new DeviceNotFoundError(deviceId);
    }

    return mapDeviceRow(rows[0]);
  }
}

export class FileDeviceRepository implements DeviceRepository {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async create(device: CreateDeviceInput) {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();

      if (store.devices.some((existing) => sameDeviceId(existing.deviceId, device.deviceId))) {
        throw new DuplicateDeviceIdError();
      }

      const created = buildStoredDevice(device);
      await this.writeStore({ devices: [...store.devices, created] });
      return created;
    });
  }

  async list() {
    const store = await this.readStore();
    return store.devices;
  }

  async updateStatus(deviceId: string, status: DeviceStatus) {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.devices.findIndex((device) => sameDeviceId(device.deviceId, deviceId));

      if (index === -1) {
        throw new DeviceNotFoundError(deviceId);
      }

      const updated = {
        ...store.devices[index],
        status,
        updatedAt: new Date().toISOString(),
      };

      const devices = store.devices.slice();
      devices[index] = updated;
      await this.writeStore({ devices });

      return updated;
    });
  }

  async updateAssignedTo(deviceId: string, assignedTo: string) {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.devices.findIndex((device) => sameDeviceId(device.deviceId, deviceId));

      if (index === -1) {
        throw new DeviceNotFoundError(deviceId);
      }

      const updated = {
        ...store.devices[index],
        assignedTo,
        updatedAt: new Date().toISOString(),
      };

      const devices = store.devices.slice();
      devices[index] = updated;
      await this.writeStore({ devices });

      return updated;
    });
  }

  async updateWarrantyAlertedAt(deviceId: string, warrantyAlertedAt?: string) {
    return this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.devices.findIndex((device) => sameDeviceId(device.deviceId, deviceId));

      if (index === -1) {
        throw new DeviceNotFoundError(deviceId);
      }

      const updated = {
        ...store.devices[index],
        warrantyAlertedAt,
        updatedAt: new Date().toISOString(),
      };

      const devices = store.devices.slice();
      devices[index] = updated;
      await this.writeStore({ devices });

      return updated;
    });
  }

  async upsertMany(devices: Device[]) {
    await this.enqueueWrite(async () => {
      const store = await this.readStore();
      const byDeviceId = new Map(
        store.devices.map((device) => [normalizeDeviceIdForMap(device.deviceId), device] as const)
      );

      for (const device of devices) {
        const normalized = normalizeStoredDevice(device);
        const existing = byDeviceId.get(normalizeDeviceIdForMap(normalized.deviceId));

        byDeviceId.set(
          normalizeDeviceIdForMap(normalized.deviceId),
          existing
            ? {
                ...existing,
                ...normalized,
                createdAt: existing.createdAt ?? normalized.createdAt,
                warrantyAlertedAt:
                  normalized.warrantyAlertedAt ?? existing.warrantyAlertedAt,
                updatedAt: new Date().toISOString(),
              }
            : buildStoredDevice(normalized)
        );
      }

      await this.writeStore({ devices: [...byDeviceId.values()] });
    });
  }

  async delete(deviceId: string) {
    await this.enqueueWrite(async () => {
      const store = await this.readStore();
      const index = store.devices.findIndex((device) => sameDeviceId(device.deviceId, deviceId));

      if (index === -1) {
        throw new DeviceNotFoundError(deviceId);
      }

      await this.writeStore({ devices: store.devices.filter((_, i) => i !== index) });
    });
  }

  private async enqueueWrite<T>(operation: () => Promise<T>) {
    const nextWrite = this.writeQueue.then(operation, operation);
    this.writeQueue = nextWrite.catch(() => undefined);
    return nextWrite;
  }

  private async readStore(): Promise<{ devices: Device[] }> {
    try {
      const rawStore = await readFile(this.filePath, 'utf8');
      const parsedStore = JSON.parse(rawStore) as Partial<DemoDeviceStore>;
      const rawDevices = Array.isArray(parsedStore.devices) ? parsedStore.devices : [];
      return {
        devices: rawDevices.map((device) => normalizeStoredDevice(device)),
      };
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return { devices: [] };
      }

      throw error;
    }
  }

  private async writeStore(store: DemoDeviceStore) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}

function buildDeviceSqlValues(device: CreateDeviceInput | Device) {
  return [
    device.deviceId,
    device.assetNo,
    device.ipMode,
    device.ipAddress,
    device.department,
    device.assignedTo,
    device.deviceType,
    device.model,
    device.hdd,
    device.ram,
    device.cpu,
    device.installDate,
    device.expireDatePrimary,
    device.expireDateSecondary,
    device.warranty,
    device.yearValue,
    device.os,
    device.osLicense,
    device.msOfficeVersion,
    device.status,
    device.notes,
    'warrantyAlertedAt' in device ? normalizeTimestampForSql(device.warrantyAlertedAt) : null,
  ];
}

function mapDeviceRow(row: DeviceRow): Device {
  return {
    deviceId: row.deviceId,
    assetNo: row.assetNo ?? '',
    ipMode: isIpMode(row.ipMode) ? row.ipMode : 'DHCP',
    ipAddress: row.ipAddress ?? '',
    department: row.department ?? '',
    assignedTo: row.assignedTo ?? '',
    deviceType: isDeviceType(row.deviceType) ? row.deviceType : 'Unknown',
    model: row.model ?? '',
    hdd: row.hdd ?? '',
    ram: row.ram ?? '',
    cpu: row.cpu ?? '',
    installDate: row.installDate ?? '',
    expireDatePrimary: row.expireDatePrimary ?? '',
    expireDateSecondary: row.expireDateSecondary ?? '',
    warranty: row.warranty ?? '',
    yearValue: row.yearValue ?? '',
    os: row.os ?? '',
    osLicense: row.osLicense ?? '',
    msOfficeVersion: row.msOfficeVersion ?? '',
    status: isDeviceStatus(row.status) ? row.status : 'Active',
    notes: row.notes ?? '',
    createdAt: normalizeTimestamp(row.createdAt),
    updatedAt: normalizeTimestamp(row.updatedAt),
    warrantyAlertedAt: normalizeTimestamp(row.warrantyAlertedAt),
  };
}

function buildStoredDevice(device: CreateDeviceInput | Device): Device {
  const now = new Date().toISOString();

  return {
    deviceId: device.deviceId,
    assetNo: device.assetNo,
    ipMode: device.ipMode,
    ipAddress: device.ipAddress,
    department: device.department,
    assignedTo: device.assignedTo,
    deviceType: device.deviceType,
    model: device.model,
    hdd: device.hdd,
    ram: device.ram,
    cpu: device.cpu,
    installDate: device.installDate,
    expireDatePrimary: device.expireDatePrimary,
    expireDateSecondary: device.expireDateSecondary,
    warranty: device.warranty,
    yearValue: device.yearValue,
    os: device.os,
    osLicense: device.osLicense,
    msOfficeVersion: device.msOfficeVersion,
    status: device.status,
    notes: device.notes,
    createdAt: 'createdAt' in device ? device.createdAt ?? now : now,
    updatedAt: now,
    warrantyAlertedAt: 'warrantyAlertedAt' in device ? normalizeTimestamp(device.warrantyAlertedAt) : undefined,
  };
}

function normalizeStoredDevice(record: unknown): Device {
  if (!isRecord(record)) {
    return buildStoredDevice({
      deviceId: 'UNKNOWN',
      assetNo: '',
      ipMode: 'DHCP',
      ipAddress: '',
      department: '',
      assignedTo: '',
      deviceType: 'Unknown',
      model: '',
      hdd: '',
      ram: '',
      cpu: '',
      installDate: '',
      expireDatePrimary: '',
      expireDateSecondary: '',
      warranty: '',
      yearValue: '',
      os: '',
      osLicense: '',
      msOfficeVersion: '',
      status: 'Active',
      notes: '',
    });
  }

  const legacyAssignedTo = normalizeLegacyAssignedTo(record.assignedTo);

  return {
    deviceId:
      normalizeOptionalText(record.deviceId) || normalizeOptionalText(record.id) || 'UNKNOWN',
    assetNo: normalizeOptionalText(record.assetNo),
    ipMode: isIpMode(record.ipMode) ? record.ipMode : 'DHCP',
    ipAddress: normalizeOptionalText(record.ipAddress),
    department: normalizeOptionalText(record.department),
    assignedTo: normalizeOptionalText(record.assignedTo) || legacyAssignedTo,
    deviceType: normalizeStoredDeviceType(record.deviceType),
    model: normalizeOptionalText(record.model) || normalizeOptionalText(record.deviceName),
    hdd:
      normalizeOptionalText(record.hdd) ||
      normalizeOptionalText((record as Record<string, unknown>).storage),
    ram: normalizeOptionalText(record.ram),
    cpu: normalizeOptionalText(record.cpu),
    installDate: normalizeOptionalText(record.installDate),
    expireDatePrimary:
      normalizeOptionalText(record.expireDatePrimary) ||
      normalizeOptionalText(record.warrantyExpireDate),
    expireDateSecondary: normalizeOptionalText(record.expireDateSecondary),
    warranty: normalizeOptionalText(record.warranty),
    yearValue: normalizeOptionalText(record.yearValue) || normalizeOptionalText(record.purchaseYear),
    os: normalizeOptionalText(record.os),
    osLicense: normalizeOptionalText(record.osLicense),
    msOfficeVersion: normalizeOptionalText(record.msOfficeVersion),
    status: isDeviceStatus(record.status) ? record.status : 'Active',
    notes: normalizeOptionalText(record.notes),
    createdAt: normalizeTimestamp(record.createdAt),
    updatedAt: normalizeTimestamp(record.updatedAt),
    warrantyAlertedAt: normalizeTimestamp(record.warrantyAlertedAt),
  };
}

function normalizeLegacyAssignedTo(value: unknown) {
  if (!isRecord(value)) {
    return '';
  }

  return normalizeOptionalText(value.name) || normalizeOptionalText(value.email);
}

function normalizeStoredDeviceType(value: unknown): DeviceType {
  if (value === 'Workstation') {
    return 'PC';
  }

  return isDeviceType(value) ? value : 'Unknown';
}

function getConfiguredDeviceDbPool() {
  try {
    return getDeviceDbPool();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Database connection is not configured.'
    ) {
      throw new DeviceDatabaseConfigurationError();
    }

    throw error;
  }
}

function normalizeRequiredText(value: unknown, message: string) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw new DeviceValidationError(message);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDeviceId(deviceId: string) {
  return normalizeRequiredText(deviceId, 'Device ID is required.');
}

function normalizeDeviceIdForMap(deviceId: string) {
  return deviceId.trim().toUpperCase();
}

function sameDeviceId(left: string, right: string) {
  return normalizeDeviceIdForMap(left) === normalizeDeviceIdForMap(right);
}

function normalizeCreateDeviceType(value: unknown): DeviceType {
  if (!isDeviceType(value) || !createDeviceTypes.includes(value)) {
    throw new DeviceValidationError('Choose a valid device type.');
  }

  return value;
}

function normalizeDeviceStatus(value: unknown): DeviceStatus {
  if (!isDeviceStatus(value)) {
    throw new DeviceValidationError('Choose a valid device status.');
  }

  return value;
}

function normalizeIpMode(value: unknown): IpMode {
  if (!isIpMode(value)) {
    throw new DeviceValidationError('Choose a valid IP mode.');
  }

  return value;
}

function normalizeTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function shouldUseDemoRepository() {
  return process.env.DEVICE_REPOSITORY === 'demo';
}

function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

function getDemoDeviceStorePath() {
  if (process.env.NODE_ENV === 'production') {
    throw new DeviceDatabaseConfigurationError();
  }

  return process.env.DEVICE_DEMO_STORE_PATH ?? join(process.cwd(), 'data', 'demo-devices.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDeviceType(value: unknown): value is DeviceType {
  return typeof value === 'string' && deviceTypes.includes(value as DeviceType);
}

function isDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === 'string' && deviceStatuses.includes(value as DeviceStatus);
}

function isIpMode(value: unknown): value is IpMode {
  return typeof value === 'string' && ipModes.includes(value as IpMode);
}

function isDuplicateEntryError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ER_DUP_ENTRY'
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
