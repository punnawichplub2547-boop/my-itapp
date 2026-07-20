import assert from 'node:assert/strict';
import test from 'node:test';
import type { RepairTicket } from '../../types';
import {
  createTicketCreatedEvent,
  createTicketClosedEvent,
  eventsForStatusTransition,
} from './ticketEvents';
import {
  createEmailJobFromTicketEvent,
  createEmailJobsFromTicketEvent,
} from './notificationJobs';
import { renderCustomerEmail } from './templates';
import { buildNotificationRecipients } from './recipientRouting';

const ticket: RepairTicket = {
  id: 'TK-1001',
  deviceName: 'Dell Latitude 7440',
  employeeName: 'Jane Doe',
  employeeEmail: 'jane.doe@example.com',
  department: 'Engineering',
  problemType: 'Hardware Failure',
  description: 'Screen flickers during startup.',
  status: 'Pending',
  priority: 'High',
  createdAt: '2026-05-08T08:00:00.000Z',
};

test('creates an email job for a newly created ticket event', () => {
  const event = createTicketCreatedEvent(ticket, 'admin@example.com');
  const job = createEmailJobFromTicketEvent(event);

  assert.equal(job.to, 'jane.doe@example.com');
  assert.equal(job.template, 'ticket-created');
  assert.equal(job.metadata.ticketId, 'TK-1001');
  assert.match(job.subject, /Repair request received/);
});

test('creates separate customer and employee email jobs when both recipients are requested', () => {
  const event = createTicketCreatedEvent(ticket, 'admin@example.com', {
    recipients: [
      {
        kind: 'customer',
        name: 'Jane Customer',
        email: 'jane.customer@example.com',
      },
      {
        kind: 'employee',
        name: 'Jane Employee',
        email: 'jane.employee@example.com',
      },
    ],
  });

  const jobs = createEmailJobsFromTicketEvent(event);

  assert.deepEqual(
    jobs.map((job) => job.to),
    ['jane.customer@example.com', 'jane.employee@example.com']
  );
  assert.deepEqual(
    jobs.map((job) => job.metadata.recipientKind),
    ['customer', 'employee']
  );
});

test('creates an employee email job when a non-closed status update requests employees', () => {
  const updatedTicket = { ...ticket, status: 'In Progress' as const };
  const events = eventsForStatusTransition({
    ticket: updatedTicket,
    previousStatus: 'Pending',
    nextStatus: 'In Progress',
    actorEmail: 'admin@example.com',
    notifyRecipients: ['employee'],
  });

  assert.equal(events.length, 1);

  const jobs = createEmailJobsFromTicketEvent(events[0]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].to, 'jane.doe@example.com');
  assert.equal(jobs[0].metadata.recipientKind, 'employee');
  assert.equal(jobs[0].template, 'ticket-status-updated');
});

test('builds normalized customer and employee recipients from route input', () => {
  const recipients = buildNotificationRecipients({
    ticket,
    notifyRecipients: ['customer', 'employee'],
    customerName: 'Jane Customer',
    customerEmail: ' JANE.CUSTOMER@example.com ',
  });

  assert.deepEqual(recipients, [
    {
      kind: 'customer',
      name: 'Jane Customer',
      email: 'jane.customer@example.com',
    },
    {
      kind: 'employee',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    },
  ]);
});

test('creates an email job when a ticket transitions to Closed', () => {
  const closedTicket = { ...ticket, status: 'Closed' as const };
  const events = eventsForStatusTransition({
    ticket: closedTicket,
    previousStatus: 'Completed',
    nextStatus: 'Closed',
    actorEmail: 'admin@example.com',
  });

  assert.equal(events.length, 1);

  const job = createEmailJobFromTicketEvent(events[0]);

  assert.equal(job.template, 'ticket-closed');
  assert.match(job.subject, /Repair ticket closed/);
});

test('does not create a duplicate close event when status remains Closed', () => {
  const closedTicket = { ...ticket, status: 'Closed' as const };
  const events = eventsForStatusTransition({
    ticket: closedTicket,
    previousStatus: 'Closed',
    nextStatus: 'Closed',
    actorEmail: 'admin@example.com',
  });

  assert.deepEqual(events, []);
});

test('renders customer email with both html and text bodies', () => {
  const event = createTicketClosedEvent(
    { ...ticket, status: 'Closed' },
    'admin@example.com'
  );
  const email = renderCustomerEmail(event);

  assert.match(email.subject, /TK-1001/);
  assert.match(email.html, /Jane Doe/);
  assert.match(email.html, /Closed/);
  assert.match(email.text, /Dell Latitude 7440/);
});

test('renders customer email with technician note when notes exist', () => {
  const noteTicket: RepairTicket = {
    ...ticket,
    status: 'In Progress',
    notes: [
      { id: '1', author: 'admin@example.com', content: 'ไม่ไหว', timestamp: '2026-07-20T04:48:00.000Z' },
    ],
  };
  const event = createTicketCreatedEvent(noteTicket, 'admin@example.com');
  const email = renderCustomerEmail(event);

  assert.match(email.html, /Technician Note/);
  assert.match(email.html, /ไม่ไหว/);
});
