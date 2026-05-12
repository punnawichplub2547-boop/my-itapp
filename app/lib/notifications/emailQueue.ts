import { createEmailClient, type EmailClient } from './emailClient';
import type { EmailJob } from './notificationJobs';

export type EmailJobStatus = 'queued' | 'sent' | 'failed';

export interface EmailJobResult {
  job: EmailJob;
  status: EmailJobStatus;
  error?: string;
  updatedAt: string;
}

export class InMemoryEmailQueue {
  private readonly results = new Map<string, EmailJobResult>();

  constructor(private readonly emailClient: EmailClient = createEmailClient()) {}

  enqueue(job: EmailJob): void {
    this.results.set(job.id, {
      job,
      status: 'queued',
      updatedAt: new Date().toISOString(),
    });

    setTimeout(() => {
      void this.process(job);
    }, 0);
  }

  getResult(jobId: string): EmailJobResult | undefined {
    return this.results.get(jobId);
  }

  private async process(job: EmailJob): Promise<void> {
    try {
      const attemptedJob = { ...job, attempts: job.attempts + 1 };
      await this.emailClient.send(attemptedJob);
      this.results.set(job.id, {
        job: attemptedJob,
        status: 'sent',
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const attemptedJob = { ...job, attempts: job.attempts + 1 };
      const message = error instanceof Error ? error.message : 'Unknown email error';

      if (attemptedJob.attempts < attemptedJob.maxAttempts) {
        this.enqueue(attemptedJob);
        return;
      }

      this.results.set(job.id, {
        job: attemptedJob,
        status: 'failed',
        error: message,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

declare global {
  var repairLinkEmailQueue: InMemoryEmailQueue | undefined;
}

export const emailQueue =
  globalThis.repairLinkEmailQueue ?? new InMemoryEmailQueue();

globalThis.repairLinkEmailQueue = emailQueue;
