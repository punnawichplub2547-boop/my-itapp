"use client";

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Laptop, Server, Printer, Smartphone, Wrench, ShieldCheck, CheckCircle2, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { MOCK_TICKETS } from '../data/mockData';
import StatCard from '../components/StatCard';
import { getWarrantyStatus } from '../utils/status';
import type { Device } from '../types';

export default function Dashboard({
  onTicketClick,
  devices,
}: {
  onTicketClick: (id: string) => void;
  devices?: Device[];
}) {
  const [activityFilter, setActivityFilter] = useState('All');
  const [fetchedDevices, setFetchedDevices] = useState<Device[]>([]);

  useEffect(() => {
    if (devices) {
      return;
    }

    let cancelled = false;

    async function loadDevices() {
      try {
        const response = await fetch('/api/devices');
        const result = await response.json();

        if (!response.ok || cancelled) {
          return;
        }

        setFetchedDevices(Array.isArray(result.devices) ? result.devices : []);
      } catch {
        if (!cancelled) {
          setFetchedDevices([]);
        }
      }
    }

    void loadDevices();

    return () => {
      cancelled = true;
    };
  }, [devices]);

  const filteredTickets = activityFilter === 'All' 
    ? MOCK_TICKETS 
    : MOCK_TICKETS.filter(t => t.status.toLowerCase().includes(activityFilter.toLowerCase()));

  const fleetDevices = devices ?? fetchedDevices;
  const totalDevices = fleetDevices.length;
  const deviceStatusData = fleetDevices.map(device => ({
    device,
    status: getWarrantyStatus(device.expireDateSecondary || device.expireDatePrimary),
  }));
  const expiredCount = deviceStatusData.filter(s => s.status.label === 'Expired').length;
  const expiringSoonCount = deviceStatusData.filter(s => s.status.label === 'Expiring Soon').length;
  const activeCount = deviceStatusData.filter(s => s.status.label === 'Active').length;
  const alertingDevices = deviceStatusData.filter(item => item.status.label !== 'Active');
  const laptopCount = fleetDevices.filter(device => device.deviceType === 'Laptop' || device.deviceType === 'Notebook').length;
  const pcCount = fleetDevices.filter(device => device.deviceType === 'PC' || device.deviceType === 'Desktop').length;
  const serverCount = fleetDevices.filter(device => device.deviceType === 'Server').length;
  const unassignedCount = fleetDevices.filter(device => !device.assignedTo.trim()).length;
  const availableAssets = fleetDevices.filter(device => device.status === 'Active').length;
  const availabilityPercent = totalDevices === 0 ? 0 : Math.round((availableAssets / totalDevices) * 100);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-primary tracking-tight">System Overview</h2>
          <p className="text-secondary font-medium">Enterprise Asset Health & Lifecycle Monitoring</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-outline-variant shadow-sm flex items-center gap-3">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold text-primary">{new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()} - LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Assets" value={totalDevices.toString()} icon={<Laptop />} border="primary" />
        <StatCard label="Active Warranty" value={activeCount.toString()} icon={<ShieldCheck />} border="success" />
        <StatCard label="Expiring Soon" value={expiringSoonCount.toString()} icon={<Clock />} border="warning" />
        <StatCard label="Expired / Critical" value={expiredCount.toString()} icon={<AlertTriangle />} border="error" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 bg-white rounded-3xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
          <div className="bg-surface-container-low px-6 py-4 border-b border-outline-variant flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Wrench className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-primary">Recent Repair Activity</h4>
              <div className="ml-4">
                <select 
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="bg-white border border-outline-variant rounded-lg px-2 py-1 text-[10px] font-bold uppercase outline-none cursor-pointer"
                >
                  <option>All</option>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </div>
            </div>
            <button className="text-[11px] font-bold text-primary uppercase hover:underline">View All</button>
          </div>
          <div className="divide-y divide-outline-variant overflow-y-auto max-h-[500px] custom-scrollbar">
            {filteredTickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => onTicketClick(ticket.id)}
                className="p-5 hover:bg-surface-container-low/50 transition-all flex items-center gap-4 group cursor-pointer"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  ticket.status === 'In Progress' ? 'bg-blue-50 text-blue-600' :
                  ticket.status === 'Waiting for Parts' ? 'bg-orange-50 text-orange-600' :
                  ticket.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-surface-container text-secondary'
                }`}>
                  {ticket.deviceName.includes('MacBook') ? <Laptop size={20} /> :
                   ticket.deviceName.includes('Dell') ? <Server size={20} /> :
                   ticket.deviceName.includes('HP') ? <Printer size={20} /> : <Smartphone size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-primary truncate group-hover:text-primary-container transition-colors">{ticket.deviceName} - {ticket.description.split('.')[0]}</h5>
                  <p className="text-xs text-secondary truncate">Assigned to: Admin • Ticket {ticket.id}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 basis-32">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                    ticket.status === 'Waiting for Parts' ? 'bg-orange-100 text-orange-700' :
                    ticket.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>{ticket.status}</span>
                  <span className="text-[10px] font-mono text-outline font-medium">{ticket.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-4 space-y-6">
          <div className="bg-error-container/10 border border-error/20 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-error-container/30 px-6 py-4 border-b border-error/10 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-error" />
              <h4 className="font-bold text-error">Warranty Alerts</h4>
              {alertingDevices.length > 0 && (
                <span className="ml-auto bg-error text-white text-[10px] font-black px-2 py-0.5 rounded-full">{alertingDevices.length}</span>
              )}
            </div>
            <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar">
              {alertingDevices.length > 0 ? alertingDevices.map(({ device, status }) => (
                <div key={device.deviceId} className="p-3 bg-white border border-outline-variant/30 rounded-xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status.label === 'Expired' ? 'bg-error/10 text-error' : 'bg-amber-50 text-amber-600'}`}>
                      {status.icon}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary leading-none uppercase">{device.deviceId}</p>
                      <p className="text-[10px] text-secondary mt-1 tracking-tight truncate max-w-[120px]">{device.model}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border italic ${status.color}`}>
                      {status.days < 0 ? `Expired` : `${status.days}d rem.`}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center opacity-40">
                  <CheckCircle2 size={32} className="text-success mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">No Active Alerts</p>
                </div>
              )}
            </div>
            <button className="w-full py-3 border-t border-outline-variant text-[10px] font-black uppercase text-primary tracking-widest hover:bg-primary/5 transition-all">Audit Warranty Fleet</button>
          </div>

          <section className="bg-white rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="bg-surface-container-low px-6 py-4 border-b border-outline-variant flex items-center gap-3">
              <Laptop className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-primary">Fleet Distribution</h4>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 pb-6 border-b border-outline-variant/30">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{laptopCount}</p>
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-1">Laptops</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{pcCount}</p>
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-1">PC</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{serverCount}</p>
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-1">Servers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{unassignedCount}</p>
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-1">Unassigned</p>
                </div>
              </div>
              <div className="pt-6 space-y-2">
                <div className="flex justify-between text-xs font-bold text-secondary">
                  <span>Asset Availability</span>
                  <span className="text-primary font-mono text-sm uppercase">
                    {availabilityPercent}%
                  </span>
                </div>
                <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${availabilityPercent}%` }} className="h-full bg-primary"></motion.div>
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>
    </motion.div>
  );
}
