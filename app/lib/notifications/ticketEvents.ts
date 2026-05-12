import type { RepairTicket } from '../../types';

export type RepairTicketNotificationEventName =
  | 'repair.ticket.created'
  | 'repair.ticket.status_updated'
  | 'repair.ticket.closed';

export type NotificationRecipientKind = 'customer' | 'employee';

export interface NotificationRecipient {
  kind: NotificationRecipientKind;
  name: string;
  email: string;
}

export interface RepairTicketNotificationEvent {
  id: string;
  name: RepairTicketNotificationEventName;
  ticket: RepairTicket;
  recipients: NotificationRecipient[];
  actorEmail: string;
  occurredAt: string;
}

interface StatusTransitionInput {
  ticket: RepairTicket;
  previousStatus: RepairTicket['status'];
  nextStatus: RepairTicket['status'];
  actorEmail: string;
  recipients?: NotificationRecipient[];
  notifyRecipients?: NotificationRecipientKind[];
}

interface TicketEventOptions {
  recipients?: NotificationRecipient[];
  notifyRecipients?: NotificationRecipientKind[];
}

export function createTicketCreatedEvent(
  ticket: RepairTicket,
  actorEmail: string,
  options: TicketEventOptions = {}
): RepairTicketNotificationEvent {
  return createTicketEvent('repair.ticket.created', ticket, actorEmail, options);
}

export function createTicketClosedEvent(
  ticket: RepairTicket,
  actorEmail: string,
  options: TicketEventOptions = {}
): RepairTicketNotificationEvent {
  return createTicketEvent('repair.ticket.closed', ticket, actorEmail, options);
}

export function createTicketStatusUpdatedEvent(
  ticket: RepairTicket,
  actorEmail: string,
  options: TicketEventOptions = {}
): RepairTicketNotificationEvent {
  return createTicketEvent('repair.ticket.status_updated', ticket, actorEmail, options);
}

export function eventsForStatusTransition({
  ticket,
  previousStatus,
  nextStatus,
  actorEmail,
  recipients,
  notifyRecipients,
}: StatusTransitionInput): RepairTicketNotificationEvent[] {
  if (previousStatus !== 'Closed' && nextStatus === 'Closed') {
    return [
      createTicketClosedEvent(
        { ...ticket, status: nextStatus },
        actorEmail,
        { recipients, notifyRecipients }
      ),
    ];
  }

  if (previousStatus !== nextStatus && notifyRecipients?.length) {
    return [
      createTicketStatusUpdatedEvent(
        { ...ticket, status: nextStatus },
        actorEmail,
        { recipients, notifyRecipients }
      ),
    ];
  }

  return [];
}

function createTicketEvent(
  name: RepairTicketNotificationEventName,
  ticket: RepairTicket,
  actorEmail: string,
  options: TicketEventOptions
): RepairTicketNotificationEvent {
  return {
    id: crypto.randomUUID(),
    name,
    ticket,
    recipients: resolveRecipients(ticket, options),
    actorEmail,
    occurredAt: new Date().toISOString(),
  };
}

function resolveRecipients(
  ticket: RepairTicket,
  options: TicketEventOptions
): NotificationRecipient[] {
  if (options.recipients?.length) {
    return dedupeRecipients(options.recipients);
  }

  const kinds = options.notifyRecipients?.length
    ? options.notifyRecipients
    : (['employee'] satisfies NotificationRecipientKind[]);

  return dedupeRecipients(
    kinds.map((kind) => ({
      kind,
      name: ticket.employeeName,
      email: ticket.employeeEmail,
    }))
  );
}

function dedupeRecipients(
  recipients: NotificationRecipient[]
): NotificationRecipient[] {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const key = `${recipient.kind}:${recipient.email.trim().toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
