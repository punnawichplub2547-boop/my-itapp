import { requireAuthenticatedRequest } from '../../../lib/auth/mockUser';
import { listCompletedTickets } from '../../../lib/tickets/ticketService';
import { buildRepairReportXlsx } from '../../../lib/reports/excelExport';

export const runtime = 'nodejs';

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = new URL(request.url);
    const sortOrder = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';

    const tickets = await listCompletedTickets(30);
    tickets.sort((a, b) => {
      const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

    const buffer = await buildRepairReportXlsx(tickets);
    const filename = `repair-report-${todayStamp()}.xlsx`;

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
