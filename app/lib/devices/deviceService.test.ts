import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  FileDeviceRepository,
  createDevice,
  listDevices,
  normalizeCreateDeviceInput,
  normalizeTimestampForSql,
  upsertDevices,
  updateDeviceAssignedTo,
  updateDeviceStatus,
} from './deviceService';

const baseInput = {
  deviceId: 'CAR200',
  assetNo: '64',
  ipMode: 'DHCP',
  ipAddress: '',
  department: 'EN',
  assignedTo: 'sasiluk_en',
  deviceType: 'Notebook',
  model: 'Thinkbook15 G3 ACL',
  hdd: '500 GB',
  ram: '8',
  cpu: 'Ryzen 5 5500U',
  installDate: '44613',
  expireDatePrimary: '44613',
  expireDateSecondary: '44978',
  warranty: '1',
  yearValue: '0',
  os: 'Windows 11 Pro',
  osLicense: 'OEM',
  msOfficeVersion: '2016',
  status: 'Active',
  notes: '',
};

test('normalizes valid workbook-backed device input before persistence', () => {
  const normalized = normalizeCreateDeviceInput({
    ...baseInput,
    deviceId: '  CAR200  ',
    assetNo: ' 64 ',
    department: ' EN ',
    assignedTo: ' sasiluk_en ',
    model: ' Thinkbook15 G3 ACL ',
    os: '  Windows 11 Pro  ',
  });

  assert.deepEqual(normalized, {
    deviceId: 'CAR200',
    assetNo: '64',
    ipMode: 'DHCP',
    ipAddress: '',
    department: 'EN',
    assignedTo: 'sasiluk_en',
    deviceType: 'Notebook',
    model: 'Thinkbook15 G3 ACL',
    hdd: '500 GB',
    ram: '8',
    cpu: 'Ryzen 5 5500U',
    installDate: '44613',
    expireDatePrimary: '44613',
    expireDateSecondary: '44978',
    warranty: '1',
    yearValue: '0',
    os: 'Windows 11 Pro',
    osLicense: 'OEM',
    msOfficeVersion: '2016',
    status: 'Active',
    notes: '',
  });
});

test('rejects malformed workbook-backed device input', () => {
  assert.throws(
    () =>
      normalizeCreateDeviceInput({
        ...baseInput,
        deviceId: '',
        deviceType: 'Tablet',
        status: 'Unknown',
        ipMode: 'Static',
        os: '',
      }),
    /Device Name is required/
  );
});

test('rejects device types outside Notebook, PC, and Server for new device creation', () => {
  assert.throws(
    () =>
      normalizeCreateDeviceInput({
        ...baseInput,
        deviceType: 'Laptop',
      }),
    /Choose a valid device type/
  );
});

test('rejects non-object device input', () => {
  assert.throws(() => normalizeCreateDeviceInput(null), /Device payload must be an object/);
});

test('normalizes warranty alert timestamps into mysql-safe Date values', () => {
  const normalized = normalizeTimestampForSql('2026-05-13T00:00:00.000Z');

  assert.ok(normalized instanceof Date);
  assert.equal(normalized?.toISOString(), '2026-05-13T00:00:00.000Z');
  assert.equal(normalizeTimestampForSql(undefined), null);
});

test('creates a device keyed by deviceId instead of a generated id', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-devices-'));
  const filePath = join(directory, 'devices.json');

  try {
    const repository = new FileDeviceRepository(filePath);
    const created = await createDevice(baseInput, repository);
    const rawFile = await readFile(filePath, 'utf8');
    const persisted = JSON.parse(rawFile);

    assert.equal(created.deviceId, 'CAR200');
    assert.equal(created.assignedTo, 'sasiluk_en');
    assert.equal(created.status, 'Active');
    assert.equal(created.department, 'EN');
    assert.equal(persisted.devices[0].deviceId, 'CAR200');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects duplicate deviceId values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-devices-'));
  const repository = new FileDeviceRepository(join(directory, 'devices.json'));

  try {
    await createDevice(baseInput, repository);

    await assert.rejects(() =>
      createDevice(
        {
          ...baseInput,
          assignedTo: 'other.user',
        },
        repository
      )
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('lists saved devices with deviceId identity and string assignment fields', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-devices-'));
  const repository = new FileDeviceRepository(join(directory, 'devices.json'));

  try {
    await createDevice(baseInput, repository);

    const devices = await listDevices(repository);

    assert.equal(devices.length, 1);
    assert.equal(devices[0].deviceId, 'CAR200');
    assert.equal(devices[0].assignedTo, 'sasiluk_en');
    assert.equal(devices[0].department, 'EN');
    assert.equal(devices[0].status, 'Active');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('updates saved device status by deviceId', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-devices-'));
  const repository = new FileDeviceRepository(join(directory, 'devices.json'));

  try {
    await createDevice(baseInput, repository);

    const updated = await updateDeviceStatus('CAR200', 'Out of Service', repository);
    const devices = await listDevices(repository);

    assert.equal(updated.deviceId, 'CAR200');
    assert.equal(updated.status, 'Out of Service');
    assert.equal(devices[0].status, 'Out of Service');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('updates saved device assignment by deviceId', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-devices-'));
  const repository = new FileDeviceRepository(join(directory, 'devices.json'));

  try {
    await createDevice(baseInput, repository);

    const updated = await updateDeviceAssignedTo('CAR200', 'new.user', repository);
    const devices = await listDevices(repository);

    assert.equal(updated.deviceId, 'CAR200');
    assert.equal(updated.assignedTo, 'new.user');
    assert.equal(devices[0].assignedTo, 'new.user');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('listing devices stamps warranty alerts without deleting the saved device record', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-devices-'));
  const filePath = join(directory, 'devices.json');
  const repository = new FileDeviceRepository(filePath);
  const expiringDate = new Date();
  expiringDate.setUTCDate(expiringDate.getUTCDate() + 10);

  try {
    await createDevice(
      {
        ...baseInput,
        deviceId: 'CAR201',
        expireDatePrimary: expiringDate.toISOString().slice(0, 10),
        expireDateSecondary: '',
      },
      repository
    );

    const devices = await listDevices(repository);
    const persisted = JSON.parse(await readFile(filePath, 'utf8')) as {
      devices: Array<{ deviceId: string; warrantyAlertedAt?: string }>;
    };

    assert.equal(devices.length, 1);
    assert.equal(devices[0].deviceId, 'CAR201');
    assert.ok(devices[0].warrantyAlertedAt);
    assert.equal(persisted.devices.length, 1);
    assert.equal(persisted.devices[0].deviceId, 'CAR201');
    assert.ok(persisted.devices[0].warrantyAlertedAt);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('listing devices clears stale warranty alert timestamps when the device no longer qualifies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-devices-'));
  const filePath = join(directory, 'devices.json');
  const repository = new FileDeviceRepository(filePath);
  const farFutureDate = new Date();
  farFutureDate.setUTCDate(farFutureDate.getUTCDate() + 90);

  try {
    await upsertDevices(
      [
        {
          ...baseInput,
          expireDatePrimary: farFutureDate.toISOString().slice(0, 10),
          expireDateSecondary: '',
          warrantyAlertedAt: new Date().toISOString(),
        },
      ],
      repository
    );

    const devices = await listDevices(repository);
    const persisted = JSON.parse(await readFile(filePath, 'utf8')) as {
      devices: Array<{ warrantyAlertedAt?: string }>;
    };

    assert.equal(devices[0].warrantyAlertedAt, undefined);
    assert.equal(persisted.devices[0].warrantyAlertedAt, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
