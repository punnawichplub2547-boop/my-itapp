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
      heading: 'Repair Request Received',
      previewText: summary,
      ticketId: ticket.id,
      employeeName: recipientName,
      accentColor: '#1a73e8',
      accentLight: '#e8f0fe',
      badgeLabel: 'New Ticket',
      badgeColor: '#1a73e8',
      body: `
        <p style="margin:0 0 16px;font-size:14px;color:#3d4d60;line-height:1.6;">${escapeHtml(summary)}</p>
        ${renderTicketDetails(event)}
        <p style="margin:16px 0 24px;font-size:13px;color:#526070;line-height:1.6;">The IT Support Team will review your request and keep you updated as the repair progresses.</p>
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
      heading: 'Repair Ticket Closed',
      previewText: summary,
      ticketId: ticket.id,
      employeeName: recipientName,
      accentColor: '#34a853',
      accentLight: '#e6f4ea',
      badgeLabel: 'Closed',
      badgeColor: '#34a853',
      body: `
        <p style="margin:0 0 16px;font-size:14px;color:#3d4d60;line-height:1.6;">${escapeHtml(summary)}</p>
        ${renderTicketDetails(event)}
        <p style="margin:16px 0 24px;font-size:13px;color:#526070;line-height:1.6;">If the issue returns, please open a new repair request and reference this ticket ID.</p>
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
      heading: 'Repair Ticket Updated',
      previewText: summary,
      ticketId: ticket.id,
      employeeName: recipientName,
      accentColor: statusColor(ticket.status),
      accentLight: '#fef9e7',
      badgeLabel: 'Status Updated',
      badgeColor: statusColor(ticket.status),
      body: `
        <p style="margin:0 0 16px;font-size:14px;color:#3d4d60;line-height:1.6;">${escapeHtml(summary)}</p>
        ${renderTicketDetails(event)}
        <p style="margin:16px 0 24px;font-size:13px;color:#526070;line-height:1.6;">The IT Support Team will send another update if the repair status changes.</p>
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
  accentColor = '#1a73e8',
  accentLight = '#e8f0fe',
  badgeLabel,
  badgeColor = '#1a73e8',
}: {
  heading: string;
  previewText: string;
  ticketId: string;
  employeeName: string;
  body: string;
  accentColor?: string;
  accentLight?: string;
  badgeLabel?: string;
  badgeColor?: string;
}) {
  const badge = badgeLabel
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;background-color:${badgeColor};">${escapeHtml(badgeLabel)}</span>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)} - ${escapeHtml(ticketId)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f0f4f8;color:#1d2433;font-family:'Segoe UI',Arial,sans-serif;">
    <!-- Preview text (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f4f8;">${escapeHtml(previewText)}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;min-height:100vh;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0">

            <!-- ── Header bar ── -->
            <tr>
              <td style="background:${accentColor};border-radius:10px 10px 0 0;padding:20px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <p style="margin:0;color:rgba(255,255,255,.75);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">IT System Portal</p>
                      <p style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;line-height:1.3;">${escapeHtml(heading)}</p>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <!-- gear icon SVG -->
                      <div style="width:42px;height:42px;background:rgba(255,255,255,.18);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:22px;line-height:42px;text-align:center;">&#9881;</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ── Body card ── -->
            <tr>
              <td style="background:#ffffff;padding:28px 28px 0;border-left:1px solid #dde3ee;border-right:1px solid #dde3ee;">

                <!-- Badge + ticket ref -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                  <tr>
                    <td>${badge}</td>
                    <td align="right" style="color:#8592a6;font-size:12px;">Ticket&nbsp;<strong style="color:#3d4d60;">${escapeHtml(ticketId)}</strong></td>
                  </tr>
                </table>

                <!-- Greeting -->
                <p style="margin:0 0 12px;font-size:15px;color:#3d4d60;">Hello <strong>${escapeHtml(employeeName)}</strong>,</p>

                ${body}
              </td>
            </tr>

            <!-- ── Footer ── -->
            <tr>
              <td style="background:#f7f9fc;border:1px solid #dde3ee;border-top:none;border-radius:0 0 10px 10px;padding:0;">

                <!-- Company info block -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #dde3ee;">
                  <tr>
                    <td style="padding:18px 28px;">
                      <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#3d4d60;">IT Support Team</p>
                      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#526070;">Complete Auto Rubber Manufacturing Co., Ltd.</p>
                      <p style="margin:0;font-size:11px;color:#8592a6;line-height:1.7;">
                        700/498 M.7, T.Donhualoh, A.Muang, Chonburi 20000 Thailand<br />
                        Tel: 038-454-106-108 Ext.109&nbsp;&nbsp;|&nbsp;&nbsp;
                        Email: <a href="mailto:punnawich@car-1996.com" style="color:#1a73e8;text-decoration:none;">punnawich@car-1996.com</a>&nbsp;&nbsp;|&nbsp;&nbsp;
                        Website: <a href="https://www.c-autorubber.com" style="color:#1a73e8;text-decoration:none;">www.c-autorubber.com</a>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Thank you -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #dde3ee;">
                  <tr>
                    <td style="padding:12px 28px;">
                      <p style="margin:0;font-size:12px;color:#526070;">Thank you and Best Regards,</p>
                    </td>
                  </tr>
                </table>

                <!-- Auto-notice -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:12px 28px;">
                      <p style="margin:0;font-size:11px;color:#b0bac8;">This is an automated notification from the IT System Portal. Please do not reply to this email.</p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function priorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'critical': return '#d93025';
    case 'high':     return '#f29900';
    case 'medium':   return '#1a73e8';
    default:         return '#34a853';
  }
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'closed':
    case 'completed':
    case 'resolved':    return '#34a853';
    case 'in progress':
    case 'inprogress':  return '#1a73e8';
    case 'pending':
    case 'open':              return '#f29900';
    case 'waiting for parts': return '#8b5cf6';
    case 'cancelled':
    case 'canceled':          return '#d93025';
    default:            return '#8592a6';
  }
}

function renderTicketDetails(event: RepairTicketNotificationEvent) {
  const { ticket } = event;
  const createdDate = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '-';

  const pColor  = priorityColor(ticket.priority);
  const sColor  = statusColor(ticket.status);

  const priorityBadge = `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#ffffff;background-color:${pColor};">${escapeHtml(ticket.priority)}</span>`;
  const statusBadge   = `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#ffffff;background-color:${sColor};">${escapeHtml(ticket.status)}</span>`;

  const mainRows: Array<[string, string]> = [
    ['Device',       ticket.deviceName],
    ['Employee',     ticket.employeeName],
    ['Email',        ticket.employeeEmail],
    ['Department',   ticket.department],
    ['Problem Type', ticket.problemType],
    ['Created',      createdDate],
  ];

  const mainHtml = mainRows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:9px 14px;color:#8592a6;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;width:38%;border-bottom:1px solid #edf1f7;">${escapeHtml(label)}</td>
          <td style="padding:9px 14px;font-size:13px;color:#3d4d60;border-bottom:1px solid #edf1f7;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  return `
    <!-- Ticket detail card -->
    <div style="margin:20px 0;border:1px solid #dde3ee;border-radius:8px;overflow:hidden;">

      <!-- Description block -->
      <div style="background:#f7f9fc;padding:12px 14px;border-bottom:1px solid #dde3ee;">
        <p style="margin:0 0 4px;color:#8592a6;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Description</p>
        <p style="margin:0;font-size:13px;color:#3d4d60;line-height:1.6;">${escapeHtml(ticket.description)}</p>
      </div>

      <!-- Info table -->
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#fff;">
        ${mainHtml}
        <tr>
          <td style="padding:9px 14px;color:#8592a6;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;width:38%;border-bottom:1px solid #edf1f7;">Priority</td>
          <td style="padding:9px 14px;border-bottom:1px solid #edf1f7;">${priorityBadge}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;color:#8592a6;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;width:38%;">Status</td>
          <td style="padding:9px 14px;">${statusBadge}</td>
        </tr>
      </table>
    </div>
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
