import { renderRecipientEmail } from './templates';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type {
  NotificationRecipient,
  RepairTicketNotificationEvent,
  RepairTicketNotificationEventName,
} from './ticketEvents';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailJob {
  id: string;
  eventId: string;
  eventName: RepairTicketNotificationEventName;
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  attachments?: EmailAttachment[];
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

  // Attachments will be loaded asynchronously before sending — placeholder here
  return {
    id: crypto.randomUUID(),
    eventId: event.id,
    eventName: event.name,
    to: recipient.email.trim(),
    subject: email.subject,
    html: email.html,
    text: email.text,
    template: email.template,
    attachments: undefined, // populated by loadAttachments()
    createdAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts: 3,
    metadata: {
      ticketId: event.ticket.id,
      actorEmail: event.actorEmail,
      recipientKind: recipient.kind,
    },
    // Store raw attachment metadata so the queue can load files before sending
    _attachmentMeta: (event.ticket.attachments ?? []).map((att) => ({
      filename: att.fileName,
      absolutePath: resolve(process.cwd(), 'public', att.url.replace(/^\//, '')),
      contentType: att.mimeType,
    })),
  } as EmailJob & { _attachmentMeta: AttachmentMeta[] };
}

interface AttachmentMeta {
  filename: string;
  absolutePath: string;
  contentType: string;
}

/**
 * Reads attachment files from disk and returns EmailAttachment[] with Buffer content.
 * Called just before sending via SMTP so files are read once per send attempt.
 */
export async function loadEmailAttachments(
  meta: AttachmentMeta[]
): Promise<EmailAttachment[]> {
  const results: EmailAttachment[] = [];

  for (const { filename, absolutePath, contentType } of meta) {
    try {
      const content = await readFile(absolutePath);
      results.push({ filename, content, contentType });
      console.info('[email:attachment:loaded]', { filename, absolutePath, bytes: content.length });
    } catch (err) {
      console.error('[email:attachment:error] Could not read file — skipping', {
        filename,
        absolutePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
