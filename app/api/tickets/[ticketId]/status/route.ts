import { after } from 'next/server';
import type { RepairTicket } from '../../../../types';
import { requireAuthenticatedRequest } from '../../../../lib/auth/mockUser';
import { dispatchTicketNotificationEvent } from '../../../../lib/notifications/eventDispatcher';
import {
  findTicketById,
  TicketNotFoundError,
  TicketStatusConflictError,
  TicketValidationError,
  transitionTicketStatusWithActor,
} from '../../../../lib/tickets/ticketService';
import { appendDeviceRepairEvent } from '../../../../lib/devices/deviceRepairEventService';
import {
  buildNotificationRecipients,
  isValidEmail,
} from '../../../../lib/notifications/recipientRouting';
import { eventsForStatusTransition } from '../../../../lib/notifications/ticketEvents';
import type { NotificationRecipientKind } from '../../../../lib/notifications/ticketEvents';

export const runtime = 'nodejs';

type NotificationDispatcher = typeof dispatchTicketNotificationEvent;

const notificationDispatcher: NotificationDispatcher = dispatchTicketNotificationEvent;

interface UpdateTicketStatusRequest {
  previousStatus: RepairTicket['status'];
  nextStatus: RepairTicket['status'];
  ticket: RepairTicket;
  actorEmail?: string;
  customerName?: string;
  customerEmail?: string;
  notifyRecipients?: NotificationRecipientKind[];
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { ticketId } = await params;
  let body: Partial<UpdateTicketStatusRequest>;

  try {
    body = (await request.json()) as Partial<UpdateTicketStatusRequest>;
  } catch {
    return Response.json({ error: 'Invalid ticket payload.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid ticket payload.' }, { status: 400 });
  }

  if (!isUpdateTicketStatusRequest(body)) {
    return Response.json(
      { error: 'previousStatus, nextStatus, and ticket are required.' },
      { status: 400 }
    );
  }

  const actorEmail = normalizeActorEmail(body.actorEmail);
  const persistedTicket = await getPersistedTicket(ticketId);

  if (!persistedTicket) {
    return Response.json({ error: `Ticket ${ticketId} not found.` }, { status: 404 });
  }

  const effectiveNotifyRecipients =
    body.notifyRecipients === undefined
      ? (['employee'] satisfies NotificationRecipientKind[])
      : body.notifyRecipients;

  // notifyRecipients: [] means status-only update — skip recipient validation and notification
  const shouldNotify = effectiveNotifyRecipients.length > 0;

  if (shouldNotify) {
    if (!hasValidRecipientOverrides(body)) {
      return Response.json(
        { error: 'customerName and customerEmail must be strings when provided.' },
        { status: 400 }
      );
    }

    const recipients = buildNotificationRecipients({
      ticket: { ...persistedTicket, status: body.nextStatus },
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

  let updatedTicket: RepairTicket;
  let statusChanged = false;
  let events = [] as ReturnType<typeof eventsForStatusTransition>;

  try {
    if (persistedTicket.status === body.nextStatus) {
      updatedTicket = persistedTicket;
    } else {
      const transition = await transitionTicketStatusWithActor(
        ticketId,
        body.nextStatus,
        body.previousStatus,
        undefined,
        actorEmail
      );
      statusChanged = transition.changed;
      updatedTicket = transition.ticket;
    }
  } catch (error) {
    if (error instanceof TicketValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof TicketStatusConflictError) {
      return Response.json(
        {
          error: `Stale status conflict: ticket is currently ${error.actualStatus}, expected ${error.expectedPreviousStatus}.`,
        },
        { status: 409 }
      );
    }

    if (error instanceof TicketNotFoundError) {
      return Response.json({ error: `Ticket ${ticketId} not found.` }, { status: 404 });
    }

    throw error;
  }

  // Persist a device repair event so Repair Log survives ticket deletion (best-effort)
  if (statusChanged && updatedTicket.deviceId) {
    const isTerminal = body.nextStatus === 'Completed' || body.nextStatus === 'Closed';
    try {
      await appendDeviceRepairEvent({
        deviceId: updatedTicket.deviceId,
        ticketId: updatedTicket.id,
        eventType: isTerminal ? 'ticket_completed' : 'ticket_status_changed',
        title: isTerminal ? 'Ticket Completed' : `Status Changed to ${body.nextStatus}`,
        description: `Status changed from ${body.previousStatus} to ${body.nextStatus}`,
        status: body.nextStatus,
        technician: actorEmail,
        createdBy: actorEmail,
        createdAt: new Date().toISOString(),
        source: 'ticket',
      });
    } catch {
      // best-effort — do not block status update
    }
  }

  if (shouldNotify) {
    const recipients = buildNotificationRecipients({
      ticket: { ...persistedTicket, status: body.nextStatus },
      notifyRecipients: effectiveNotifyRecipients,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
    });

    events = statusChanged
      ? eventsForStatusTransition({
          ticket: updatedTicket,
          previousStatus: body.previousStatus,
          nextStatus: body.nextStatus,
          actorEmail,
          recipients,
          notifyRecipients: effectiveNotifyRecipients,
        })
      : [];

    const dispatcher = notificationDispatcher;

    scheduleTicketNotificationDispatch(() => {
      for (const event of events) {
        dispatcher(event);
      }
    });
  }

  return Response.json({
    ticket: updatedTicket,
    notificationEventsQueued: events.length,
  });
}

function isUpdateTicketStatusRequest(
  body: Partial<UpdateTicketStatusRequest>
): body is UpdateTicketStatusRequest {
  return (
    isTicketStatus(body.previousStatus) &&
    isTicketStatus(body.nextStatus) &&
    isRepairTicket(body.ticket) &&
    isValidNotifyRecipients(body.notifyRecipients)
  );
}

function isTicketStatus(value: unknown): value is RepairTicket['status'] {
  return (
    value === 'Pending' ||
    value === 'In Progress' ||
    value === 'Waiting for Parts' ||
    value === 'Completed' ||
    value === 'Closed'
  );
}

function isRepairTicket(value: unknown): value is RepairTicket {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const ticket = value as Partial<RepairTicket>;

  return (
    isNonEmptyString(ticket.id) &&
    isNonEmptyString(ticket.deviceName) &&
    isNonEmptyString(ticket.employeeName) &&
    isValidEmail(ticket.employeeEmail) &&
    isNonEmptyString(ticket.department) &&
    isNonEmptyString(ticket.problemType) &&
    isNonEmptyString(ticket.description) &&
    isTicketStatus(ticket.status)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function hasValidRecipientOverrides(body: Partial<UpdateTicketStatusRequest>) {
  return isOptionalString(body.customerName) && isOptionalString(body.customerEmail);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function normalizeActorEmail(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'system@repairlink.local';
}

async function getPersistedTicket(ticketId: string) {
  try {
    return await findTicketById(ticketId);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      return null;
    }

    throw error;
  }
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
