import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAssignmentHistory,
  buildConfirmedTicketEntries,
  buildDeviceEvents,
  buildInferredTicketEntries,
  buildPersistedRepairLogEntries,
  classifyRelatedTickets,
  DEVICE_DETAIL_TABS,
  deriveAssignmentIdentity,
  getDeviceDetailHeroSubtitle,
  getDeviceDetailHeroTitle,
  getWarrantySnapshot,
} from './inventoryDetail';
import type { DeviceRepairEvent } from '../types';

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
    ['HARDWARE & OS', 'WARRANTY & LIFECYCLE', 'CURRENT ASSIGNMENT', 'REPAIR LOG']
  );
});

test('uses deviceId as hero title and includes IP address in subtitle', () => {
  assert.equal(getDeviceDetailHeroTitle(INVENTORY_DEVICE), 'CAR163');
  assert.equal(
    getDeviceDetailHeroSubtitle(INVENTORY_DEVICE),
    'Dell XPS 13 9310 Elite • Asset #64 • IP: 10.11.204.45'
  );
});

test('derives an expired warranty snapshot from the stored lifecycle fields', () => {
  const snapshot = getWarrantySnapshot(INVENTORY_DEVICE, new Date('2026-05-11T00:00:00.000Z'));

  assert.equal(snapshot.status, 'expired');
  assert.equal(snapshot.expirationText, '2024-10-12');
  assert.match(snapshot.daysRemainingText, /^-\d+ days$/);
});

test('derives an expiring soon warranty snapshot using the shared date-only lifecycle logic', () => {
  const snapshot = getWarrantySnapshot(
    {
      ...INVENTORY_DEVICE,
      expireDatePrimary: '2026-05-13',
    },
    new Date('2026-05-13T18:45:00.000Z')
  );

  assert.equal(snapshot.status, 'expiring-soon');
  assert.equal(snapshot.expirationText, '2026-05-13');
  assert.equal(snapshot.daysRemainingText, '0 days');
});

test('uses the same effective expiry date as the shared warranty helper when both expiry fields exist', () => {
  const snapshot = getWarrantySnapshot(
    {
      ...INVENTORY_DEVICE,
      expireDatePrimary: '2026-05-10',
      expireDateSecondary: '2016-06-30',
    },
    new Date('2026-05-13T00:00:00.000Z')
  );

  assert.equal(snapshot.status, 'expired');
  assert.equal(snapshot.expirationText, '2026-05-10');
  assert.equal(snapshot.daysRemainingText, '-3 days');
});

test('builds a current assignment history row from existing device fields', () => {
  const rows = buildAssignmentHistory(INVENTORY_DEVICE);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].assetUser, 'chakrit');
  assert.equal(rows[0].assetUserMeta, 'chakrit@company.local');
  assert.equal(rows[0].department, 'IT OPERATIONS');
  assert.equal(rows[0].status, 'In possession');
});

// ── buildDeviceEvents ──────────────────────────────────────────────────────────

test('buildDeviceEvents returns a confirmed device-note entry from device.notes', () => {
  const events = buildDeviceEvents(INVENTORY_DEVICE);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, 'LOG-CAR163');
  assert.equal(events[0].detail, 'Keyboard replaced under warranty.');
  assert.equal(events[0].matchConfidence, undefined, 'device events have no matchConfidence');
  assert.equal(events[0].inferredSource, undefined, 'device events have no inferredSource');
});

test('buildDeviceEvents returns empty array when device.notes is empty', () => {
  assert.deepEqual(buildDeviceEvents({ ...INVENTORY_DEVICE, notes: '' }), []);
});

// ── classifyRelatedTickets ─────────────────────────────────────────────────────

