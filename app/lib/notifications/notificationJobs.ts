import { renderRecipientEmail } from './templates';
import type {
  NotificationRecipient,
  RepairTicketNotificationEvent,
  RepairTicketNotificationEventName,
} from './ticketEvents';

export interface EmailJob {
  id: string;
  eventId: string;
  eventName: RepairTicketNotificationEventName;
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  createdAt: string;
  attempts: number;
  maxAttempts: number;
  metadata: {
    ticketId: string;
    actorEmail: string;
    recipientKind: NotificationRecipient['kind'];
  };
}

export function createEmailJobFromTicketEvent(
  event: RepairTicketNotificationEvent
): EmailJob {
  return createEmailJobsFromTicketEvent(event)[0];
}

export function createEmailJobsFromTicketEvent(
  event: RepairTicketNotificationEvent
): EmailJob[] {
  return event.recipients.map((recipient) =>
    createEmailJobForRecipient(event, recipient)
  );
}

function createEmailJobForRecipient(
  event: RepairTicketNotificationEvent,
  recipient: NotificationRecipient
): EmailJob {
  const email = renderRecipientEmail(event, recipient);

  return {
    id: crypto.randomUUID(),
    eventId: event.id,
    eventName: event.name,
    to: recipient.email.trim(),
    subject: email.subject,
    html: email.html,
    text: email.text,
    template: email.template,
    createdAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts: 3,
    metadata: {
      ticketId: event.ticket.id,
      actorEmail: event.actorEmail,
      recipientKind: recipient.kind,
    },
  };
}
