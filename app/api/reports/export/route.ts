import { requireAuthenticatedRequest } from '../../../lib/auth/mockUser';
import { listTickets } from '../../../lib/tickets/ticketService';
import { buildRepairReportXlsx } from '../../../lib/reports/excelExport';
import {
  buildMonthlyReportSelection,
  getDefaultReportMonth,
  normalizeReportMonth,
  sortTicketsByCreatedAt,
} from '../../../lib/reports/monthlyTickets';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = new URL(request.url);
    const sortOrder = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
    const requestedMonth = url.searchParams.get('month');
    const month = normalizeReportMonth(requestedMonth) ?? getDefaultReportMonth();

    if (requestedMonth && !normalizeReportMonth(requestedMonth)) {
      return Response.json({ error: 'month must use YYYY-MM format.' }, { status: 400 });
    }

    const includedTicketIds = url.searchParams.getAll('includeTicketId');
    const tickets = sortTicketsByCreatedAt(
      buildMonthlyReportSelection(await listTickets(), month, includedTicketIds),
      sortOrder
    );

    const buffer = await buildRepairReportXlsx(tickets, month);
    const filename = `repair-report-${month}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build report.';
    return Response.json({ error: message }, { status: 500 });
  }
}
