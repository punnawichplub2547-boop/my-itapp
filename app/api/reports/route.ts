import { NextResponse } from 'next/server';
import { requireAuthenticatedRequest } from '../../lib/auth/mockUser';
import { listTickets } from '../../lib/tickets/ticketService';
import {
  filterTicketsByCreatedMonth,
  getDefaultReportMonth,
  normalizeReportMonth,
} from '../../lib/reports/monthlyTickets';

export async function GET(request?: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = request ? new URL(request.url) : null;
    const month = normalizeReportMonth(url?.searchParams.get('month')) ?? getDefaultReportMonth();

    if (url?.searchParams.has('month') && !normalizeReportMonth(url.searchParams.get('month'))) {
      return NextResponse.json({ error: 'month must use YYYY-MM format.' }, { status: 400 });
    }

    const tickets = filterTicketsByCreatedMonth(await listTickets(), month);
    return NextResponse.json({ tickets, month });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch reports.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
