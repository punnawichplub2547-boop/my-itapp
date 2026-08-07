import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMonthlyReportSelection,
  filterTicketsByCreatedMonth,
  formatThaiMonthYear,
  normalizeReportMonth,
} from './monthlyTickets';
import type { RepairTicket } from '../../types';

const MONTHLY_TICKETS: RepairTicket[] = [
  createTicket({
    id: 'TK-MAY-PENDING',
    status: 'Pending',
    createdAt: '2026-05-01T08:00:00.000Z',
  }),
  createTicket({
    id: 'TK-MAY-CLOSED',
    status: 'Closed',
    createdAt: '2026-05-21T08:00:00.000Z',
  }),
  createTicket({
    id: 'TK-APR-COMPLETED',
    status: 'Completed',
    createdAt: '2026-04-30T08:00:00.000Z',
  }),
  createTicket({
    id: 'TK-JUN-WAITING',
    status: 'Waiting for Parts',
    createdAt: '2026-06-01T08:00:00.000Z',
  }),
];

test('filters monthly report tickets by created month across every ticket status', () => {
  assert.deepEqual(
    filterTicketsByCreatedMonth(MONTHLY_TICKETS, '2026-05').map((ticket) => ticket.id),
    ['TK-MAY-CLOSED', 'TK-MAY-PENDING']
  );
});

test('adds explicitly selected tickets from other months to a monthly export once', () => {
  assert.deepEqual(
    buildMonthlyReportSelection(MONTHLY_TICKETS, '2026-05', [
      'TK-APR-COMPLETED',
      'TK-MAY-PENDING',
      'missing-ticket',
    ]).map((ticket) => ticket.id),
    ['TK-MAY-CLOSED', 'TK-MAY-PENDING', 'TK-APR-COMPLETED']
  );
});

test('normalizes report months and rejects invalid values', () => {
  assert.equal(normalizeReportMonth('2026-05'), '2026-05');
  assert.equal(normalizeReportMonth('2026-5'), null);
  assert.equal(normalizeReportMonth('May 2026'), null);
});

test('formats Thai month and Buddhist era year for reports', () => {
  assert.equal(formatThaiMonthYear('2026-08'), 'ประจำเดือน สิงหาคม ปี 2569');
  assert.equal(formatThaiMonthYear('2026-01'), 'ประจำเดือน มกราคม ปี 2569');
  assert.equal(formatThaiMonthYear(new Date('2026-12-15T00:00:00Z')), 'ประจำเดือน ธันวาคม ปี 2569');
});

function createTicket(overrides: Partial<RepairTicket>): RepairTicket {
  return {
    id: 'TK-BASE',
    deviceName: 'CAR001',
    employeeName: 'chakrit',
    employeeEmail: 'chakrit@example.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'No display after boot.',
    status: 'Pending',
    priority: 'Medium',
    createdAt: '2026-05-01T08:00:00.000Z',
    notes: [],
    history: [],
    attachments: [],
    ...overrides,
  };
}