const BASE_TICKET = {
  id: 'TK-BASE',
  deviceName: 'Dell XPS 13 9310 Elite',
  employeeName: 'chakrit',
  employeeEmail: 'chakrit@example.com',
  department: 'IT OPERATIONS',
  problemType: 'Hardware',
  description: 'Screen flickering',
  status: 'Pending' as const,
  priority: 'Medium' as const,
  createdAt: '2024-03-01T09:00:00.000Z',
};

test('classifyRelatedTickets assigns medium confidence when model and department both match', () => {
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [BASE_TICKET]);
  assert.equal(classified.length, 1);
  assert.equal(classified[0].matchConfidence, 'medium');
  assert.ok(classified[0].matchReasons.some((r) => r.includes('Department')));
});

test('classifyRelatedTickets assigns low confidence when model matches but department differs', () => {
  const ticket = { ...BASE_TICKET, department: 'FINANCE' };
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [ticket]);
  assert.equal(classified.length, 1);
  assert.equal(classified[0].matchConfidence, 'low');
});

test('classifyRelatedTickets assigns high confidence when ticket content references the deviceId', () => {
  const ticket = { ...BASE_TICKET, description: 'Screen flickering on device CAR163' };
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [ticket]);
  assert.equal(classified.length, 1);
  assert.equal(classified[0].matchConfidence, 'high');
  // Reason must name the matched identifier, not the model.
  assert.ok(classified[0].matchReasons.some((r) => r.includes('CAR163')));
  assert.ok(classified[0].matchReasons.some((r) => r.toLowerCase().includes('identifier')));
});

test('classifyRelatedTickets assigns high confidence even when ticket.deviceName does not match the device model', () => {
  // This is the key regression test: identifier check must run before the model gate.
  const ticket = { ...BASE_TICKET, deviceName: 'HP EliteBook 840', description: 'Device CAR163 has screen issues' };
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [ticket]);
  assert.equal(classified.length, 1, 'ticket with device identifier in content must be included despite model mismatch');
  assert.equal(classified[0].matchConfidence, 'high');
  assert.ok(classified[0].matchReasons.some((r) => r.includes('CAR163')));
});

test('classifyRelatedTickets excludes ticket with no model match and no identifier in content', () => {
  // No identifier in description, model is different → excluded entirely.
  const ticket = { ...BASE_TICKET, deviceName: 'HP EliteBook 840' };
  assert.deepEqual(classifyRelatedTickets(INVENTORY_DEVICE, [ticket]), []);
});

test('classifyRelatedTickets is case-insensitive on model name', () => {
  const ticket = { ...BASE_TICKET, deviceName: 'dell xps 13 9310 elite' };
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [ticket]);
  assert.equal(classified.length, 1);
});

test('classifyRelatedTickets returns empty array when device has no model and no usable identifiers', () => {
  // deviceId 'CAR163' is still present — only suppress when genuinely nothing to match on.
  // Use a device stub with empty model and a short deviceId (below the 4-char threshold).
  const stubDevice = { ...INVENTORY_DEVICE, model: '', deviceId: 'X1', assetNo: '1' };
  assert.deepEqual(classifyRelatedTickets(stubDevice, [BASE_TICKET]), []);
});

// ── buildInferredTicketEntries ─────────────────────────────────────────────────

test('buildInferredTicketEntries does not use employeeName as technician for creation entries', () => {
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [BASE_TICKET]);
  const entries = buildInferredTicketEntries(classified);

  const entry = entries.find((e) => e.eventId === 'TK-BASE');
  assert.ok(entry, 'expected a ticket-derived entry');
  assert.ok(entry?.detail.includes('Screen flickering'), 'description must be in detail');
  assert.ok(entry?.detail.includes('chakrit'), 'requester name must appear in detail');
  assert.equal(entry?.technician, 'Unassigned', 'technician must be Unassigned for new tickets');
  assert.equal(entry?.matchConfidence, 'medium');
  assert.ok(entry?.inferredSource?.includes('Department'), 'inferredSource must explain the match');
});

