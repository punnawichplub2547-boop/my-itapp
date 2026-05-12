import { emailQueue } from './emailQueue';
import { createEmailJobsFromTicketEvent } from './notificationJobs';
import type { RepairTicketNotificationEvent } from './ticketEvents';

export function dispatchTicketNotificationEvent(
  event: RepairTicketNotificationEvent
): void {
  for (const job of createEmailJobsFromTicketEvent(event)) {
    emailQueue.enqueue(job);
  }
}
