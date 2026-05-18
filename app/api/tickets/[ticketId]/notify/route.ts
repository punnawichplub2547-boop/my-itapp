import { requireAuthenticatedRequest } from '../../../../lib/auth/mockUser';
import { dispatchTicketNotificationEventAsync } from '../../../../lib/notifications/eventDispatcher';
import { createTicketStatusUpdatedEvent } from '../../../../lib/notifications/ticketEvents';
import { buildNotificationRecipients, isValidEmail } from '../../../../lib/notifications/recipientRouting';
import { findTicketById, TicketNotFoundError } from '../../../../lib/tickets/ticketService';
import { after } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  const { ticketId } = await params;

  let ticket;
  try {
    ticket = await findTicketById(ticketId);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      return Response.json({ error: `Ticket ${ticketId} not found.` }, { status: 404 });
    }
    throw error;
  }

  if (!ticket.employeeEmail || !isValidEmail(ticket.employeeEmail)) {
    return Response.json(
      { error: 'Ticket has no valid employee email address.' },
      { status: 400 }
    );
  }

  const recipients = buildNotificationRecipients({
    ticket,
    notifyRecipients: ['employee'],
  });

  if (recipients.length === 0) {
    return Response.json(
      { error: 'No valid recipients found for this ticket.' },
      { status: 400 }
    );
  }

  const event = createTicketStatusUpdatedEvent(ticket, 'system@repairlink.local', {
    recipients,
  });

  try {
    after(async () => {
      await dispatchTicketNotificationEventAsync(event);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside a request scope')) {
      void dispatchTicketNotificationEventAsync(event);
    } else {
      throw error;
    }
  }

  return Response.json({ success: true, notificationEventQueued: true });
}
