import type { RepairTicket } from '../../types';

export type ReportSortOrder = 'newest' | 'oldest';

const REPORT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getDefaultReportMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function normalizeReportMonth(value: string | null | undefined) {
  if (!value || !REPORT_MONTH_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export function filterTicketsByCreatedMonth(tickets: RepairTicket[], month: string) {
  return sortTicketsByCreatedAt(
    tickets.filter((ticket) => getCreatedMonth(ticket.createdAt) === month),
    'newest'
  );
}

export function buildMonthlyReportSelection(
  tickets: RepairTicket[],
  month: string,
  includedTicketIds: string[]
) {
  const includedIds = new Set(
    includedTicketIds
      .map((ticketId) => ticketId.trim())
      .filter(Boolean)
  );

  return sortTicketsByCreatedAt(
    tickets.filter(
      (ticket) =>
        getCreatedMonth(ticket.createdAt) === month || includedIds.has(ticket.id)
    ),
    'newest'
  );
}

export function sortTicketsByCreatedAt(
  tickets: RepairTicket[],
  sortOrder: ReportSortOrder
) {
  return [...tickets].sort((left, right) => {
    const leftTime = getTicketTime(left.createdAt);
    const rightTime = getTicketTime(right.createdAt);
    return sortOrder === 'newest' ? rightTime - leftTime : leftTime - rightTime;
  });
}

export function getCreatedMonth(createdAt: string | undefined) {
  const date = createdAt ? new Date(createdAt) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 7);
}

function getTicketTime(createdAt: string | undefined) {
  const date = createdAt ? new Date(createdAt) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}
