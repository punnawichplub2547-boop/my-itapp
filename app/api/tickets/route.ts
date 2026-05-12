import { after } from 'next/server';
import type { RepairTicket } from '../../types';
import { dispatchTicketNotificationEvent } from '../../lib/notifications/eventDispatcher';
import {
  createTicket,
  listTickets,
  TicketValidationError,
} from '../../lib/tickets/ticketService';
import {
  buildNotificationRecipients,
  isValidEmail,
} from '../../lib/notifications/recipientRouting';
import { createTicketCreatedEvent } from '../../lib/notifications/ticketEvents';
import type { NotificationRecipientKind } from '../../lib/notifications/ticketEvents';

export const runtime = 'nodejs';

type NotificationDispatcher = typeof dispatchTicketNotificationEvent;

let notificationDispatcher: NotificationDispatcher = dispatchTicketNotificationEvent;

interface CreateTicketRequest {
  deviceName: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  problemType: string;
  description: string;
  priority?: RepairTicket['priority'];
  actorEmail?: string;
  customerName?: string;
  customerEmail?: string;
  notifyRecipients?: NotificationRecipientKind[];
}

export async function POST(request: Request) {
  let body: Partial<CreateTicketRequest>;

  try {
    body = (await request.json()) as Partial<CreateTicketRequest>;
  } catch {
    return Response.json({ error: 'Invalid ticket payload.' }, { status: 400 });
  }

  if (!isCreateTicketRequest(body)) {
    return Response.json(
      { error: 'deviceName, employeeName, employeeEmail, department, problemType, and description are required.' },
      { status: 400 }
    );
  }

  const ticketPreview = buildTicketPreview(body);

  if (!hasValidRecipientOverrides(body)) {
    return Response.json(
      { error: 'customerName and customerEmail must be strings when provided.' },
      { status: 400 }
    );
  }

  const recipients = buildNotificationRecipients({
    ticket: ticketPreview,
    notifyRecipients: body.notifyRecipients,
    customerName: body.customerName,
    customerEmail: body.customerEmail,
  });

  if (recipients.length === 0) {
    return Response.json(
      { error: 'At least one valid customer or employee recipient email is required.' },
      { status: 400 }
    );
  }

  let ticket: RepairTicket;

  try {
    ticket = await createTicket({
      deviceName: body.deviceName,
      employeeName: body.employeeName,
      employeeEmail: body.employeeEmail,
      department: body.department,
      problemType: body.problemType,
      description: body.description,
      priority: body.priority,
      actorEmail: body.actorEmail,
    });
  } catch (error) {
    if (error instanceof TicketValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  const dispatcher = notificationDispatcher;

  scheduleTicketNotificationDispatch(() => {
    dispatcher(
      createTicketCreatedEvent(ticket, body.actorEmail ?? 'system@repairlink.local', {
        recipients,
      })
    );
  });

  return Response.json({ ticket }, { status: 201 });
}

export async function GET() {
  const tickets = await listTickets();
  return Response.json({ tickets });
}

export function setTicketNotificationDispatcherForTest(
  dispatcher: NotificationDispatcher | null
) {
  notificationDispatcher = dispatcher ?? dispatchTicketNotificationEvent;
}

function isCreateTicketRequest(
  body: Partial<CreateTicketRequest>
): body is CreateTicketRequest {
  return (
    isNonEmptyString(body.deviceName) &&
    isNonEmptyString(body.employeeName) &&
    isValidEmail(body.employeeEmail) &&
    isNonEmptyString(body.department) &&
    isNonEmptyString(body.problemType) &&
    isNonEmptyString(body.description) &&
    isValidNotifyRecipients(body.notifyRecipients)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidNotifyRecipients(value: unknown): value is NotificationRecipientKind[] | undefined {
  if (value === undefined) {
    return true;
  }

  return (
    Array.isArray(value) &&
    value.every((recipient) => recipient === 'customer' || recipient === 'employee')
  );
}

function hasValidRecipientOverrides(body: Partial<CreateTicketRequest>) {
  return isOptionalString(body.customerName) && isOptionalString(body.customerEmail);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function buildTicketPreview(body: CreateTicketRequest): RepairTicket {
  return {
    id: 'TK-TEST-PREVIEW',
    deviceName: body.deviceName.trim(),
    employeeName: body.employeeName.trim(),
    employeeEmail: body.employeeEmail.trim(),
    department: body.department.trim(),
    problemType: body.problemType.trim(),
    description: body.description.trim(),
    status: 'Pending',
    priority: body.priority ?? 'Medium',
    createdAt: new Date().toISOString(),
    notes: [],
    history: [],
    attachments: [],
  };
}

function scheduleTicketNotificationDispatch(callback: () => void) {
  try {
    after(callback);
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside a request scope')) {
      callback();
      return;
    }

    throw error;
  }
}
