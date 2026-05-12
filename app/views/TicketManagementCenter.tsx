"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ticket, HelpCircle, PlusCircle, Search, Laptop, CheckCircle2, Clock, LogOut, FileType, Send, Filter, MessageSquare, Mail, History, X } from 'lucide-react';
import { MOCK_NOTIFICATIONS, MOCK_TICKETS } from '../data/mockData';
import { RepairTicket } from '../types';

export default function TicketManagementCenter({
  tickets = MOCK_TICKETS,
  selectedId,
  onSelectTicket,
  onTicketUpdated = () => {},
  onTicketDeleted = () => {},
}: {
  tickets?: RepairTicket[];
  selectedId: string | null;
  onSelectTicket: (id: string | null) => void;
  onTicketUpdated?: (ticket: RepairTicket) => void;
  onTicketDeleted?: (ticketId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState('All Open Tickets');

  const openTickets = tickets.filter(t => t.status !== 'Completed' && t.status !== 'Closed');
  const closedTickets = tickets.filter(t => t.status === 'Completed' || t.status === 'Closed');

  const tabs = [
    { id: 'Assigned to Me', count: openTickets.length },
    { id: 'All Open Tickets', count: openTickets.length },
    { id: 'Completed / Closed', count: closedTickets.length },
  ];

  const filteredTickets = tickets.filter(t => {
    if (activeTab === 'Assigned to Me') return t.status !== 'Completed' && t.status !== 'Closed';
    if (activeTab === 'All Open Tickets') return t.status !== 'Completed' && t.status !== 'Closed';
    if (activeTab === 'Completed / Closed') return t.status === 'Completed' || t.status === 'Closed';
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 min-h-screen">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-primary tracking-tight">Ticket Management Center</h2>
          <p className="text-secondary font-medium italic">Spiceworks Inspired Infrastructure Support</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center px-6">
          <nav className="flex gap-10">
            {tabs.map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 pt-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id ? 'text-primary' : 'text-secondary hover:text-primary'}`}
              >
                <div className="flex items-center gap-2">
                  {tab.id}
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-surface-container text-secondary'}`}>
                    {tab.count}
                  </span>
                </div>
                {activeTab === tab.id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
              <input 
                placeholder="Search tickets..." 
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-outline-variant rounded-lg text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-secondary" />
              <select className="bg-white border-0 text-[10px] font-bold text-primary uppercase outline-none cursor-pointer">
                <option>Newest First</option>
                <option>Priority: High</option>
                <option>Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left table-fixed">
            <thead className="bg-surface-container-low/30 text-[10px] font-bold text-secondary uppercase tracking-widest border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 w-28">ID</th>
                <th className="px-6 py-4 w-1/3">Device & Problem</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-xs">
              {filteredTickets.map(ticket => (
                <tr 
                  key={ticket.id} 
                  onClick={() => onSelectTicket(ticket.id)}
                  className="hover:bg-primary/5 transition-all cursor-pointer group"
                >
                  <td className="px-6 py-5 font-mono font-black text-primary text-[13px]">{ticket.id}</td>
                  <td className="px-6 py-5">
                    <p className="font-bold text-[14px] text-primary group-hover:text-primary-container">{ticket.deviceName}</p>
                    <p className="text-secondary text-[11px] font-medium truncate">{ticket.description}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-bold text-primary">{ticket.employeeName}</p>
                    <p className="text-[10px] text-outline font-medium">{ticket.department}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                      ticket.priority === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                      ticket.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      ticket.priority === 'Medium' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-5 uppercase font-black text-[10px] tracking-widest">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        ticket.status === 'In Progress' ? 'bg-blue-500' :
                        ticket.status === 'Waiting for Parts' ? 'bg-orange-500' :
                        ticket.status === 'Completed' ? 'bg-green-500' : 
                        ticket.status === 'Closed' ? 'bg-red-500' : 'bg-gray-400'
                      }`}></div>
                      {ticket.status}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="px-3 py-1.5 bg-primary/10 text-primary-fixed-dim rounded-lg font-bold text-[10px] uppercase hover:bg-primary hover:text-white transition-all shadow-sm">
                      View Ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 bg-surface-container-low border-t border-outline-variant flex justify-between items-center text-[10px] font-black font-mono text-secondary uppercase tracking-widest">
          <span>{filteredTickets.length} items found in this category</span>
          <div className="flex gap-4">
            <button className="hover:text-primary">Download Report</button>
            <button className="hover:text-primary">Archive All</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedId && (
          <TicketDetailModal
            key={selectedId}
            ticket={tickets.find(t => t.id === selectedId) || filteredTickets[0]}
            onClose={() => onSelectTicket(null)}
            onTicketUpdated={onTicketUpdated}
            onTicketDeleted={onTicketDeleted}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function TicketDetailModal({
  ticket,
  onClose,
  onTicketUpdated,
  onTicketDeleted,
}: {
  ticket: RepairTicket;
  onClose: () => void;
  onTicketUpdated: (ticket: RepairTicket) => void;
  onTicketDeleted: (ticketId: string) => void;
}) {
  const [localTicket, setLocalTicket] = useState<RepairTicket>(ticket);
  const [activeTab, setActiveTab] = useState('notes');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'preview' | 'sent'>('idle');
  const [noteText, setNoteText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function handleStatusShift(nextStatus: RepairTicket['status']) {
    if (nextStatus === localTicket.status || isUpdating) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const response = await fetch(`/api/tickets/${localTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousStatus: localTicket.status, nextStatus, ticket: localTicket }),
      });
      const result = await response.json();
      if (!response.ok) {
        setUpdateError(result.error ?? 'Failed to update status.');
        return;
      }
      const updated = result.ticket as RepairTicket;
      setLocalTicket(updated);
      onTicketUpdated(updated);
    } catch {
      setUpdateError('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddNote() {
    if (!noteText.trim() || isUpdating) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const response = await fetch(`/api/tickets/${localTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteContent: noteText }),
      });
      const result = await response.json();
      if (!response.ok) {
        setUpdateError(result.error ?? 'Failed to add note.');
        return;
      }
      const updated = result.ticket as RepairTicket;
      setLocalTicket(updated);
      setNoteText('');
      onTicketUpdated(updated);
    } catch {
      setUpdateError('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ticket ${localTicket.id}? This cannot be undone.`)) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const response = await fetch(`/api/tickets/${localTicket.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setUpdateError((result as { error?: string }).error ?? 'Failed to delete ticket.');
        return;
      }
      onTicketDeleted(localTicket.id);
      onClose();
    } catch {
      setUpdateError('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  }

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
        className="relative bg-white w-full max-w-6xl h-full max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20"
      >
        <header className="px-8 py-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-2xl">
              <Ticket className="text-primary w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-primary tracking-tight">{localTicket.id}</h3>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                  localTicket.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  localTicket.status === 'Waiting for Parts' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  localTicket.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-secondary border-gray-200'
                }`}>{localTicket.status}</span>
              </div>
              <p className="text-xs text-secondary font-medium tracking-tight">Support Ticket Detail & Management</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-surface-container text-outline hover:text-error rounded-full transition-all">
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left: Info */}
          <div className="w-full lg:w-[420px] border-r border-outline-variant bg-surface-container-low/30 overflow-y-auto custom-scrollbar p-8 space-y-8 shrink-0">
            <div>
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 pl-1">Employee Details</h4>
              <div className="bg-white border border-outline-variant p-5 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary font-black uppercase text-sm">
                    {localTicket.employeeName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-primary truncate leading-tight">{localTicket.employeeName}</p>
                    <p className="text-[11px] text-secondary font-medium truncate">{localTicket.employeeEmail}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/30 text-[11px]">
                  <div>
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest mb-0.5">Department</p>
                    <p className="font-bold text-primary">{localTicket.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest mb-0.5">Reported On</p>
                    <p className="font-bold text-primary italic leading-none">{formatTimestamp(localTicket.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 pl-1">Device Information</h4>
              <div className="bg-white border border-outline-variant p-5 rounded-2xl space-y-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/5 p-2 rounded-lg text-primary">
                    <Laptop size={20} />
                  </div>
                  <p className="font-bold text-primary text-[15px]">{localTicket.deviceName}</p>
                </div>
                <div className="space-y-4 pt-2">
                  <div>
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest mb-1.5 flex items-center gap-1.5">
                      <HelpCircle size={10} /> Problem Description
                    </p>
                    <p className="text-xs text-secondary leading-relaxed bg-surface-container-low p-3 rounded-xl border border-outline-variant/30">
                      {localTicket.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-outline uppercase font-black text-[9px] tracking-widest">Priority level</p>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      localTicket.priority === 'Critical' ? 'text-error' :
                      localTicket.priority === 'High' ? 'text-orange-600' : 'text-blue-600'
                    }`}>● {localTicket.priority}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 pl-1">Attachments</h4>
              <div className="bg-white border border-outline-variant p-4 rounded-2xl grid grid-cols-3 gap-3 shadow-sm">
                <div className="aspect-square bg-surface-container rounded-xl flex items-center justify-center border border-outline-variant/40 hover:border-primary cursor-pointer transition-all">
                  <PlusCircle className="text-outline w-6 h-6 hover:text-primary" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Management */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <nav className="flex px-8 border-b border-outline-variant shrink-0 gap-8">
              {[
                { id: 'notes', label: 'Repair Notes', icon: <MessageSquare size={14} /> },
                { id: 'history', label: 'History', icon: <Clock size={14} /> },
                { id: 'email', label: 'Email Panel', icon: <Mail size={14} /> }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 relative transition-all ${activeTab === t.id ? 'text-primary' : 'text-outline hover:text-primary'}`}
                >
                  {t.icon} {t.label}
                  {activeTab === t.id && <motion.div layoutId="modal-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              {activeTab === 'notes' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-bold text-primary flex items-center gap-2"><MessageSquare size={16} /> Technical Notes</h5>
                    <span className="text-[10px] font-black text-outline uppercase tracking-widest">Internal only</span>
                  </div>
                  <div className="space-y-4">
                    {(localTicket.notes ?? []).length === 0 ? (
                      <p className="text-[11px] text-outline italic text-center py-4">No notes yet.</p>
                    ) : (localTicket.notes ?? []).map((note) => (
                      <div key={note.id} className="bg-surface-container-low/50 p-4 rounded-2xl border border-outline-variant/30 flex gap-4">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] border border-primary/20">
                          {note.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-baseline mb-1">
                            <p className="text-xs font-bold text-primary">{note.author}</p>
                            <p className="text-[9px] font-mono text-outline">{formatTimestamp(note.timestamp)}</p>
                          </div>
                          <p className="text-[13px] text-secondary leading-relaxed">{note.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 sticky bottom-0 bg-white">
                    <div className="relative">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a repair note..."
                        className="w-full p-4 pr-12 bg-white border-2 border-outline-variant focus:border-primary rounded-2xl text-[13px] outline-none transition-all resize-none shadow-sm"
                        rows={3}
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={!noteText.trim() || isUpdating}
                        className="absolute right-4 bottom-4 p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-bold text-primary flex items-center gap-2"><Clock size={16} /> Audit trail</h5>
                  </div>
                  <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/30">
                    {(localTicket.history ?? []).length === 0 ? (
                      <p className="text-[11px] text-outline italic text-center py-4">No history yet.</p>
                    ) : (localTicket.history ?? []).map((h) => (
                      <div key={h.id} className="relative">
                        <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-primary bg-white z-10"></div>
                        <div>
                          <p className="text-[13px] font-bold text-primary">{h.action}</p>
                          <p className="text-[11px] text-secondary font-medium">{h.user} • {formatTimestamp(h.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'email' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-bold text-primary flex items-center gap-2"><Mail size={16} /> Notification Console</h5>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100 text-[9px] font-black uppercase tracking-widest">
                      <CheckCircle2 size={12} /> Ready to send
                    </div>
                  </div>

                  {/* Notification Timeline history */}
                  <div className="bg-white border-2 border-outline-variant rounded-2xl p-6 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h6 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                        <History size={14} /> Notification History
                      </h6>
                      <div className="text-[9px] font-black text-outline uppercase tracking-widest">
                        {MOCK_NOTIFICATIONS.filter(n => n.ticketId === localTicket.id).length} Entries
                      </div>
                    </div>
                    
                    <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/30">
                      {MOCK_NOTIFICATIONS.filter(n => n.ticketId === localTicket.id).map((notif) => (
                        <div key={notif.id} className="relative group">
                          {/* Dot */}
                          <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 bg-white z-10 flex items-center justify-center transition-all group-hover:scale-110 shadow-sm ${
                            notif.deliveryStatus === 'Delivered' ? 'border-green-500' :
                            notif.deliveryStatus === 'Sent' ? 'border-blue-500' : 
                            notif.deliveryStatus === 'Pending' ? 'border-amber-500' : 'border-red-500'
                          }`}>
                            {notif.deliveryStatus === 'Delivered' && <CheckCircle2 size={8} className="text-green-500" />}
                            {(notif.deliveryStatus === 'Sent' || notif.deliveryStatus === 'Pending') && <div className={`w-1 h-1 rounded-full ${notif.deliveryStatus === 'Sent' ? 'bg-blue-500' : 'bg-amber-500'}`} />}
                            {notif.deliveryStatus === 'Failed' && <X size={8} className="text-red-500" />}
                          </div>
                          
                          <div className="bg-surface-container-low/50 p-4 rounded-xl border border-outline-variant/30 hover:border-primary/40 transition-all cursor-pointer">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h5 className="text-[11px] font-black text-primary uppercase tracking-tight">{notif.notificationType}</h5>
                                <p className="text-[10px] text-outline font-medium">Sent: {notif.sentAt}</p>
                              </div>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                notif.deliveryStatus === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                                notif.deliveryStatus === 'Sent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                notif.deliveryStatus === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {notif.deliveryStatus}
                              </span>
                            </div>
                            <p className="text-[12px] text-secondary leading-relaxed italic border-l-2 border-primary/20 pl-3">
                              {notif.subject}
                            </p>
                          </div>
                        </div>
                      ))}
                      {MOCK_NOTIFICATIONS.filter(n => n.ticketId === localTicket.id).length === 0 && (
                        <p className="text-[10px] text-outline text-center py-4 italic font-medium tracking-widest">No notification logs found for this ticket.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-surface-container px-6 py-3 border-b border-outline-variant flex justify-between items-center">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Email Preview</p>
                      <FileType size={14} className="text-outline" />
                    </div>
                    <div className="p-8 space-y-6 font-sans">
                      <div className="space-y-1 pb-4 border-b border-outline-variant/50">
                        <p className="text-[12px]"><span className="font-bold text-outline uppercase w-20 inline-block">Subject:</span> <span className="text-primary font-bold">Repair Update - {localTicket.id}</span></p>
                        <p className="text-[12px]"><span className="font-bold text-outline uppercase w-20 inline-block">To:</span> <span className="text-primary font-bold">{localTicket.employeeEmail}</span></p>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm font-medium">Hello {localTicket.employeeName},</p>
                        <p className="text-sm text-secondary leading-relaxed">This is an update regarding your repair request for the <span className="font-bold text-primary">{localTicket.deviceName}</span>.</p>
                        <div className="bg-white border-2 border-outline-variant p-4 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-outline">Current Status</span>
                          <span className="px-3 py-1 rounded-lg bg-primary text-white font-black uppercase text-[10px] tracking-widest">{localTicket.status}</span>
                        </div>
                        <div className="p-4 bg-tertiary-container/10 border border-tertiary/20 rounded-xl space-y-2">
                          <p className="text-[9px] font-black text-tertiary uppercase tracking-widest">Technician Note:</p>
                          <p className="text-xs italic text-secondary leading-relaxed">&quot;Waiting for replacement parts. We will finalize the hardware replacement once components arrive at our central warehouse.&quot;</p>
                        </div>
                        <p className="text-sm text-secondary">Thank you for your patience.</p>
                        <div className="pt-6 border-t border-outline-variant/50">
                          <p className="text-xs font-bold text-primary">IT Support Team</p>
                          <p className="text-[10px] text-outline font-medium tracking-tighter">Enterprise Infrastructure Management System</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        setEmailStatus('sent');
                        setTimeout(() => setEmailStatus('idle'), 2000);
                      }}
                      className="flex-1 bg-primary text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-primary/20 hover:bg-primary-container transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                      {emailStatus === 'sent' ? (
                        <>
                          <CheckCircle2 size={18} /> Notification Sent
                        </>
                      ) : (
                        <>
                          <Send size={16} /> Send Email Update
                        </>
                      )}
                    </button>
                    <button className="px-6 py-4 border-2 border-outline-variant text-[11px] font-black uppercase tracking-widest text-primary rounded-2xl hover:bg-primary/5 transition-all">
                      Print Detail
                    </button>
                  </div>
                </div>
              )}
            </div>

            <footer className="px-8 py-5 border-t border-outline-variant bg-surface-container-low shrink-0 space-y-2">
              {updateError && (
                <p className="text-[10px] text-error font-bold text-center">{updateError}</p>
              )}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Quick Status Shift</span>
                  <div className="flex gap-2">
                    {(['Pending', 'In Progress', 'Waiting for Parts', 'Completed'] as RepairTicket['status'][]).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusShift(s)}
                        disabled={isUpdating}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          localTicket.status === s ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-secondary border-outline-variant hover:border-primary'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleDelete} disabled={isUpdating} className="text-xs font-bold text-error uppercase hover:underline disabled:opacity-50 disabled:cursor-not-allowed">Delete Ticket</button>
              </div>
            </footer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
