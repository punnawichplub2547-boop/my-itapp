import assert from 'node:assert/strict';
import test from 'node:test';

import type { Device, RepairTicket } from '../../types';
import { buildAppSearchGroups, flattenAppSearchGroups } from './appSearch';

const DEVICES: Device[] = [
  {
    deviceId: 'CAR-001',
    assetNo: 'A-01',
    ipMode: 'DHCP',
    ipAddress: '10.0.0.10',
    department: 'IT',
    assignedTo: 'alice',
    deviceType: 'Notebook',
    model: 'ThinkBook 15',
    hdd: '512 GB',
    ram: '16',
    cpu: 'Ryzen 7',
    installDate: '2024-01-01',
    expireDatePrimary: '2026-05-20',
    expireDateSecondary: '',
    warranty: '3 Years',
    yearValue: '2024',
    os: 'Windows 11 Pro',
    osLicense: 'OEM',
    msOfficeVersion: '2021',
    status: 'Active',
    notes: '',
  },
  {
    deviceId: 'SRV-010',
    assetNo: 'S-10',
    ipMode: 'Manual',
    ipAddress: '10.0.1.5',
    department: 'Operations',
    assignedTo: 'infra',
    deviceType: 'Server',
    model: 'Dell PowerEdge',
    hdd: '2 TB',
    ram: '64',
    cpu: 'Xeon',
    installDate: '2022-01-01',
    expireDatePrimary: '2026-05-01',
    expireDateSecondary: '',
    warranty: '5 Years',
    yearValue: '2022',
    os: 'Windows Server',
    osLicense: 'Volume',
    msOfficeVersion: '',
    status: 'Active',
    notes: '',
  },
];

const TICKETS: RepairTicket[] = [
  {
    id: 'TK-100',
    deviceName: 'ThinkBook 15',
    employeeName: 'Alice',
    employeeEmail: 'alice@example.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'Battery replacement needed',
    status: 'In Progress',
    priority: 'High',
    createdAt: '2026-05-10T09:00:00.000Z',
  },
];

test('returns grouped matches for devices, tickets, and warranty records', () => {
  const groups = buildAppSearchGroups('thinkbook', DEVICES, TICKETS);

  assert.equal(groups.devices.length, 1);
  assert.equal(groups.tickets.length, 1);
  assert.equal(groups.warranties.length, 1);
});

test('finds ticket results by description text', () => {
  const groups = buildAppSearchGroups('battery', DEVICES, TICKETS);

  assert.equal(groups.tickets[0]?.ticketId, 'TK-100');
});

test('finds warranty results by status text', () => {
  const groups = buildAppSearchGroups('expired', DEVICES, TICKETS, {
    now: new Date('2026-05-10T00:00:00.000Z'),
  });

  assert.equal(groups.warranties[0]?.deviceId, 'SRV-010');
});

test('returns flattened results ordered by score', () => {
  const results = flattenAppSearchGroups(buildAppSearchGroups('car-001', DEVICES, TICKETS));

  assert.equal(results[0]?.type, 'device');
  assert.equal(results[0]?.deviceId, 'CAR-001');
});
