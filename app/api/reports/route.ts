import { NextResponse } from 'next/server';
import { requireAuthenticatedRequest } from '../../lib/auth/mockUser';
import { listCompletedTickets } from '../../lib/tickets/ticketService';

export async function GET(request?: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const tickets = await listCompletedTickets(30);
    return NextResponse.json({ tickets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch reports.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
