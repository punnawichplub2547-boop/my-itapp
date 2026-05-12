"use client";

import { useState } from 'react';
import { motion } from 'motion/react';
import { AnimatePresence } from 'motion/react';
import { Calendar, CheckCircle2, ChevronRight, Clock, FileSpreadsheet, FileText, Filter, LogOut, MessageSquare, User } from 'lucide-react';
import { MOCK_REPORTS } from '../data/mockData';
import { ReportEntry } from '../types';

export default function ReportsView() {
  const [selectedReport, setSelectedReport] = useState<ReportEntry | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const sortedReports = [...MOCK_REPORTS].sort((a, b) => {
    const dateA = parseReportDate(a.created).getTime();
    const dateB = parseReportDate(b.created).getTime();

    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-primary tracking-tight">Modern reports</h2>
          <p className="text-secondary font-medium">Historical logs and performance data in a modern view.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant rounded-xl text-xs font-bold text-secondary hover:border-primary transition-all shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-container transition-all shadow-lg">
            <Filter className="w-4 h-4" />
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
              aria-label="Sort reports by created date"
            >
              <option className="text-primary" value="newest">Newest to Oldest</option>
              <option className="text-primary" value="oldest">Oldest to Newest</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sortedReports.map((report) => (
          <div
            key={report.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedReport(report)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedReport(report);
              }
            }}
            className="bg-white border border-outline-variant rounded-2xl p-4 flex items-center gap-6 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0 font-black text-primary border border-outline-variant/30 group-hover:bg-primary group-hover:text-white transition-colors">
              {report.id}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h4 className="font-bold text-primary truncate text-[15px]">{report.summary}</h4>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-bold text-secondary uppercase border border-outline-variant/50">{report.status}</span>
              </div>
              <p className="text-xs text-secondary truncate mb-2">{report.description}</p>
              <div className="flex items-center gap-4 text-[10px] text-outline font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {report.created}</span>
                <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> {report.createdBy}</span>
              </div>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setSelectedReport(report);
              }}
              className="p-2 text-outline hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`View report ${report.id}`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center text-[10px] font-bold text-secondary uppercase tracking-widest px-1 pt-4 border-t border-outline-variant">
        <span>Total Records: {sortedReports.length}</span>
        <span>Generated: {new Date().toLocaleDateString()}</span>
      </div>

      <AnimatePresence>
        {selectedReport && (
          <ReportDetailModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function parseReportDate(value: string) {
  const [first, second, year] = value.split('/').map(Number);
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;

  return new Date(year, month - 1, day);
}

function ReportDetailModal({ report, onClose }: { report: ReportEntry, onClose: () => void }) {
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
                <h3 className="text-xl font-bold text-primary tracking-tight">Report #{report.id}</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-green-50 text-green-700 border-green-200">
                  {report.status}
                </span>
              </div>
              <p className="text-xs text-secondary font-medium tracking-tight truncate">Historical Report Detail & Activity Summary</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-surface-container text-outline hover:text-error rounded-full transition-all">
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          <div className="w-full lg:w-[360px] border-r border-outline-variant bg-surface-container-low/30 overflow-y-auto custom-scrollbar p-8 space-y-8 shrink-0">
            <div>
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 pl-1">Report Metadata</h4>
              <div className="bg-white border border-outline-variant p-5 rounded-2xl space-y-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                    {report.id}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-primary truncate leading-tight">Report Record</p>
                    <p className="text-[11px] text-secondary font-medium truncate">{report.createdBy}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/30 text-[11px]">
                  <div>
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest mb-0.5">Created</p>
                    <p className="font-bold text-primary">{report.created}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest mb-0.5">Status</p>
                    <p className="font-bold text-primary uppercase">{report.status}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 pl-1">Ownership</h4>
              <div className="bg-white border border-outline-variant p-5 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-primary break-all">{report.createdBy}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-primary">{report.created}</p>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-xs font-bold text-primary uppercase">{report.status}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <nav className="flex px-8 border-b border-outline-variant shrink-0 gap-8">
              <div className="py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 relative text-primary">
                <MessageSquare size={14} /> Report Details
                <motion.div layoutId="report-modal-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
              </div>
              <div className="py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-outline">
                <Clock size={14} /> Activity Snapshot
              </div>
            </nav>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Summary</p>
                <div className="bg-surface-container-low/50 border border-outline-variant/30 rounded-2xl p-6">
                  <h4 className="text-xl font-black text-primary tracking-tight leading-snug">{report.summary}</h4>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Description</p>
                <div className="bg-white border-2 border-outline-variant rounded-2xl p-6 shadow-sm">
                  <p className="text-sm text-secondary leading-relaxed">{report.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                  <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-2">Record ID</p>
                  <p className="text-lg font-black text-primary">#{report.id}</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                  <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-2">Created By</p>
                  <p className="text-xs font-bold text-primary break-all">{report.createdBy}</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-5">
                  <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-2">Created Date</p>
                  <p className="text-sm font-black text-primary">{report.created}</p>
                </div>
              </div>
            </div>

            <footer className="px-8 py-5 border-t border-outline-variant bg-surface-container-low shrink-0 flex justify-between items-center">
              <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Report Review Console</span>
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
