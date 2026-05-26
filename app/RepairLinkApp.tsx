"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { LayoutDashboard, Package, BarChart, PlusCircle, Search, ShieldCheck, LogOut, PlusSquare, History, Clock, Laptop, Ticket } from 'lucide-react';
import { Device, RepairTicket, ViewType } from './types';
import NavItem from './components/NavItem';
import LoginView from './views/LoginView';
import Dashboard from './views/Dashboard';
import Inventory, { upsertDevice } from './views/Inventory';
import TicketManagementCenter from './views/TicketManagementCenter';
import ReportsView from './views/ReportsView';
import CreateRequestForm from './views/CreateRequestForm';
import AddDeviceForm from './views/AddDeviceForm';
import WarrantyAuditView from './views/WarrantyAuditView';
import {
  AppSearchResult,
  AppSearchResultType,
  buildAppSearchGroups,
  flattenAppSearchGroups,
} from './lib/search/appSearch';

const VIEW_TO_PATH: Record<ViewType, string> = {
  dashboard: '/dashboard',
  'create-request': '/dashboard/create-repair-request',
  tickets: '/dashboard/repair-status',
  inventory: '/dashboard/device-inventory',
  'add-device': '/dashboard/add-new-device',
  reports: '/dashboard/reports',
  'warranty-audit': '/dashboard/warranty-audit',
  login: '/',
};

