import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  REPORT_EXCEL_HEADERS,
  ticketToReportRow,
} from '../lib/reports/excelExport';
import type { RepairTicket } from '../types';
import ReportsView, { TicketReportModal } from './ReportsView';

const SAMPLE_TICKET: RepairTicket = {
  id: 'TK-100',
  deviceName: 'OptiPlex 360',
  employeeName: 'chakrit',
  employeeEmail: 'chakrit@example.com',
  department: 'IT',
  problemType: 'Hardware Failure',
  description: 'No display after boot.',
  status: 'Completed',
  priority: 'High',
  createdAt: '2026-05-01T08:00:00.000Z',
  completedAt: '2026-05-02T09:30:00.000Z',
  notes: [],
  history: [],
  attachments: [],
};

test('uses report-specific Excel headers for exported tickets', () => {
  assert.deepEqual([...REPORT_EXCEL_HEADERS], [
    'No',
    'Ticket ID',
    'Device',
    'Department',
    'Description',
    'Solution',
    'Email',
    'Problem Type',
    'Created',
    'Completed',
    'Status',
  ]);
});

test('maps completed tickets into the report Excel row schema', () => {
  assert.deepEqual(ticketToReportRow(SAMPLE_TICKET, 0), [
    1,
    'TK-100',
    'OptiPlex 360',
    'IT',
    'No display after boot.',
    '',
    'chakrit@example.com',
    'Hardware Failure',
    '01/05/2026',
    '02/05/2026',
    'Completed',
  ]);
});

test('maps technical note content into the report solution without note metadata', () => {
  const row = ticketToReportRow(
    {
      ...SAMPLE_TICKET,
      notes: [
        {
          id: 'note-1',
          author: 'admin@repairlink.local',
          content: 'Replace damaged cable.',
          timestamp: '2026-05-02T09:00:00.000Z',
        },
        {
          id: 'note-2',
          author: 'it.support@repairlink.local',
          content: 'Confirmed the device boots normally.',
          timestamp: '2026-05-02T09:30:00.000Z',
        },
      ],
    },
    0
  );

  assert.equal(row[5], 'Replace damaged cable.\nConfirmed the device boots normally.');
});

test('report ticket modal omits legacy activity and footer labels', () => {
  const markup = renderToStaticMarkup(
    React.createElement(TicketReportModal, {
      ticket: SAMPLE_TICKET,
      onClose: () => undefined,
    })
  );

  assert.doesNotMatch(markup, /Activity Snapshot/);
  assert.doesNotMatch(markup, /Repair Report Console/);
  assert.match(markup, /Close Detail/);
});

test('renders monthly report controls and optional cross-month export flow', () => {
  const markup = renderToStaticMarkup(React.createElement(ReportsView));

  assert.match(markup, /Report Month/);
  assert.match(markup, /type="month"/);
  assert.match(markup, /Export Excel/);
  assert.doesNotMatch(markup, /last 30 days/i);
});
