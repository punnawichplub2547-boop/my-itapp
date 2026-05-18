import {
  addTicketNote,
  deleteTicketById,
  findTicketById,
  TicketNotFoundError,
  TicketValidationError,
} from '../../../lib/tickets/ticketService';
import { requireAuthenticatedRequest } from '../../../lib/auth/mockUser';
import { appendDeviceRepairEvent } from '../../../lib/devices/deviceRepairEventService';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { ticketId } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.noteContent !== 'string' || !body.noteContent.trim()) {
    return Response.json({ error: 'noteContent is required.' }, { status: 400 });
  }

  const authorEmail =
    typeof body.authorEmail === 'string' && body.authorEmail.trim()
      ? body.authorEmail.trim()
      : 'admin@repairlink.local';

  try {
    const ticket = await addTicketNote(ticketId, body.noteContent, authorEmail);
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { ticketId } = await params;

  // Fetch the ticket first to capture deviceId and metadata for the persistent event.
  let ticketToDelete;
  try {
    ticketToDelete = await findTicketById(ticketId);
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      return Response.json({ error: `Ticket ${ticketId} not found.` }, { status: 404 });
    }
    throw error;
  }

  // Write persistent deletion event before hard-deleting the ticket (best-effort).
  if (ticketToDelete.deviceId) {
    try {
      await appendDeviceRepairEvent({
        deviceId: ticketToDelete.deviceId,
        ticketId: ticketToDelete.id,
        eventType: 'ticket_deleted',
        title: 'Ticket Deleted',
        description: `Ticket deleted. Last status: ${ticketToDelete.status}. Reported by ${ticketToDelete.employeeName}: ${ticketToDelete.description}`,
        problemType: ticketToDelete.problemType,
        status: ticketToDelete.status,
        reportedBy: ticketToDelete.employeeName,
        createdAt: new Date().toISOString(),
        source: 'ticket',
      });
    } catch {
      // best-effort — do not block deletion
    }
  }

  try {
    await deleteTicketById(ticketId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      return Response.json({ error: `Ticket ${ticketId} not found.` }, { status: 404 });
    }

    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