export default function App({
  initialView = 'login',
  initialTicketId,
  initialSearchQuery = '',
  initialDeviceId,
}: {
  initialView?: ViewType;
  initialTicketId?: string;
  initialSearchQuery?: string;
  initialDeviceId?: string;
}) {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [isSidebarOpen] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId ?? null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [shellSearchQuery, setShellSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const searchGroups = useMemo(
    () => buildAppSearchGroups(shellSearchQuery, devices, tickets),
    [shellSearchQuery, devices, tickets]
  );
  const flatSearchResults = useMemo(
    () => flattenAppSearchGroups(searchGroups),
    [searchGroups]
  );
  const topSearchResult = flatSearchResults[0] ?? null;
  const trimmedShellSearchQuery = shellSearchQuery.trim();
  const showSearchDropdown = isSearchOpen && trimmedShellSearchQuery.length > 0;

  function handleTicketCreated(ticket: RepairTicket) {
    setTickets((current) => [ticket, ...current]);
    router.push(VIEW_TO_PATH.tickets);
  }

  function handleTicketUpdated(ticket: RepairTicket) {
    setTickets((current) => current.map((t) => (t.id === ticket.id ? ticket : t)));
  }

  function handleTicketDeleted(ticketId: string) {
    setTickets((current) => current.filter((t) => t.id !== ticketId));
    setSelectedTicketId(null);
  }

  if (currentView === 'login') return <LoginView onLogin={() => router.push(VIEW_TO_PATH.dashboard)} />;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentView('login');
    router.replace('/');
    router.refresh();
  }

  function buildSearchHref(resultType: AppSearchResultType, identifier: string) {
    if (resultType === 'ticket') {
      return `/dashboard/repair-status?ticket=${encodeURIComponent(identifier)}&q=${encodeURIComponent(identifier)}`;
    }

    return `/dashboard/device-inventory?device=${encodeURIComponent(identifier)}&q=${encodeURIComponent(identifier)}`;
  }

  function navigateToSearchResult(result: AppSearchResult) {
    const identifier = result.ticketId ?? result.deviceId;

    if (!identifier) {
      return;
    }

    if (result.type === 'ticket') {
      setCurrentView('tickets');
      setSelectedTicketId(identifier);
    } else {
      setCurrentView('inventory');
    }

    setShellSearchQuery('');
    setIsSearchOpen(false);
    router.push(buildSearchHref(result.type, identifier));
  }

  function handleSearchSubmit() {
    if (topSearchResult) {
      navigateToSearchResult(topSearchResult);
    }
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
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => router.push(VIEW_TO_PATH.dashboard)} collapsed={!isSidebarOpen} />
          <NavItem icon={<PlusSquare />} label="Create Repair Request" active={currentView === 'create-request'} onClick={() => router.push(VIEW_TO_PATH['create-request'])} collapsed={!isSidebarOpen} />
          <NavItem icon={<History />} label="Repair Status" active={currentView === 'tickets'} onClick={() => router.push(VIEW_TO_PATH.tickets)} collapsed={!isSidebarOpen} />
          <NavItem icon={<Package />} label="Device Inventory" active={currentView === 'inventory'} onClick={() => router.push(VIEW_TO_PATH.inventory)} collapsed={!isSidebarOpen} />
          <NavItem icon={<PlusCircle />} label="Add New Device" active={currentView === 'add-device'} onClick={() => router.push(VIEW_TO_PATH['add-device'])} collapsed={!isSidebarOpen} />
          <NavItem icon={<BarChart />} label="Reports" active={currentView === 'reports'} onClick={() => router.push(VIEW_TO_PATH.reports)} collapsed={!isSidebarOpen} />
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
            <div ref={searchContainerRef} className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                value={shellSearchQuery}
                onChange={(event) => {
                  setShellSearchQuery(event.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSearchSubmit();
                  }

                  if (event.key === 'Escape') {
                    setIsSearchOpen(false);
                  }
                }}
                placeholder="Search devices, requests, or warranties..."
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm outline-none focus:border-primary transition-all"
              />
              {showSearchDropdown && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-xl">
                  {flatSearchResults.length > 0 ? (
                    <div className="max-h-[28rem] overflow-y-auto custom-scrollbar py-2">
                      <SearchResultGroup
                        label="Devices"
                        results={searchGroups.devices}
                        onSelect={navigateToSearchResult}
                      />
                      <SearchResultGroup
                        label="Tickets"
                        results={searchGroups.tickets}
                        onSelect={navigateToSearchResult}
                      />
                      <SearchResultGroup
                        label="Warranty"
                        results={searchGroups.warranties}
                        onSelect={navigateToSearchResult}
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm font-bold text-primary">No results found</p>
                      <p className="mt-1 text-xs text-secondary">
                        Try a device name, ticket number, model, employee, or warranty status.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-outline-variant">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-primary">Admin User</p>
                <p className="text-[10px] text-secondary uppercase font-semibold">Global Administrator</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-sm font-black text-white shadow-sm">
                A
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              {currentView === 'dashboard' && (
                <Dashboard
                  key="dashboard"
                  devices={devices}
                  tickets={tickets}
                  onTicketClick={(id) => router.push(`${VIEW_TO_PATH.tickets}?ticket=${id}`)}
                  onOpenWarrantyAudit={() => router.push(VIEW_TO_PATH['warranty-audit'])}
                  onViewAllTickets={() => router.push(VIEW_TO_PATH.tickets)}
                />
              )}
              {currentView === 'warranty-audit' && (
                <WarrantyAuditView
                  key="warranty-audit"
                  devices={devices}
                  onBack={() => router.push(VIEW_TO_PATH.dashboard)}
                  onOpenDevice={(deviceId) =>
                    router.push(`/dashboard/device-inventory?device=${encodeURIComponent(deviceId)}&q=${encodeURIComponent(deviceId)}`)
                  }
                />
              )}
              {currentView === 'inventory' && (
                <Inventory
                  key={`inventory:${initialSearchQuery}:${initialDeviceId ?? ''}`}
                  devices={devices}
                  tickets={tickets}
                  onDevicesChange={setDevices}
                  initialSearchQuery={initialSearchQuery}
                  initialSelectedDeviceId={initialDeviceId}
                />
              )}
              {currentView === 'tickets' && (
                <TicketManagementCenter
                  key={`tickets:${initialSearchQuery}:${initialTicketId ?? ''}`}
                  tickets={tickets}
                  selectedId={selectedTicketId}
                  onSelectTicket={setSelectedTicketId}
                  onTicketUpdated={handleTicketUpdated}
                  onTicketDeleted={handleTicketDeleted}
                  initialSearchQuery={initialSearchQuery}
                />
              )}
              {currentView === 'reports' && <ReportsView key="reports" />}
              {currentView === 'create-request' && (
                <CreateRequestForm
                  key="create-request"
                  devices={devices}
                  tickets={tickets}
                  onBack={() => router.push(VIEW_TO_PATH.dashboard)}
                  onTicketCreated={handleTicketCreated}
                />
              )}
              {currentView === 'add-device' && (
                <AddDeviceForm
                  key="add-device"
                  onBack={() => router.push(VIEW_TO_PATH.dashboard)}
                  onDeviceCreated={(device) => {
                    setDevices((currentDevices) => upsertDevice(currentDevices, device));
                    router.push(VIEW_TO_PATH.inventory);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="bg-surface-container-low px-8 py-3 border-t border-outline-variant text-[11px] text-secondary">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>&copy; 2024 RepairLink Enterprise Admin Console v2.5.0 | Created by Punnawich </span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function SearchResultGroup({
  label,
  results,
  onSelect,
}: {
  label: string;
  results: AppSearchResult[];
  onSelect: (result: AppSearchResult) => void;
}) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-outline-variant/40 last:border-b-0">
      <div className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-secondary">
        {label}
      </div>
      <div className="pb-2">
        {results.map((result) => (
          <button
            key={result.key}
            type="button"
            onClick={() => onSelect(result)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low"
          >
            <div className={`mt-0.5 rounded-lg p-2 ${getSearchResultIconStyle(result.type)}`}>
              {getSearchResultIcon(result.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-primary">{result.title}</p>
              <p className="truncate text-xs text-secondary">{result.subtitle}</p>
              <p className="truncate text-[11px] text-outline">{result.detail}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function getSearchResultIcon(type: AppSearchResultType) {
  if (type === 'ticket') {
    return <Ticket className="h-4 w-4" />;
  }

  if (type === 'warranty') {
    return <Clock className="h-4 w-4" />;
  }

  return <Laptop className="h-4 w-4" />;
}

function getSearchResultIconStyle(type: AppSearchResultType) {
  if (type === 'ticket') {
    return 'bg-blue-50 text-blue-700';
  }

  if (type === 'warranty') {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-primary/10 text-primary';
}
