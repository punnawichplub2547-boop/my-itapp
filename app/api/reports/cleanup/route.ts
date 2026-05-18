import { NextResponse } from 'next/server';
import { requireAuthenticatedRequest } from '../../../lib/auth/mockUser';
import { deleteCompletedTickets } from '../../../lib/tickets/ticketService';

export async function POST(request: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const deleted = await deleteCompletedTickets(60);
    return NextResponse.json({ deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
