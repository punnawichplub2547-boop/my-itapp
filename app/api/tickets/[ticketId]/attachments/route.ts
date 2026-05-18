import {
  AttachmentValidationError,
  deleteTicketAttachmentFile,
  saveTicketImage,
} from '../../../../lib/tickets/attachmentStorage';
import {
  TicketNotFoundError,
  addTicketAttachment,
} from '../../../../lib/tickets/ticketService';
import { requireAuthenticatedRequest } from '../../../../lib/auth/mockUser';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { ticketId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid upload payload.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided.' }, { status: 400 });
  }

  let savedAttachment;
  try {
    savedAttachment = await saveTicketImage(ticketId, file);
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    const ticket = await addTicketAttachment(ticketId, savedAttachment);
    return Response.json({ ticket, attachment: savedAttachment }, { status: 201 });
  } catch (error) {
    await deleteTicketAttachmentFile(savedAttachment.url).catch(() => {});
    if (error instanceof TicketNotFoundError) {
      return Response.json({ error: `Ticket ${ticketId} not found.` }, { status: 404 });
    }
    throw error;
  }
}
