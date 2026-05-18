import { after } from 'next/server';
import type { RepairTicket } from '../../types';
import { requireAuthenticatedRequest } from '../../lib/auth/mockUser';
import { dispatchTicketNotificationEvent } from '../../lib/notifications/eventDispatcher';
import {
  createTicket,
  listTickets,
  TicketValidationError,
} from '../../lib/tickets/ticketService';
import { appendDeviceRepairEvent } from '../../lib/devices/deviceRepairEventService';
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
  deviceId?: string;
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
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  let body: Partial<CreateTicketRequest>;

  try {
    body = (await request.json()) as Partial<CreateTicketRequest>;
  } catch {
    return Response.json({ error: 'Invalid ticket payload.' }, { status: 400 });
  }

  console.log('[api/tickets] raw body:', body);

  const { deviceId, deviceName, employeeName, employeeEmail, department, problemType, description } = body;

  console.log('[api/tickets] parsed fields:', {
    deviceId,
    deviceName,
    employeeName,
    employeeEmail,
    department,
    problemType,
    description,
  });

  const missingFields: Record<string, boolean> = {
    deviceName: !isNonEmptyString(deviceName),
    employeeName: !isNonEmptyString(employeeName),
    employeeEmail: !isNonEmptyString(employeeEmail),
    department: !isNonEmptyString(department),
    problemType: !isNonEmptyString(problemType),
    description: !isNonEmptyString(description),
  };

  console.log('[api/tickets] missing fields:', missingFields);

  const missingFieldNames = Object.entries(missingFields)
    .filter(([, missing]) => missing)
    .map(([name]) => name);

  if (missingFieldNames.length > 0) {
    return Response.json(
      { error: 'Missing required fields', missingFields },
      { status: 400 }
    );
  }

  if (!isValidEmail(employeeEmail)) {
    return Response.json(
      { error: 'Invalid employeeEmail format' },
      { status: 400 }
    );
  }

  if (!isValidNotifyRecipients(body.notifyRecipients)) {
    return Response.json(
      { error: 'notifyRecipients must be an array of "customer" or "employee" values.' },
      { status: 400 }
    );
  }

  const effectiveNotifyRecipients =
    body.notifyRecipients === undefined
      ? (['employee'] satisfies NotificationRecipientKind[])
      : body.notifyRecipients;
  const shouldNotify = effectiveNotifyRecipients.length > 0;

  const validBody = body as CreateTicketRequest;
  const ticketPreview = buildTicketPreview(validBody);

  let recipients: ReturnType<typeof buildNotificationRecipients> = [];
  if (shouldNotify) {
    if (!hasValidRecipientOverrides(body)) {
      return Response.json(
        { error: 'customerName and customerEmail must be strings when provided.' },
        { status: 400 }
      );
    }

    recipients = buildNotificationRecipients({
      ticket: ticketPreview,
      notifyRecipients: effectiveNotifyRecipients,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
    });

    if (recipients.length === 0) {
      return Response.json(
        { error: 'At least one valid customer or employee recipient email is required.' },
        { status: 400 }
      );
    }
  }

  let ticket: RepairTicket;

  try {
    ticket = await createTicket({
      deviceId: validBody.deviceId,
      deviceName: validBody.deviceName,
      employeeName: validBody.employeeName,
      employeeEmail: validBody.employeeEmail,
      department: validBody.department,
      problemType: validBody.problemType,
      description: validBody.description,
      priority: validBody.priority,
      actorEmail: validBody.actorEmail,
    });
  } catch (error) {
    if (error instanceof TicketValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  // Persist a device repair event so Repair Log survives ticket deletion (best-effort)
  if (ticket.deviceId) {
    try {
      await appendDeviceRepairEvent({
        deviceId: ticket.deviceId,
        ticketId: ticket.id,
        eventType: 'ticket_created',
        title: 'Ticket Created',
        description: `Reported by ${ticket.employeeName}: ${ticket.description}`,
        problemType: ticket.problemType,
        status: ticket.status,
        reportedBy: ticket.employeeName,
        technician: 'Unassigned',
        createdBy: validBody.actorEmail ?? 'system@repairlink.local',
        createdAt: ticket.createdAt,
        source: 'ticket',
      });
    } catch {
      // best-effort — do not block ticket creation
    }
  }

  if (shouldNotify) {
    const dispatcher = notificationDispatcher;
    scheduleTicketNotificationDispatch(() => {
      dispatcher(
        createTicketCreatedEvent(ticket, validBody.actorEmail ?? 'system@repairlink.local', {
          recipients,
        })
      );
    });
  }

  return Response.json({ ticket }, { status: 201 });
}

export async function GET(request?: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const tickets = await listTickets();
  return Response.json({ tickets });
}

export function setTicketNotificationDispatcherForTest(
  dispatcher: NotificationDispatcher | null
) {
  notificationDispatcher = dispatcher ?? dispatchTicketNotificationEvent;
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
    deviceId: body.deviceId?.trim() || undefined,
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
