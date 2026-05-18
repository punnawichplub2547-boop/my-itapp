import { deleteTicketAttachmentFile } from '../../../../../lib/tickets/attachmentStorage';
import {
  TicketNotFoundError,
  TicketValidationError,
  removeTicketAttachment,
} from '../../../../../lib/tickets/ticketService';
import { requireAuthenticatedRequest } from '../../../../../lib/auth/mockUser';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ticketId: string; attachmentId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { ticketId, attachmentId } = await params;

  try {
    const { ticket, removed } = await removeTicketAttachment(ticketId, attachmentId);
    if (removed) {
      await deleteTicketAttachmentFile(removed.url).catch(() => {});
    }
    return Response.json({ ticket });
  } catch (error) {
    if (error instanceof TicketValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof TicketNotFoundError) {
      return Response.json({ error: `Ticket ${ticketId} not found.` }, { status: 404 });
    }
    throw error;
  }
}
