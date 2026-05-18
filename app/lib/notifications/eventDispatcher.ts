import { emailQueue } from './emailQueue';
import { createEmailClient } from './emailClient';
import { createEmailJobsFromTicketEvent } from './notificationJobs';
import type { RepairTicketNotificationEvent } from './ticketEvents';

/** Fire-and-forget: enqueues jobs via setTimeout, returns immediately. Used by status-change triggers. */
export function dispatchTicketNotificationEvent(
  event: RepairTicketNotificationEvent
): void {
  for (const job of createEmailJobsFromTicketEvent(event)) {
    emailQueue.enqueue(job);
  }
}

/** Awaitable: sends all email jobs and waits for completion. Use inside after() so Next.js keeps the runtime alive until all emails are sent with their attachments. */
export async function dispatchTicketNotificationEventAsync(
  event: RepairTicketNotificationEvent
): Promise<void> {
  const client = createEmailClient();
  const jobs = createEmailJobsFromTicketEvent(event);
  // Spread copies _attachmentMeta at runtime (it exists on the object even though it's not in EmailJob type)
  await Promise.all(jobs.map((job) => client.send({ ...job, attempts: job.attempts + 1 })));
}
