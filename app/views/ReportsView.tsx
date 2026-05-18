"use client";

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AnimatePresence } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Filter,
  LogOut,
  User,
} from 'lucide-react';
import type { RepairTicket } from '../types';

function formatDate(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

async function exportExcel(sortOrder: 'newest' | 'oldest'): Promise<void> {
  const response = await fetch(`/api/reports/export?sort=${sortOrder}`);
  if (!response.ok) {
    let message = 'Failed to export report.';
    try {
      const data = await response.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body; fall back to default message
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repair-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsView() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await exportExcel(sortOrder);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export report.');
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/reports');
        const data = await res.json() as { tickets?: RepairTicket[]; error?: string };

        if (cancelled) return;

        if (!res.ok) {
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

    void load();
    return () => { cancelled = true; };
  }, []);

  const sortedTickets = [...tickets].sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return sortOrder === 'newest' ? tb - ta : ta - tb;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-primary tracking-tight">Reports</h2>
          <p className="text-secondary font-medium">Completed &amp; closed tickets from the last 30 days.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { void handleExport(); }}
            disabled={sortedTickets.length === 0 || isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant rounded-xl text-xs font-bold text-secondary hover:border-primary transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" /> {isExporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-container transition-all shadow-lg">
            <Filter className="w-4 h-4" />
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
              aria-label="Sort reports by completed date"
            >
              <option className="text-primary" value="newest">Newest to Oldest</option>
              <option className="text-primary" value="oldest">Oldest to Newest</option>
            </select>
          </label>
        </div>
      </div>

      {exportError && (
        <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-bold">
          {exportError}
        </div>
      )}

      {loading && (
        <div className="py-20 text-center text-secondary font-medium">Loading reports...</div>
      )}

      {!loading && fetchError && (
        <div className="py-20 text-center text-error font-medium">{fetchError}</div>
      )}

      {!loading && !fetchError && sortedTickets.length === 0 && (
        <div className="py-20 text-center text-secondary font-medium">
          No completed or closed tickets in the last 30 days.
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
              className="bg-white border border-outline-variant rounded-2xl p-4 flex items-center gap-6 hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0 font-black text-primary border border-outline-variant/30 group-hover:bg-primary group-hover:text-white transition-colors text-xs">
                {ticket.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-primary truncate text-[15px]">{ticket.deviceName} — {ticket.problemType}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-secondary uppercase border border-outline-variant/50">{ticket.status}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ticket.priority === 'Critical' ? 'bg-error/10 text-error' : ticket.priority === 'High' ? 'bg-amber-50 text-amber-700' : 'bg-surface-container text-secondary'}`}>{ticket.priority}</span>
                </div>
                <p className="text-xs text-secondary truncate mb-2">{ticket.description}</p>
                <div className="flex items-center gap-4 text-[10px] text-outline font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> {ticket.employeeName} · {ticket.department}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Completed {formatDate(ticket.completedAt)}</span>
                </div>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTicket(ticket);
                }}
                className="p-2 text-outline hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                aria-label={`View ticket ${ticket.id}`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !fetchError && (
        <div className="flex justify-between items-center text-[10px] font-bold text-secondary uppercase tracking-widest px-1 pt-4 border-t border-outline-variant">
          <span>Total Records: {sortedTickets.length}</span>
          <span>Generated: {new Date().toLocaleDateString()}</span>
        </div>
      )}

      <AnimatePresence>
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
        className="relative bg-white w-full max-w-5xl h-full max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20"
      >
        <header className="px-8 py-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="bg-primary/10 p-2.5 rounded-2xl shrink-0">
              <FileText className="text-primary w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-primary tracking-tight">Ticket #{ticket.id}</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-green-50 text-green-700 border-green-200">
                  {ticket.status}
                </span>
              </div>
              <p className="text-xs text-secondary font-medium tracking-tight truncate">Completed Repair Ticket Detail</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-surface-container text-outline hover:text-error rounded-full transition-all">
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          <div className="w-full lg:w-[360px] border-r border-outline-variant bg-surface-container-low/30 overflow-y-auto custom-scrollbar p-8 space-y-8 shrink-0">
            <div>
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 pl-1">Ticket Metadata</h4>
              <div className="bg-white border border-outline-variant p-5 rounded-2xl space-y-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                    {ticket.id}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-primary truncate leading-tight">{ticket.deviceName}</p>
                    <p className="text-[11px] text-secondary font-medium truncate">{ticket.employeeName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/30 text-[11px]">
                  <div>
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest mb-0.5">Created</p>
                    <p className="font-bold text-primary">{formatDate(ticket.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest mb-0.5">Completed</p>
                    <p className="font-bold text-primary">{formatDate(ticket.completedAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 pl-1">Ownership</h4>
              <div className="bg-white border border-outline-variant p-5 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-primary break-all">{ticket.employeeName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-primary">{ticket.department}</p>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-xs font-bold text-primary uppercase">{ticket.status}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Problem Type</p>
                <div className="bg-surface-container-low/50 border border-outline-variant/30 rounded-2xl p-6">
                  <h4 className="text-xl font-black text-primary tracking-tight leading-snug">{ticket.problemType}</h4>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Description</p>
                <div className="bg-white border-2 border-outline-variant rounded-2xl p-6 shadow-sm">
                  <p className="text-sm text-secondary leading-relaxed">{ticket.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                  <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-2">Ticket ID</p>
                  <p className="text-lg font-black text-primary">#{ticket.id}</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                  <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-2">Priority</p>
                  <p className="text-xs font-bold text-primary">{ticket.priority}</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                  <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-2">Employee Email</p>
                  <p className="text-xs font-black text-primary break-all">{ticket.employeeEmail}</p>
                </div>
              </div>
            </div>

            <footer className="px-8 py-5 border-t border-outline-variant bg-surface-container-low shrink-0 flex justify-end items-center">
              <button onClick={onClose} className="px-5 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all">
                Close Detail
              </button>
            </footer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
