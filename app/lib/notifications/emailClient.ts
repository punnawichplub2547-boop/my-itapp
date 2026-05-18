import type { EmailJob } from './notificationJobs';
import { loadEmailAttachments } from './notificationJobs';

export interface EmailClient {
  send(job: EmailJob): Promise<void>;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class ConsoleEmailClient implements EmailClient {
  async send(job: EmailJob): Promise<void> {
    const meta = (job as unknown as Record<string, unknown>)._attachmentMeta;
    const attachmentNames = Array.isArray(meta)
      ? (meta as Array<{ filename: string }>).map((a) => a.filename)
      : [];
    console.info('[email:send]', {
      to: job.to,
      subject: job.subject,
      template: job.template,
      ticketId: job.metadata.ticketId,
      attachments: attachmentNames,
    });
  }
}

export class SmtpEmailClient implements EmailClient {
  constructor(private readonly config: SmtpConfig) {}

  async send(job: EmailJob): Promise<void> {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.pass },
    });

    // Load attachment file contents from disk before sending
    const meta = (job as unknown as Record<string, unknown>)._attachmentMeta;
    const attachments = Array.isArray(meta)
      ? await loadEmailAttachments(meta as Parameters<typeof loadEmailAttachments>[0])
      : [];

    console.info('[email:smtp:send]', {
      to: job.to,
      ticketId: job.metadata.ticketId,
      attachmentCount: attachments.length,
    });

    await transporter.sendMail({
      from: this.config.from,
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html,
      attachments: attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });
  }
}

export function createEmailClient(): EmailClient {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (host && user && pass) {
    return new SmtpEmailClient({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user,
      pass,
      from: process.env.MAIL_FROM?.trim() || user,
    });
  }

  return new ConsoleEmailClient();
}
