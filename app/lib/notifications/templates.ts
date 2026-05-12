import type {
  NotificationRecipient,
  RepairTicketNotificationEvent,
} from './ticketEvents';

export type CustomerEmailTemplate =
  | 'ticket-created'
  | 'ticket-status-updated'
  | 'ticket-closed';

export interface RenderedCustomerEmail {
  subject: string;
  html: string;
  text: string;
  template: CustomerEmailTemplate;
}

export function renderCustomerEmail(
  event: RepairTicketNotificationEvent
): RenderedCustomerEmail {
  if (event.name === 'repair.ticket.closed') {
    return renderClosedEmail(event, event.recipients[0]);
  }

  if (event.name === 'repair.ticket.status_updated') {
    return renderStatusUpdatedEmail(event, event.recipients[0]);
  }

  return renderCreatedEmail(event, event.recipients[0]);
}

export function renderRecipientEmail(
  event: RepairTicketNotificationEvent,
  recipient: NotificationRecipient
): RenderedCustomerEmail {
  if (event.name === 'repair.ticket.closed') {
    return renderClosedEmail(event, recipient);
  }

  if (event.name === 'repair.ticket.status_updated') {
    return renderStatusUpdatedEmail(event, recipient);
  }

  return renderCreatedEmail(event, recipient);
}

function renderCreatedEmail(
  event: RepairTicketNotificationEvent,
  recipient?: NotificationRecipient
): RenderedCustomerEmail {
  const { ticket } = event;
  const subject = `Repair request received: ${ticket.id}`;
  const summary = `Your repair request for ${ticket.deviceName} has been created.`;
  const recipientName = recipient?.name ?? ticket.employeeName;

  return {
    subject,
    template: 'ticket-created',
    text: [
      `Hello ${recipientName},`,
      '',
      summary,
      `Ticket ID: ${ticket.id}`,
      `Current status: ${ticket.status}`,
      `Priority: ${ticket.priority}`,
      '',
      'The IT Support Team will review the request and update you as the repair progresses.',
      '',
      'IT Support Team',
    ].join('\n'),
    html: renderShell({
      heading: 'Repair request received',
      previewText: summary,
      ticketId: ticket.id,
      employeeName: recipientName,
      body: `
        <p>${escapeHtml(summary)}</p>
        ${renderTicketDetails(event)}
        <p>The IT Support Team will review the request and update you as the repair progresses.</p>
      `,
    }),
  };
}

function renderClosedEmail(
  event: RepairTicketNotificationEvent,
  recipient?: NotificationRecipient
): RenderedCustomerEmail {
  const { ticket } = event;
  const subject = `Repair ticket closed: ${ticket.id}`;
  const summary = `Your repair ticket for ${ticket.deviceName} has been closed.`;
  const recipientName = recipient?.name ?? ticket.employeeName;

  return {
    subject,
    template: 'ticket-closed',
    text: [
      `Hello ${recipientName},`,
      '',
      summary,
      `Ticket ID: ${ticket.id}`,
      `Final status: ${ticket.status}`,
      '',
      'If the issue returns, please open a new repair request and reference this ticket ID.',
      '',
      'IT Support Team',
    ].join('\n'),
    html: renderShell({
      heading: 'Repair ticket closed',
      previewText: summary,
      ticketId: ticket.id,
      employeeName: recipientName,
      body: `
        <p>${escapeHtml(summary)}</p>
        ${renderTicketDetails(event)}
        <p>If the issue returns, please open a new repair request and reference this ticket ID.</p>
      `,
    }),
  };
}

function renderStatusUpdatedEmail(
  event: RepairTicketNotificationEvent,
  recipient?: NotificationRecipient
): RenderedCustomerEmail {
  const { ticket } = event;
  const subject = `Repair ticket updated: ${ticket.id}`;
  const summary = `The repair ticket for ${ticket.deviceName} is now ${ticket.status}.`;
  const recipientName = recipient?.name ?? ticket.employeeName;

  return {
    subject,
    template: 'ticket-status-updated',
    text: [
      `Hello ${recipientName},`,
      '',
      summary,
      `Ticket ID: ${ticket.id}`,
      `Current status: ${ticket.status}`,
      '',
      'The IT Support Team will send another update if the repair status changes.',
      '',
      'IT Support Team',
    ].join('\n'),
    html: renderShell({
      heading: 'Repair ticket updated',
      previewText: summary,
      ticketId: ticket.id,
      employeeName: recipientName,
      body: `
        <p>${escapeHtml(summary)}</p>
        ${renderTicketDetails(event)}
        <p>The IT Support Team will send another update if the repair status changes.</p>
      `,
    }),
  };
}

function renderShell({
  heading,
  previewText,
  ticketId,
  employeeName,
  body,
}: {
  heading: string;
  previewText: string;
  ticketId: string;
  employeeName: string;
  body: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)} - ${escapeHtml(ticketId)}</title>
  </head>
  <body style="margin:0;background:#f6f8fb;color:#1d2433;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(previewText)}</div>
    <main style="max-width:640px;margin:0 auto;padding:32px 16px;">
      <section style="background:#ffffff;border:1px solid #d8dee9;border-radius:8px;padding:28px;">
        <p style="margin:0 0 16px;color:#526070;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">RepairLink Management Portal</p>
        <h1 style="margin:0 0 24px;font-size:24px;line-height:1.25;color:#0f2e4f;">${escapeHtml(heading)}</h1>
        <p>Hello ${escapeHtml(employeeName)},</p>
        ${body}
        <hr style="border:none;border-top:1px solid #e4e9f2;margin:24px 0;" />
        <p style="margin:0;color:#526070;font-size:13px;">IT Support Team</p>
      </section>
    </main>
  </body>
</html>`;
}

function renderTicketDetails(event: RepairTicketNotificationEvent) {
  const { ticket } = event;

  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fbfd;border:1px solid #e4e9f2;border-radius:8px;">
      <tr>
        <td style="padding:12px 16px;color:#526070;font-size:12px;font-weight:700;text-transform:uppercase;">Ticket ID</td>
        <td style="padding:12px 16px;text-align:right;font-weight:700;">${escapeHtml(ticket.id)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#526070;font-size:12px;font-weight:700;text-transform:uppercase;">Device</td>
        <td style="padding:12px 16px;text-align:right;">${escapeHtml(ticket.deviceName)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#526070;font-size:12px;font-weight:700;text-transform:uppercase;">Status</td>
        <td style="padding:12px 16px;text-align:right;font-weight:700;">${escapeHtml(ticket.status)}</td>
      </tr>
    </table>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
