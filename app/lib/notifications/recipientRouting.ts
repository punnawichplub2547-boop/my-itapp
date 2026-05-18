import type { RepairTicket } from '../../types';
import type {
  NotificationRecipient,
  NotificationRecipientKind,
} from './ticketEvents';

interface BuildNotificationRecipientsInput {
  ticket: RepairTicket;
  notifyRecipients?: NotificationRecipientKind[];
  customerName?: string;
  customerEmail?: string;
}

export function buildNotificationRecipients({
  ticket,
  notifyRecipients = ['employee'],
  customerName,
  customerEmail,
}: BuildNotificationRecipientsInput): NotificationRecipient[] {
  const recipients = notifyRecipients
    .map((kind) =>
      kind === 'customer'
        ? buildCustomerRecipient(ticket, customerName, customerEmail)
        : buildEmployeeRecipient(ticket)
    )
    .filter((recipient): recipient is NotificationRecipient => Boolean(recipient));

  return dedupeRecipientsByEmail(recipients);
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  const parts = email.split('@');
  const hasSingleAt = parts.length === 2;
  const hasNonEmptyParts = hasSingleAt && parts[0].length > 0 && parts[1].length > 0;

  if (!hasSingleAt || !hasNonEmptyParts || email.includes(' ')) {
    return null;
  }

  return email;
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && normalizeEmail(value) !== null;
}

function buildCustomerRecipient(
  ticket: RepairTicket,
  customerName?: string,
  customerEmail?: string
): NotificationRecipient | null {
  const email = customerEmail
    ? normalizeEmail(customerEmail)
    : normalizeEmail(ticket.employeeEmail);

  if (!email) {
    return null;
  }

  return {
    kind: 'customer',
    name: customerName?.trim() || ticket.employeeName,
    email,
  };
}

function buildEmployeeRecipient(ticket: RepairTicket): NotificationRecipient | null {
  const email = normalizeEmail(ticket.employeeEmail);

  if (!email) {
    return null;
  }

  return {
    kind: 'employee',
    name: ticket.employeeName,
    email,
  };
}

function dedupeRecipientsByEmail(
  recipients: NotificationRecipient[]
): NotificationRecipient[] {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    if (seen.has(recipient.email)) {
      return false;
    }

    seen.add(recipient.email);
    return true;
  });
}
