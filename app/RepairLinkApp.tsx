"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { LayoutDashboard, Package, BarChart, PlusCircle, Search, ShieldCheck, LogOut, PlusSquare, History } from 'lucide-react';
import { Device, RepairTicket, ViewType } from './types';
import NavItem from './components/NavItem';
import LoginView from './views/LoginView';
import Dashboard from './views/Dashboard';
import Inventory, { upsertDevice } from './views/Inventory';
import TicketManagementCenter from './views/TicketManagementCenter';
import ReportsView from './views/ReportsView';
import CreateRequestForm from './views/CreateRequestForm';
import AddDeviceForm from './views/AddDeviceForm';

export default function App({ initialView = 'login' }: { initialView?: ViewType }) {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [isSidebarOpen] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDevices() {
      try {
        const response = await fetch('/api/devices');
        const result = await response.json();

        if (!response.ok || cancelled) {
          return;
        }

        setDevices(Array.isArray(result.devices) ? result.devices : []);
      } catch {
        if (!cancelled) {
          setDevices([]);
        }
      }
    }

    void loadDevices();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      try {
        const response = await fetch('/api/tickets');
        const result = await response.json();

        if (!response.ok || cancelled) {
          return;
        }

        setTickets(Array.isArray(result.tickets) ? result.tickets : []);
      } catch {
        if (!cancelled) {
          setTickets([]);
        }
      }
    }

    void loadTickets();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleTicketCreated(ticket: RepairTicket) {
    setTickets((current) => [ticket, ...current]);
    setCurrentView('tickets');
  }

  function handleTicketUpdated(ticket: RepairTicket) {
    setTickets((current) => current.map((t) => (t.id === ticket.id ? ticket : t)));
  }

  function handleTicketDeleted(ticketId: string) {
    setTickets((current) => current.filter((t) => t.id !== ticketId));
    setSelectedTicketId(null);
  }

  if (currentView === 'login') return <LoginView onLogin={() => setCurrentView('dashboard')} />;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentView('login');
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`bg-primary-container text-white transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'} z-50`}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-white/10 p-2 rounded-lg shrink-0">
              <Package className="w-6 h-6" />
            </div>
            {isSidebarOpen && (
              <div>
                <h1 className="font-bold text-lg leading-tight">RepairLink</h1>
                <p className="text-[10px] text-primary-fixed-dim/70 uppercase">Management Portal</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} collapsed={!isSidebarOpen} />
          <NavItem icon={<PlusSquare />} label="Create Repair Request" active={currentView === 'create-request'} onClick={() => setCurrentView('create-request')} collapsed={!isSidebarOpen} />
          <NavItem icon={<History />} label="Repair Status" active={currentView === 'tickets'} onClick={() => setCurrentView('tickets')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Package />} label="Device Inventory" active={currentView === 'inventory'} onClick={() => setCurrentView('inventory')} collapsed={!isSidebarOpen} />
          <NavItem icon={<PlusCircle />} label="Add New Device" active={currentView === 'add-device'} onClick={() => setCurrentView('add-device')} collapsed={!isSidebarOpen} />
          <NavItem icon={<BarChart />} label="Reports" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} collapsed={!isSidebarOpen} />
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-white/70 hover:bg-white/5 rounded-lg transition-colors overflow-hidden"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="text-sm font-medium">Log Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-outline-variant flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                placeholder="Search devices, requests, or warranties..."
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-outline-variant">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-primary">Admin User</p>
                <p className="text-[10px] text-secondary uppercase font-semibold">Global Administrator</p>
              </div>
              <Image
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop"
                alt="Profile"
                width={36}
                height={36}
                className="w-9 h-9 rounded-full border border-outline-variant shadow-sm"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              {currentView === 'dashboard' && <Dashboard onTicketClick={(id) => { setSelectedTicketId(id); setCurrentView('tickets'); }} key="dashboard" />}
              {currentView === 'inventory' && <Inventory key="inventory" devices={devices} onDevicesChange={setDevices} />}
              {currentView === 'tickets' && <TicketManagementCenter tickets={tickets} selectedId={selectedTicketId} onSelectTicket={setSelectedTicketId} onTicketUpdated={handleTicketUpdated} onTicketDeleted={handleTicketDeleted} key="tickets" />}
              {currentView === 'reports' && <ReportsView key="reports" />}
              {currentView === 'create-request' && (
                <CreateRequestForm
                  key="create-request"
                  devices={devices}
                  onBack={() => setCurrentView('dashboard')}
                  onTicketCreated={handleTicketCreated}
                />
              )}
              {currentView === 'add-device' && (
                <AddDeviceForm
                  key="add-device"
                  onBack={() => setCurrentView('dashboard')}
                  onDeviceCreated={(device) => {
                    setDevices((currentDevices) => upsertDevice(currentDevices, device));
                    setCurrentView('inventory');
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="bg-surface-container-low px-8 py-3 border-t border-outline-variant text-[11px] text-secondary flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>&copy; 2024 RepairLink Enterprise Admin Console v2.5.0</span>
          </div>
          <div className="flex gap-6 font-semibold uppercase tracking-wider">
            <a href="#" className="hover:text-primary transition-colors">System Status</a>
            <a href="#" className="hover:text-primary transition-colors">Compliance</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
