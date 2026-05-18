import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import TicketManagementCenter from './TicketManagementCenter';
import type { RepairTicket } from '../types';

const SAMPLE_TICKETS: RepairTicket[] = [
  {
    id: 'TK-1',
    deviceName: 'OptiPlex 360',
    employeeName: 'chakrit',
    employeeEmail: 'chakrit@example.com',
    department: 'IT',
    problemType: 'Hardware Failure',
    description: 'No display after boot.',
    status: 'Pending',
    priority: 'High',
    createdAt: '2026-05-01T08:00:00.000Z',
    notes: [],
    history: [],
    attachments: [],
  },
];

test('does not crash when the selected ticket id no longer exists', () => {
  const markup = renderToStaticMarkup(
    React.createElement(TicketManagementCenter, {
      tickets: [],
      selectedId: 'TK-missing',
      onSelectTicket: () => undefined,
    })
  );

  assert.match(markup, /Ticket Management Center/);
  assert.doesNotMatch(markup, /Support Ticket Detail & Management/);
});

test('renders the selected ticket detail modal when the ticket exists', () => {
  const markup = renderToStaticMarkup(
    React.createElement(TicketManagementCenter, {
      tickets: SAMPLE_TICKETS,
      selectedId: 'TK-1',
      onSelectTicket: () => undefined,
    })
  );

  assert.match(markup, /TK-1/);
  assert.match(markup, /Support Ticket Detail/);
});
