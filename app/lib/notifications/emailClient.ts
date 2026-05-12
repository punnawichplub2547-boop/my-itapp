import type { EmailJob } from './notificationJobs';

export interface EmailClient {
  send(job: EmailJob): Promise<void>;
}

export class ConsoleEmailClient implements EmailClient {
  async send(job: EmailJob): Promise<void> {
    console.info('[email:send]', {
      to: job.to,
      subject: job.subject,
      template: job.template,
      ticketId: job.metadata.ticketId,
    });
  }
}

export function createEmailClient(): EmailClient {
  return new ConsoleEmailClient();
}