test('buildInferredTicketEntries emits history events and does not use employeeName as technician', () => {
  const ticket = {
    ...BASE_TICKET,
    id: 'TK-HIST',
    history: [
      { id: 'h1', action: 'Status changed to In Progress', user: 'admin@it.local', timestamp: '2024-04-02T10:00:00.000Z' },
    ],
  };
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [ticket]);
  const entries = buildInferredTicketEntries(classified);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventId, 'TK-HIST');
  assert.ok(entries[0].title.includes('Status changed to In Progress'));
  assert.equal(entries[0].timestamp, '2024-04-02');
  assert.notEqual(entries[0].technician, 'chakrit', 'employeeName must not appear as technician');
  assert.equal(entries[0].technician, 'admin@it.local');
  assert.ok(entries[0].matchConfidence !== undefined, 'inferred entries must carry matchConfidence');
});

test('normalizes assignment identities into an email-like label', () => {
  assert.equal(deriveAssignmentIdentity('chakrit'), 'chakrit@company.local');
  assert.equal(deriveAssignmentIdentity('chakrit@car-1996.com'), 'chakrit@car-1996.com');
});

// ── buildConfirmedTicketEntries ────────────────────────────────────────────────

test('buildConfirmedTicketEntries returns a creation entry for a ticket with matching deviceId', () => {
  const ticket = { ...BASE_TICKET, id: 'TK-CONFIRMED', deviceId: 'CAR163' };
  const entries = buildConfirmedTicketEntries(INVENTORY_DEVICE, [ticket]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventId, 'TK-CONFIRMED');
  assert.ok(entries[0].detail.includes('Screen flickering'), 'description in detail');
  assert.ok(entries[0].detail.includes('chakrit'), 'requester in detail');
  assert.equal(entries[0].matchConfidence, undefined, 'confirmed entries have no matchConfidence');
  assert.equal(entries[0].inferredSource, undefined, 'confirmed entries have no inferredSource');
  assert.equal(entries[0].technician, 'Unassigned');
  assert.equal(entries[0].status, 'Pending');
});

test('buildConfirmedTicketEntries returns empty array when no tickets have matching deviceId', () => {
  const ticket = { ...BASE_TICKET, deviceId: 'OTHER-DEVICE' };
  assert.deepEqual(buildConfirmedTicketEntries(INVENTORY_DEVICE, [ticket]), []);
});

test('buildConfirmedTicketEntries returns empty array for tickets without deviceId', () => {
  assert.deepEqual(buildConfirmedTicketEntries(INVENTORY_DEVICE, [BASE_TICKET]), []);
});

test('buildConfirmedTicketEntries emits history events for confirmed tickets', () => {
  const ticket = {
    ...BASE_TICKET,
    id: 'TK-CHIST',
    deviceId: 'CAR163',
    history: [
      { id: 'h1', action: 'Status changed to In Progress', user: 'admin@it.local', timestamp: '2024-05-01T10:00:00.000Z' },
    ],
  };
  const entries = buildConfirmedTicketEntries(INVENTORY_DEVICE, [ticket]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventId, 'TK-CHIST');
  assert.ok(entries[0].title.includes('Status changed to In Progress'));
  assert.equal(entries[0].technician, 'admin@it.local');
  assert.equal(entries[0].matchConfidence, undefined);
});

test('classifyRelatedTickets excludes tickets that are confirmed by deviceId', () => {
  const ticket = { ...BASE_TICKET, deviceId: 'CAR163' };
  assert.deepEqual(classifyRelatedTickets(INVENTORY_DEVICE, [ticket]), []);
});

// ── buildPersistedRepairLogEntries ────────────────────────────────────────────

