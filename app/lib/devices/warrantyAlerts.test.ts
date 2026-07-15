import assert from 'node:assert/strict';
import test from 'node:test';

import type { Device } from '../../types';
import {
  getWarrantyExpiryDate,
  getVisibleWarrantyAlerts,
  getWarrantyAlertStatus,
  getWarrantyLifecycle,
  parseDeviceDate,
  syncWarrantyAlert,
} from './warrantyAlerts';

const FIXED_NOW = new Date('2026-05-13T00:00:00.000Z');

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    deviceId: 'CAR500',
    assetNo: '500',
    ipMode: 'DHCP',
    ipAddress: '',
    department: 'IT',
    assignedTo: 'owner',
    assignedEmail: '',
    deviceType: 'Notebook',
    model: 'ThinkBook',
    hdd: '512 GB',
    ram: '16',
    cpu: 'Ryzen 7',
    installDate: '2024-01-01',
    expireDatePrimary: '2026-06-01',
    expireDateSecondary: '',
    warranty: '3 Years',
    yearValue: '2024',
    os: 'Windows 11 Pro',
    osLicense: 'OEM',
    msOfficeVersion: '2021',
    status: 'Active',
    notes: '',
    ...overrides,
  };
}

test('classifies devices expiring within 30 days as expiring soon', () => {
  const status = getWarrantyAlertStatus(
    buildDevice({ expireDatePrimary: '2026-05-20' }),
    FIXED_NOW
  );

  assert.equal(status.kind, 'expiring-soon');
  assert.equal(status.daysRemaining, 7);
});

test('treats warranty expiry on the current day as expiring soon, not expired', () => {
  const lifecycle = getWarrantyLifecycle(
    buildDevice({ expireDatePrimary: '2026-05-13' }),
    FIXED_NOW
  );

  assert.equal(lifecycle.state, 'expiring-soon');
  assert.equal(lifecycle.daysRemaining, 0);
});

test('treats warranty dates more than 30 days away as active', () => {
  const lifecycle = getWarrantyLifecycle(
    buildDevice({ expireDatePrimary: '2026-06-20' }),
    FIXED_NOW
  );

  assert.equal(lifecycle.state, 'active');
  assert.equal(lifecycle.daysRemaining, 38);
});

test('prefers the primary expiry field when both stored warranty dates are present', () => {
  const expiryDate = getWarrantyExpiryDate(
    buildDevice({
      expireDatePrimary: '2026-05-10',
      expireDateSecondary: '2016-06-30',
    })
  );

  assert.equal(expiryDate?.toISOString().slice(0, 10), '2026-05-10');
});

test('sets a warranty alert timestamp when a qualifying alert is first discovered', () => {
  const alert = syncWarrantyAlert(
    buildDevice({ expireDatePrimary: '2026-05-20', warrantyAlertedAt: undefined }),
    FIXED_NOW
  );

  assert.equal(alert.kind, 'expiring-soon');
  assert.equal(alert.visible, true);
  assert.equal(alert.nextAlertedAt, '2026-05-13T00:00:00.000Z');
  assert.equal(alert.shouldPersist, true);
});

test('hides alerts once the stored alert timestamp is older than seven days', () => {
  const alert = syncWarrantyAlert(
    buildDevice({
      expireDatePrimary: '2026-05-20',
      warrantyAlertedAt: '2026-05-05T14:30:00.000Z',
    }),
    FIXED_NOW
  );

  assert.equal(alert.kind, 'expiring-soon');
  assert.equal(alert.visible, false);
  assert.equal(alert.nextAlertedAt, '2026-05-05T00:00:00.000Z');
});

test('resets the alert timestamp when a device moves from expiring soon into expired', () => {
  const alert = syncWarrantyAlert(
    buildDevice({
      expireDatePrimary: '2026-05-10',
      warrantyAlertedAt: '2026-05-01T00:00:00.000Z',
    }),
    FIXED_NOW
  );

  assert.equal(alert.kind, 'expired');
  assert.equal(alert.visible, true);
  assert.equal(alert.nextAlertedAt, '2026-05-13T00:00:00.000Z');
  assert.equal(alert.shouldPersist, true);
});

test('clears the alert timestamp when the device no longer qualifies for a warranty alert', () => {
  const alert = syncWarrantyAlert(
    buildDevice({
      expireDatePrimary: '2026-09-10',
      warrantyAlertedAt: '2026-05-11T00:00:00.000Z',
    }),
    FIXED_NOW
  );

  assert.equal(alert.kind, null);
  assert.equal(alert.visible, false);
  assert.equal(alert.nextAlertedAt, undefined);
  assert.equal(alert.shouldPersist, true);
});

test('sorts visible alerts with expired items first and newest alert dates first within each group', () => {
  const alerts = getVisibleWarrantyAlerts(
    [
      buildDevice({
        deviceId: 'EXP-OLD',
        expireDatePrimary: '2026-05-01',
        warrantyAlertedAt: '2026-05-10T00:00:00.000Z',
      }),
      buildDevice({
        deviceId: 'SOON-NEW',
        expireDatePrimary: '2026-05-20',
        warrantyAlertedAt: '2026-05-12T00:00:00.000Z',
      }),
      buildDevice({
        deviceId: 'EXP-NEW',
        expireDatePrimary: '2026-05-02',
        warrantyAlertedAt: '2026-05-12T00:00:00.000Z',
      }),
      buildDevice({
        deviceId: 'HIDDEN',
        expireDatePrimary: '2026-05-20',
        warrantyAlertedAt: '2026-05-01T00:00:00.000Z',
      }),
    ],
    FIXED_NOW
  );

  assert.deepEqual(
    alerts.map((alert) => alert.device.deviceId),
    ['EXP-NEW', 'EXP-OLD', 'SOON-NEW']
  );
});

test('parseDeviceDate returns undefined for DD/MM/YYYY with month 13 (rollover)', () => {
  assert.equal(parseDeviceDate('01/13/2025'), undefined);
});

test('parseDeviceDate returns undefined for DD/MM/YYYY with day 31 in February (rollover)', () => {
  assert.equal(parseDeviceDate('31/02/2025'), undefined);
});
