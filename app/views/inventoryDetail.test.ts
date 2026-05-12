import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAssignmentHistory,
  buildRepairLog,
  DEVICE_DETAIL_TABS,
  deriveAssignmentIdentity,
  getDeviceDetailHeroSubtitle,
  getDeviceDetailHeroTitle,
  getWarrantySnapshot,
} from './inventoryDetail';

const INVENTORY_DEVICE = {
  deviceId: 'CAR163',
  assetNo: '64',
  ipMode: 'Manual',
  ipAddress: '10.11.204.45',
  department: 'IT OPERATIONS',
  assignedTo: 'chakrit',
  deviceType: 'Laptop',
  model: 'Dell XPS 13 9310 Elite',
  hdd: '512GB NVMe SSD',
  ram: '16GB LPDDR4x',
  cpu: 'Intel Core i7-1185G7',
  installDate: '2023-10-12',
  expireDatePrimary: '2024-10-12',
  expireDateSecondary: '',
  warranty: '1',
  yearValue: 'FY 2021 Procurement Cycle',
  os: 'Windows 11 Pro',
  osLicense: 'OEM Digital',
  msOfficeVersion: 'Office 2021 Pro Plus',
  status: 'Active',
  notes: 'Keyboard replaced under warranty.',
  createdAt: '2023-10-12T00:00:00.000Z',
  updatedAt: '2023-10-14T00:00:00.000Z',
} as const;

test('exposes the device detail tabs from the reference layout', () => {
  assert.deepEqual(
    DEVICE_DETAIL_TABS.map((tab) => tab.label),
    ['HARDWARE & OS', 'WARRANTY & LIFECYCLE', 'ASSIGNMENT HISTORY', 'REPAIR LOG']
  );
});

test('prefers the device IP address as the hero title with a fallback subtitle from current db fields', () => {
  assert.equal(getDeviceDetailHeroTitle(INVENTORY_DEVICE), '10.11.204.45');
  assert.equal(
    getDeviceDetailHeroSubtitle(INVENTORY_DEVICE),
    'Dell XPS 13 9310 Elite • Asset #64 • ID: CAR163'
  );
});

test('derives an expired warranty snapshot from the stored lifecycle fields', () => {
  const snapshot = getWarrantySnapshot(INVENTORY_DEVICE, new Date('2026-05-11T00:00:00.000Z'));

  assert.equal(snapshot.status, 'expired');
  assert.equal(snapshot.expirationText, '2024-10-12');
  assert.match(snapshot.daysRemainingText, /^-\d+ days$/);
});

test('builds a current assignment history row from existing device fields', () => {
  const rows = buildAssignmentHistory(INVENTORY_DEVICE);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].assetUser, 'chakrit');
  assert.equal(rows[0].assetUserMeta, 'chakrit@company.local');
  assert.equal(rows[0].department, 'IT OPERATIONS');
  assert.equal(rows[0].status, 'In possession');
});

test('builds a repair log entry from the existing notes field', () => {
  const entries = buildRepairLog(INVENTORY_DEVICE);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventId, 'LOG-CAR163');
  assert.equal(entries[0].detail, 'Keyboard replaced under warranty.');
});

test('normalizes assignment identities into an email-like label', () => {
  assert.equal(deriveAssignmentIdentity('chakrit'), 'chakrit@company.local');
  assert.equal(deriveAssignmentIdentity('chakrit@car-1996.com'), 'chakrit@car-1996.com');
});