const BASE_REPAIR_EVENT: DeviceRepairEvent = {
  id: 'evt-1111-2222-3333-4444',
  deviceId: 'CAR163',
  ticketId: 'TK-99',
  eventType: 'ticket_created',
  title: 'Ticket Created',
  description: 'Reported by chakrit: Screen flickering',
  problemType: 'Hardware',
  status: 'Pending',
  reportedBy: 'chakrit',
  technician: 'Unassigned',
  createdBy: 'admin@repairlink.local',
  createdAt: '2026-05-10T09:00:00.000Z',
  source: 'ticket',
};

test('buildPersistedRepairLogEntries converts a ticket_created event to a RepairLogEntry', () => {
  const entries = buildPersistedRepairLogEntries([BASE_REPAIR_EVENT]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'evt-1111-2222-3333-4444');
  assert.equal(entries[0].eventId, 'TK-99');
  assert.equal(entries[0].title, 'TK-99 — Ticket Created');
  assert.ok(entries[0].detail.includes('chakrit'), 'detail must mention the reporter');
  assert.ok(entries[0].detail.includes('Screen flickering'), 'detail must include description');
  assert.equal(entries[0].technician, 'Unassigned');
  assert.equal(entries[0].status, 'Pending');
  assert.equal(entries[0].matchConfidence, undefined, 'persisted entries must have no matchConfidence');
  assert.equal(entries[0].inferredSource, undefined, 'persisted entries must have no inferredSource');
});

test('buildPersistedRepairLogEntries converts a ticket_deleted event', () => {
  const event: DeviceRepairEvent = {
    ...BASE_REPAIR_EVENT,
    id: 'evt-deleted',
    eventType: 'ticket_deleted',
    title: 'Ticket Deleted',
    description: 'Ticket deleted. Last status: Completed.',
    status: 'Completed',
    technician: undefined,
    createdBy: 'admin@repairlink.local',
  };
  const entries = buildPersistedRepairLogEntries([event]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'TK-99 — Ticket Deleted');
  assert.equal(entries[0].technician, 'admin@repairlink.local');
});

test('buildPersistedRepairLogEntries converts a ticket_status_changed event', () => {
  const event: DeviceRepairEvent = {
    ...BASE_REPAIR_EVENT,
    id: 'evt-status',
    eventType: 'ticket_status_changed',
    status: 'In Progress',
    technician: 'admin@repairlink.local',
  };
  const entries = buildPersistedRepairLogEntries([event]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'TK-99 — Status Changed to In Progress');
  assert.equal(entries[0].status, 'In Progress');
});

test('buildPersistedRepairLogEntries converts a ticket_completed event', () => {
  const event: DeviceRepairEvent = {
    ...BASE_REPAIR_EVENT,
    id: 'evt-completed',
    eventType: 'ticket_completed',
    status: 'Completed',
    technician: 'admin@repairlink.local',
  };
  const entries = buildPersistedRepairLogEntries([event]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'TK-99 — Ticket Completed');
  assert.equal(entries[0].status, 'Completed');
});

test('buildPersistedRepairLogEntries returns empty array for empty event list', () => {
  assert.deepEqual(buildPersistedRepairLogEntries([]), []);
});

test('buildPersistedRepairLogEntries uses EVT- prefix eventId when no ticketId', () => {
  const event: DeviceRepairEvent = {
    ...BASE_REPAIR_EVENT,
    id: 'abcdef12-0000-0000-0000-000000000000',
    ticketId: undefined,
    eventType: 'device_note',
    title: 'Device Note',
  };
  const entries = buildPersistedRepairLogEntries([event]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'Device Note');
  assert.equal(entries[0].eventId, 'EVT-abcdef12');
});

test('classifyRelatedTickets still includes tickets whose deviceId targets a different device', () => {
  const ticket = { ...BASE_TICKET, deviceId: 'OTHER-DEVICE' };
  const classified = classifyRelatedTickets(INVENTORY_DEVICE, [ticket]);
  // deviceId is set but for a different device, so heuristic matching still runs
  assert.equal(classified.length, 1);
  assert.equal(classified[0].matchConfidence, 'medium');
});
