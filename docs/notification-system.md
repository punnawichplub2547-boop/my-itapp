# RepairLink Notification System

## Goal

Send customer emails when:

1. A repair ticket is created.
2. A repair ticket transitions to `Closed`.

The implementation uses event-driven boundaries so ticket mutations do not need to know how email is rendered or sent.

## Technical Logic

1. Ticket mutation completes first.
2. The mutation creates a domain event:
   - `repair.ticket.created`
   - `repair.ticket.status_updated`
   - `repair.ticket.closed`
3. The route handler schedules event dispatch with Next.js `after()` so the HTTP response is not blocked by email work.
4. The dispatcher converts the event into an `EmailJob`.
5. The queue adapter processes the job asynchronously and calls an `EmailClient`.

Current adapter:

- `InMemoryEmailQueue` sends asynchronously with `setTimeout`.
- `ConsoleEmailClient` logs the email payload.
- This is suitable for local/demo behavior only.

Production adapter:

- Store domain events or email jobs in a durable outbox table in the same transaction as the ticket mutation.
- Have a worker poll the outbox or consume from a queue such as SQS, RabbitMQ, Cloud Tasks, BullMQ, or Kafka.
- Make the worker idempotent by storing `eventId` or `jobId` delivery state.
- Retry transient provider failures with backoff and route permanent failures to a dead-letter queue.

## Boilerplate Map

- `app/lib/notifications/ticketEvents.ts`: event names and event creation logic.
- `app/lib/notifications/recipientRouting.ts`: normalizes customer and employee recipients from API input.
- `app/lib/notifications/notificationJobs.ts`: converts ticket events into email jobs.
- `app/lib/notifications/templates.ts`: renders subject, HTML, and text email bodies.
- `app/lib/notifications/emailClient.ts`: email provider interface and console demo implementation.
- `app/lib/notifications/emailQueue.ts`: async queue adapter with retry tracking.
- `app/lib/notifications/eventDispatcher.ts`: event handler that enqueues customer email jobs.
- `app/api/tickets/route.ts`: example create-ticket endpoint that emits `repair.ticket.created`.
- `app/api/tickets/[ticketId]/status/route.ts`: example status endpoint that emits `repair.ticket.closed`.

## Template Best Practices

- Keep subject, preheader, HTML, and plain text together per template.
- Always provide plain text for deliverability and accessibility.
- Escape customer-controlled values before inserting them into HTML.
- Keep business rules out of templates; templates should render a prepared event or view model.
- Use stable template identifiers such as `ticket-created` and `ticket-closed` for logs and analytics.
- Version templates when content changes are material, especially for audit-heavy workflows.
- Include ticket ID, status, device, and support ownership in every customer-facing message.
- Avoid leaking internal repair notes unless they are explicitly approved for customers.
- Test templates with realistic long names, long device names, and common email clients.

## Recipient Routing

Route handlers accept `notifyRecipients` with `customer`, `employee`, or both.

Example create-ticket payload:

```json
{
  "deviceName": "Dell Latitude 7440",
  "employeeName": "Jane Doe",
  "employeeEmail": "jane.doe@example.com",
  "customerName": "Jane Customer",
  "customerEmail": "jane.customer@example.com",
  "notifyRecipients": ["customer", "employee"],
  "department": "Engineering",
  "problemType": "Hardware Failure",
  "description": "Screen flickers during startup."
}
```

For status updates, set `notifyRecipients` to `["employee"]` to send an employee-facing update even when the new status is not `Closed`.
