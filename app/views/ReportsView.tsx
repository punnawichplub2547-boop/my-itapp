"use client";

import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Filter,
  LogOut,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getCreatedMonth,
  getDefaultReportMonth,
  sortTicketsByCreatedAt,
} from '../lib/reports/monthlyTickets';
import type { RepairTicket } from '../types';

type ReportSortOrder = 'newest' | 'oldest';

function formatDate(iso: string | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB');
}

async function exportExcel(
  reportMonth: string,
  sortOrder: ReportSortOrder,
  includedTicketIds: string[]
): Promise<void> {
  const params = new URLSearchParams({
    month: reportMonth,
    sort: sortOrder,
  });
  includedTicketIds.forEach((ticketId) => params.append('includeTicketId', ticketId));

  const response = await fetch(`/api/reports/export?${params.toString()}`);
  if (!response.ok) {
    let message = 'Failed to export report.';
    try {
      const data = await response.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Non-JSON response; keep the default message.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `repair-report-${reportMonth}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsView() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [sortOrder, setSortOrder] = useState<ReportSortOrder>('newest');
  const [reportMonth, setReportMonth] = useState(() => getDefaultReportMonth());
  const [isExportComposerOpen, setIsExportComposerOpen] = useState(false);
  const [exportTickets, setExportTickets] = useState<RepairTicket[]>([]);
  const [selectedExportTicketIds, setSelectedExportTicketIds] = useState<string[]>([]);
  const [isLoadingExportTickets, setIsLoadingExportTickets] = useState(false);
  const [exportTicketsError, setExportTicketsError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(includedTicketIds: string[]) {
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);

    try {
      await exportExcel(reportMonth, sortOrder, includedTicketIds);
      setIsExportComposerOpen(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export report.');
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setFetchError(null);

      try {
        const response = await fetch(`/api/reports?month=${encodeURIComponent(reportMonth)}`);
        const data = await response.json() as { tickets?: RepairTicket[]; error?: string };

        if (cancelled) return;

        if (!response.ok) {
          setFetchError(data.error ?? 'Failed to load reports.');
          return;
        }

        setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      } catch {
        if (!cancelled) setFetchError('Network error. Could not load reports.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [reportMonth]);

  useEffect(() => {
    if (!isExportComposerOpen) return;

    let cancelled = false;

    async function loadExportTickets() {
      setIsLoadingExportTickets(true);
      setExportTicketsError(null);

      try {
        const response = await fetch('/api/tickets');
        const data = await response.json() as { tickets?: RepairTicket[]; error?: string };

        if (cancelled) return;

        if (!response.ok) {
          setExportTicketsError(data.error ?? 'Failed to load tickets for export.');
          return;
        }

        setExportTickets(Array.isArray(data.tickets) ? data.tickets : []);
      } catch {
        if (!cancelled) setExportTicketsError('Network error. Could not load export tickets.');
      } finally {
        if (!cancelled) setIsLoadingExportTickets(false);
      }
    }

    void loadExportTickets();
    return () => {
      cancelled = true;
    };
  }, [isExportComposerOpen]);

  const sortedTickets = sortTicketsByCreatedAt(tickets, sortOrder);
  const optionalExportTickets = sortTicketsByCreatedAt(
    exportTickets.filter((ticket) => getCreatedMonth(ticket.createdAt) !== reportMonth),
    'newest'
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Reports</h2>
          <p className="font-medium text-secondary">
            Tickets created in the selected report month, across every status.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid gap-1 rounded-xl border border-outline-variant bg-white px-4 py-2 text-xs font-bold text-secondary shadow-sm">
            <span>Report Month</span>
            <input
              type="month"
              value={reportMonth}
              onChange={(event) => {
                setReportMonth(event.target.value || getDefaultReportMonth());
                setSelectedExportTicketIds([]);
              }}
              className="bg-transparent text-sm font-black text-primary outline-none"
            />
          </label>
          <button
            onClick={() => {
              setExportError(null);
              setIsExportComposerOpen(true);
            }}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-xs font-bold text-secondary shadow-sm transition-all hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <label className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-primary-container">
            <Filter className="h-4 w-4" />
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as ReportSortOrder)}
              className="cursor-pointer bg-transparent font-bold text-white outline-none"
              aria-label="Sort reports by created date"
            >
              <option className="text-primary" value="newest">Newest to Oldest</option>
              <option className="text-primary" value="oldest">Oldest to Newest</option>
            </select>
          </label>
        </div>
      </div>

      {exportError && (
        <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs font-bold text-error">
          {exportError}
        </div>
      )}

      {loading && (
        <div className="py-20 text-center font-medium text-secondary">Loading reports...</div>
      )}

      {!loading && fetchError && (
        <div className="py-20 text-center font-medium text-error">{fetchError}</div>
      )}

      {!loading && !fetchError && sortedTickets.length === 0 && (
        <div className="py-20 text-center font-medium text-secondary">
          No tickets were created in this report month.
        </div>
      )}

      {!loading && !fetchError && sortedTickets.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {sortedTickets.map((ticket) => (
            <div
              key={ticket.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTicket(ticket)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedTicket(ticket);
                }
              }}
              className="group flex cursor-pointer items-center gap-6 rounded-2xl border border-outline-variant bg-white p-4 transition-all hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container text-xs font-black text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                {ticket.id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-3">
                  <h4 className="truncate text-[15px] font-bold text-primary">
                    {ticket.deviceName} - {ticket.problemType}
                  </h4>
                  <span className="rounded-full border border-outline-variant/50 bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
                    {ticket.status}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ticket.priority === 'Critical' ? 'bg-error/10 text-error' : ticket.priority === 'High' ? 'bg-amber-50 text-amber-700' : 'bg-surface-container text-secondary'}`}>
                    {ticket.priority}
                  </span>
                </div>
                <p className="mb-2 truncate text-xs text-secondary">{ticket.description}</p>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-outline">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    {ticket.employeeName} | {ticket.department}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Created {formatDate(ticket.createdAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTicket(ticket);
                }}
                className="p-2 text-outline opacity-0 transition-colors hover:text-primary group-hover:opacity-100"
                aria-label={`View ticket ${ticket.id}`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !fetchError && (
        <div className="flex items-center justify-between border-t border-outline-variant px-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-secondary">
          <span>Total Records: {sortedTickets.length}</span>
          <span>Generated: {new Date().toLocaleDateString()}</span>
        </div>
      )}

      <AnimatePresence>
        {isExportComposerOpen && (
          <MonthlyExportModal
            reportMonth={reportMonth}
            optionalTickets={optionalExportTickets}
            selectedTicketIds={selectedExportTicketIds}
            isLoading={isLoadingExportTickets}
            isExporting={isExporting}
            loadingError={exportTicketsError}
            onClose={() => setIsExportComposerOpen(false)}
            onToggleTicket={(ticketId) => {
              setSelectedExportTicketIds((current) =>
                current.includes(ticketId)
                  ? current.filter((selectedId) => selectedId !== ticketId)
                  : [...current, ticketId]
              );
            }}
            onExport={() => {
              void handleExport(selectedExportTicketIds);
            }}
          />
        )}
        {selectedTicket && (
          <TicketReportModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MonthlyExportModal({
  reportMonth,
  optionalTickets,
  selectedTicketIds,
  isLoading,
  isExporting,
  loadingError,
  onClose,
  onToggleTicket,
  onExport,
}: {
  reportMonth: string;
  optionalTickets: RepairTicket[];
  selectedTicketIds: string[];
  isLoading: boolean;
  isExporting: boolean;
  loadingError: string | null;
  onClose: () => void;
  onToggleTicket: (ticketId: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.section
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        className="relative flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">Monthly Export</p>
            <h3 className="text-2xl font-black tracking-tight text-primary">Repair report for {reportMonth}</h3>
            <p className="mt-1 text-sm font-medium text-secondary">
              Tickets from this month are included automatically. Add other months only when needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-outline transition-colors hover:bg-white hover:text-primary"
            aria-label="Close export options"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low/40 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-secondary">
              Optional cross-month tickets
            </p>
            <p className="mt-1 text-sm text-secondary">
              Leave every box unchecked to export only the selected month.
            </p>
          </div>

          {isLoading && (
            <p className="rounded-2xl border border-outline-variant px-4 py-6 text-center text-sm font-bold text-secondary">
              Loading optional tickets...
            </p>
          )}

          {!isLoading && loadingError && (
            <p className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-bold text-error">
              {loadingError}
            </p>
          )}

          {!isLoading && !loadingError && optionalTickets.length === 0 && (
            <p className="rounded-2xl border border-outline-variant px-4 py-6 text-center text-sm font-bold text-secondary">
              No tickets from other months are available.
            </p>
          )}

          {!isLoading && !loadingError && optionalTickets.length > 0 && (
            <div className="grid gap-3">
              {optionalTickets.map((ticket) => (
                <label
                  key={ticket.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-outline-variant p-4 transition-colors hover:border-primary"
                >
                  <input
                    type="checkbox"
                    checked={selectedTicketIds.includes(ticket.id)}
                    onChange={() => onToggleTicket(ticket.id)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-primary">
                      {ticket.id} | {ticket.deviceName} | {getCreatedMonth(ticket.createdAt)}
                    </span>
                    <span className="block truncate text-xs font-bold uppercase tracking-wider text-secondary">
                      {ticket.status} | {ticket.employeeName} | {ticket.problemType}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-low px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-secondary">
            Extra tickets selected: {selectedTicketIds.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-outline-variant bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-secondary transition-colors hover:border-primary"
            >
              Cancel
            </button>
            <button
              onClick={onExport}
              disabled={isExporting}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </footer>
      </motion.section>
    </div>
  );
}

export function TicketReportModal({ ticket, onClose }: { ticket: RepairTicket; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 lg:p-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative flex h-full max-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-low px-8 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="shrink-0 rounded-2xl bg-primary/10 p-2.5">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight text-primary">Ticket #{ticket.id}</h3>
                <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-[9px] font-black uppercase text-green-700">
                  {ticket.status}
                </span>
              </div>
              <p className="truncate text-xs font-medium tracking-tight text-secondary">
                Repair Ticket Detail
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2.5 text-outline transition-all hover:bg-surface-container hover:text-error">
            <LogOut className="h-5 w-5 rotate-180" />
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="custom-scrollbar w-full shrink-0 space-y-8 overflow-y-auto border-r border-outline-variant bg-surface-container-low/30 p-8 lg:w-[360px]">
            <div>
              <h4 className="mb-4 pl-1 text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                Ticket Metadata
              </h4>
              <div className="space-y-5 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                    {ticket.id}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold leading-tight text-primary">{ticket.deviceName}</p>
                    <p className="truncate text-[11px] font-medium text-secondary">{ticket.employeeName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/30 pt-4 text-[11px]">
                  <div>
                    <p className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-outline">Created</p>
                    <p className="font-bold text-primary">{formatDate(ticket.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-outline">Completed</p>
                    <p className="font-bold text-primary">{formatDate(ticket.completedAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-4 pl-1 text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
                Ownership
              </h4>
              <div className="space-y-4 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-primary" />
                  <p className="break-all text-xs font-bold text-primary">{ticket.employeeName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bold text-primary">{ticket.department}</p>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-xs font-bold uppercase text-primary">{ticket.status}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden bg-white">
            <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-8">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Problem Type</p>
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/50 p-6">
                  <h4 className="text-xl font-black leading-snug tracking-tight text-primary">{ticket.problemType}</h4>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Description</p>
                <div className="rounded-2xl border-2 border-outline-variant bg-white p-6 shadow-sm">
                  <p className="text-sm leading-relaxed text-secondary">{ticket.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-outline">Ticket ID</p>
                  <p className="text-lg font-black text-primary">#{ticket.id}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-outline">Priority</p>
                  <p className="text-xs font-bold text-primary">{ticket.priority}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-outline">Employee Email</p>
                  <p className="break-all text-xs font-black text-primary">{ticket.employeeEmail}</p>
                </div>
              </div>
            </div>

            <footer className="flex shrink-0 items-center justify-end border-t border-outline-variant bg-surface-container-low px-8 py-5">
              <button onClick={onClose} className="rounded-xl bg-primary px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary-container">
                Close Detail
              </button>
            </footer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
