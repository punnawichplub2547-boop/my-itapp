"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Cpu,
  FileSpreadsheet,
  History,
  Laptop,
  Monitor,
  Package,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
  Wrench,
  X,
} from 'lucide-react';
import type { Device, DeviceRepairEvent, RepairTicket } from '../types';
import { getDeviceStatusBadgeColor, getDeviceStatusColor } from '../utils/status';
import { filterDevices } from '../lib/devices/filterDevices';
import {
  buildAssignmentHistory,
  buildConfirmedTicketEntries,
  buildDeviceEvents,
  buildInferredTicketEntries,
  buildPersistedRepairLogEntries,
  classifyRelatedTickets,
  deriveAssignmentIdentity,
  DEVICE_DETAIL_TABS,
  type DeviceDetailTabKey,
  type MatchConfidence,
  formatDateValue,
  getDeviceDetailHeroSubtitle,
  getDeviceDetailHeroTitle,
  getWarrantySnapshot,
} from './inventoryDetail';

export const DEVICE_STATUS_OPTIONS: Device['status'][] = ['Active', 'Inactive', 'Out of Service'];
export const DEVICE_PAGE_SIZE = 10;

export function upsertDevice(devices: Device[], nextDevice: Device) {
  const index = devices.findIndex((device) => device.deviceId === nextDevice.deviceId);

  if (index === -1) {
    return [...devices, nextDevice];
  }

  return devices.map((device) =>
    device.deviceId === nextDevice.deviceId ? nextDevice : device
  );
}

export function updateDeviceStatus(
  devices: Device[],
  deviceId: string,
  status: Device['status']
) {
  return devices.map((device) =>
    device.deviceId === deviceId ? { ...device, status } : device
  );
}

export function updateDeviceAssignment(devices: Device[], deviceId: string, assignedTo: string) {
  return devices.map((device) =>
    device.deviceId === deviceId ? { ...device, assignedTo } : device
  );
}

export function paginateDevices(devices: Device[], page: number, pageSize = DEVICE_PAGE_SIZE) {
  const safePage = Math.max(1, page);
  const startIndex = (safePage - 1) * pageSize;
  return devices.slice(startIndex, startIndex + pageSize);
}

export function clampInventoryPage(page: number, totalPages: number) {
  if (totalPages <= 0) {
    return 1;
  }

  return Math.min(Math.max(1, page), totalPages);
}

export default function Inventory({
  devices = [],
  tickets = [],
  onDevicesChange,
  initialSearchQuery = '',
  initialSelectedDeviceId,
}: {
  devices?: Device[];
  tickets?: RepairTicket[];
  onDevicesChange?: (devices: Device[]) => void;
  initialSearchQuery?: string;
  initialSelectedDeviceId?: string;
}) {
  const [internalDevices, setInternalDevices] = useState(devices);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    initialSelectedDeviceId ?? null
  );
  const [targetDeviceId, setTargetDeviceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('All');
  const [osFilter, setOsFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [inventoryError, setInventoryError] = useState('');

  const currentDevices = onDevicesChange ? devices : internalDevices;

  function setDevices(updater: Device[] | ((items: Device[]) => Device[])) {
    const nextDevices =
      typeof updater === 'function'
        ? (updater as (items: Device[]) => Device[])(currentDevices)
        : updater;

    if (onDevicesChange) {
      onDevicesChange(nextDevices);
      return;
    }

    setInternalDevices(nextDevices);
  }

  const departmentOptions = useMemo(
    () => ['All', ...Array.from(new Set(currentDevices.map((device) => device.department || '')))],
    [currentDevices]
  );
  const deviceTypeOptions = useMemo(
    () => ['All', ...Array.from(new Set(currentDevices.map((device) => device.deviceType)))],
    [currentDevices]
  );
  const osOptions = useMemo(
    () => ['All', ...Array.from(new Set(currentDevices.map((device) => device.os || '')))],
    [currentDevices]
  );

  const filteredDevices = filterDevices(currentDevices, {
    search: searchQuery,
    department: departmentFilter,
    deviceType: deviceTypeFilter,
    os: osFilter,
  });

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / DEVICE_PAGE_SIZE));
  const visiblePage = clampInventoryPage(currentPage, totalPages);
  const paginatedDevices = paginateDevices(filteredDevices, visiblePage, DEVICE_PAGE_SIZE);
  const firstVisibleItem = filteredDevices.length === 0 ? 0 : (visiblePage - 1) * DEVICE_PAGE_SIZE + 1;
  const lastVisibleItem = filteredDevices.length === 0
    ? 0
    : Math.min(visiblePage * DEVICE_PAGE_SIZE, filteredDevices.length);

  const selectedDevice =
    currentDevices.find((device) => device.deviceId === selectedDeviceId) ?? null;
  const targetDevice =
    currentDevices.find((device) => device.deviceId === targetDeviceId) ?? null;

  async function saveStatus(deviceId: string, status: Device['status']) {
    setInventoryError('');

    try {
      const response = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        setInventoryError(result.error ?? 'Unable to update device status.');
        return;
      }

      setDevices((items) =>
        items.map((device) =>
          device.deviceId === deviceId ? result.device ?? { ...device, status } : device
        )
      );
    } catch {
      setInventoryError('Unable to reach the device database API.');
    }
  }

  async function saveAssignment(deviceId: string, assignedTo: string) {
    setInventoryError('');

    try {
      const response = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignedTo }),
      });
      const result = await response.json();

      if (!response.ok) {
        setInventoryError(result.error ?? 'Unable to update device assignment.');
        return false;
      }

      setDevices((items) =>
        items.map((device) =>
          device.deviceId === deviceId
            ? result.device ?? { ...device, assignedTo }
            : device
        )
      );

      return true;
    } catch {
      setInventoryError('Unable to reach the device database API.');
      return false;
    }
  }

  async function deleteDevice(deviceId: string) {
    setInventoryError('');

    const response = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? 'Unable to delete the device.');
    }

    setDevices((items) => items.filter((device) => device.deviceId !== deviceId));
    setSelectedDeviceId(null);
  }

  const [isExporting, setIsExporting] = useState(false);

  async function handleExportExcel() {
    if (isExporting) return;
    setInventoryError('');
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (departmentFilter !== 'All') params.set('department', departmentFilter);
      if (deviceTypeFilter !== 'All') params.set('deviceType', deviceTypeFilter);
      if (osFilter !== 'All') params.set('os', osFilter);

      const queryString = params.toString();
      const response = await fetch(
        `/api/devices/export${queryString ? `?${queryString}` : ''}`
      );

      if (!response.ok) {
        let message = 'Failed to export inventory.';
        try {
          const data = await response.json() as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // non-JSON error body
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `device-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setInventoryError(err instanceof Error ? err.message : 'Failed to export inventory.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full flex-col space-y-8">
      <div className="flex items-end justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary">IT Asset Inventory</h2>
          <p className="font-medium text-secondary">MySQL-backed fleet records from the shared device API.</p>
        </div>
        <button
          onClick={() => { void handleExportExcel(); }}
          disabled={filteredDevices.length === 0 || isExporting}
          className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-5 py-3 text-[11px] font-black uppercase tracking-widest text-primary shadow-sm transition-all hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet className="h-4 w-4" /> {isExporting ? 'Exporting…' : 'Export Report'}
        </button>
      </div>

      <section className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm shrink-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="relative block lg:flex-[2]">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Device ID, asset no, IP, model, user logon..."
              className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-3 pl-12 pr-4 text-sm font-medium outline-none transition-all focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex-[3] lg:grid-cols-3">
            <FilterSelect
              label="Department"
              value={departmentFilter}
              options={departmentOptions}
              onChange={(value) => {
                setDepartmentFilter(value);
                setCurrentPage(1);
              }}
            />
            <FilterSelect
              label="Device Type"
              value={deviceTypeFilter}
              options={deviceTypeOptions}
              onChange={(value) => {
                setDeviceTypeFilter(value);
                setCurrentPage(1);
              }}
            />
            <FilterSelect
              label="Operating System"
              value={osFilter}
              options={osOptions}
              onChange={(value) => {
                setOsFilter(value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
        {inventoryError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-xs font-bold text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{inventoryError}</span>
          </div>
        )}
      </section>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-outline-variant bg-white shadow-lg">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-[1050px] w-full table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-outline-variant bg-surface-container-low text-[10px] font-black uppercase tracking-[0.2em] text-primary shadow-sm">
              <tr>
                <th className="w-36 px-6 py-5">Device ID</th>
                <th className="w-40 px-6 py-5">Department</th>
                <th className="w-44 px-6 py-5">User Log On</th>
                <th className="w-40 px-6 py-5">Device Type</th>
                <th className="w-48 px-6 py-5">Operating System</th>
                <th className="sticky right-0 w-32 border-l border-outline-variant/30 bg-surface-container-low px-8 py-5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-sm">
              {paginatedDevices.map((device) => (
                <tr
                  key={device.deviceId}
                  className="group cursor-pointer transition-all hover:bg-primary/[0.02]"
                  onClick={() => setSelectedDeviceId(device.deviceId)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${getDeviceStatusColor(device.status)}`}
                        title={device.status}
                      />
                      <span className="font-mono font-black tracking-tight text-primary">
                        {device.deviceId}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-[10px] font-black uppercase leading-none tracking-widest text-secondary">
                      {device.department || 'Unspecified'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {device.assignedTo ? (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/10 text-[11px] font-black uppercase text-primary">
                          {getAssignmentInitials(device.assignedTo)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-primary">{device.assignedTo}</p>
                          <p className="truncate text-[10px] font-medium text-outline">
                            {deriveAssignmentIdentity(device.assignedTo)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-outline/50">
                        <UserX className="h-4 w-4" />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          Unassigned
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-bold text-secondary">
                      {renderDeviceTypeIcon(device.deviceType)}
                      <span className="text-xs uppercase tracking-tight">{device.deviceType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium italic text-secondary">{device.os || '-'}</td>
                  <td
                    className="sticky right-0 border-l border-outline-variant/30 bg-white px-8 py-4 text-right group-hover:bg-primary/[0.02]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setTargetDeviceId(device.deviceId);
                        setIsAssignModalOpen(true);
                      }}
                      className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-2.5 text-primary shadow-sm transition-all hover:bg-primary/10"
                      title="Assign / Change User"
                    >
                      <UserPlus size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedDevices.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-8 py-16 text-center text-[11px] font-black uppercase tracking-[0.2em] text-outline"
                  >
                    No devices matched the current inventory filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-8 py-4 shrink-0">
          <div className="flex items-center gap-8">
            {DEVICE_STATUS_OPTIONS.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${getDeviceStatusColor(status)}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                  {status}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-outline">
              Showing {firstVisibleItem}-{lastVisibleItem} of {filteredDevices.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => clampInventoryPage(page - 1, totalPages))}
                disabled={visiblePage === 1}
                className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="min-w-24 text-center text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                Page {visiblePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => clampInventoryPage(page + 1, totalPages))}
                disabled={visiblePage === totalPages}
                className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedDevice && (
          <DeviceDetailModal
            key={selectedDevice.deviceId}
            device={selectedDevice}
            tickets={tickets}
            onClose={() => setSelectedDeviceId(null)}
            onEditAssignment={(deviceId) => {
              setSelectedDeviceId(null);
              setTargetDeviceId(deviceId);
              setIsAssignModalOpen(true);
            }}
            onSaveStatus={saveStatus}
            onDeleteDevice={deleteDevice}
          />
        )}
        {isAssignModalOpen && targetDevice && (
          <AssignmentModal
            key={targetDevice.deviceId}
            device={targetDevice}
            onClose={() => {
              setIsAssignModalOpen(false);
              setTargetDeviceId(null);
            }}
            onSaveAssignment={async (deviceId, assignedTo) => {
              const didSave = await saveAssignment(deviceId, assignedTo);

              if (didSave) {
                setIsAssignModalOpen(false);
                setTargetDeviceId(null);
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="pl-1 text-[9px] font-black uppercase tracking-[0.18em] text-secondary">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-xs font-bold text-primary outline-none transition-all focus:border-primary"
      >
        {options.map((option) => (
          <option key={option || 'blank'} value={option}>
            {option || 'Blank'}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DeviceDetailModal({
  device,
  tickets = [],
  onClose,
  onEditAssignment,
  onSaveStatus,
  onDeleteDevice,
}: {
  device: Device;
  tickets?: RepairTicket[];
  onClose: () => void;
  onEditAssignment: (deviceId: string) => void;
  onSaveStatus: (deviceId: string, status: Device['status']) => Promise<void>;
  onDeleteDevice: (deviceId: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<DeviceDetailTabKey>('hardware-os');
  const [draftStatus, setDraftStatus] = useState<Device['status']>(device.status);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showWeakMatches, setShowWeakMatches] = useState(false);
  const [persistedRepairEvents, setPersistedRepairEvents] = useState<DeviceRepairEvent[]>([]);

  useEffect(() => {
    void fetch(`/api/devices/${encodeURIComponent(device.deviceId)}/repair-events`)
      .then(async (r) => {
        if (!r.ok) return [];
        const data = (await r.json()) as { events?: unknown };
        return Array.isArray(data.events) ? (data.events as DeviceRepairEvent[]) : [];
      })
      .then(setPersistedRepairEvents)
      .catch(() => setPersistedRepairEvents([]));
  }, [device.deviceId]);

  const warrantySnapshot = getWarrantySnapshot(device);
  const assignmentHistory = buildAssignmentHistory(device);
  const deviceEvents = buildDeviceEvents(device);

  // Tickets that already have a persistent event are shown via persistedEntries, not live data.
  const persistedTicketIds = new Set(
    persistedRepairEvents.map((e) => e.ticketId).filter((id): id is string => Boolean(id))
  );
  const liveConfirmedEntries = buildConfirmedTicketEntries(
    device,
    tickets.filter((t) => !persistedTicketIds.has(t.id))
  );
  const persistedEntries = buildPersistedRepairLogEntries(persistedRepairEvents);

  const classifiedTickets = classifyRelatedTickets(device, tickets);
  const strongMatches = classifiedTickets.filter((m) => m.matchConfidence !== 'low');
  const weakMatches = classifiedTickets.filter((m) => m.matchConfidence === 'low');
  const visibleInferredEntries = buildInferredTicketEntries(strongMatches);
  const weakInferredEntries = buildInferredTicketEntries(weakMatches);

  async function handleSave() {
    setIsSaving(true);

    try {
      await onSaveStatus(device.deviceId, draftStatus);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError('');

    try {
      await onDeleteDevice(device.deviceId);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete the device right now.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative flex h-[min(92vh,920px)] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-[#f7f9fc] shadow-2xl"
      >
        <div className="border-b border-slate-200 bg-[#eaf0fb] px-6 py-5 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#aebedc] bg-[#dbe5f6] text-primary">
                <Monitor className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="truncate text-4xl font-black tracking-tight text-primary">
                    {getDeviceDetailHeroTitle(device)}
                  </h3>
                  <span
                    className={`inline-flex rounded-xl border px-3 py-1 text-xs font-black uppercase tracking-widest ${getDeviceStatusBadgeColor(device.status)}`}
                  >
                    {device.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black uppercase tracking-[0.22em] text-slate-500">
                  {getDeviceDetailHeroSubtitle(device)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-3 text-slate-500 transition-all hover:bg-white/70 hover:text-primary"
            >
              <X className="h-7 w-7" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex flex-wrap gap-2">
            {DEVICE_DETAIL_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon =
                tab.key === 'hardware-os'
                  ? Cpu
                  : tab.key === 'warranty-lifecycle'
                    ? ShieldCheck
                    : tab.key === 'assignment-history'
                      ? History
                      : Wrench;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`border-b-4 px-3 py-4 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-700 hover:text-primary'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <TabIcon className="h-4 w-4" />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {activeTab === 'hardware-os' && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="space-y-10">
                  <div>
                    <div className="mb-6 flex items-center gap-3 text-primary">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <h4 className="text-lg font-black uppercase tracking-[0.22em]">Compute & Hardware</h4>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <HardwareMetric label="Processor (CPU)" value={device.cpu || 'Not recorded'} />
                      <HardwareMetric label="Memory (RAM)" value={device.ram || 'Not recorded'} />
                      <HardwareMetric label="Storage (HDD/SSD)" value={device.hdd || 'Not recorded'} />
                      <HardwareMetric label="Device Type" value={device.deviceType || 'Unknown'} />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-10">
                    <div className="mb-6 flex items-center gap-3 text-primary">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <h4 className="text-lg font-black uppercase tracking-[0.22em]">Software Environment</h4>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <HardwareMetric label="Operating System" value={device.os || 'Not recorded'} />
                      <HardwareMetric label="OS License / Key" value={device.osLicense || 'Not recorded'} />
                      <HardwareMetric label="Microsoft Office" value={device.msOfficeVersion || 'Not recorded'} />
                      <HardwareMetric label="IP Addressing" value={device.ipAddress || device.ipMode} />
                    </div>
                  </div>
                </div>
              </section>

              <div className="space-y-6">
                <section className="rounded-[2rem] border border-[#b8c8e6] bg-[#eef3fb] p-8 shadow-sm">
                  <div className="mb-6 flex items-center gap-3 text-primary">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h4 className="text-lg font-black uppercase tracking-[0.22em]">Current Asset Custody</h4>
                  </div>
                  <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#eef2fa] text-2xl font-black text-primary">
                        {getAssignmentInitials(device.assignedTo || device.department || device.deviceId)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-2xl font-black text-primary">
                          {device.assignedTo || 'Unassigned'}
                        </p>
                        <p className="truncate text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                          {device.assignedTo ? deriveAssignmentIdentity(device.assignedTo) : 'No active custodian'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <InfoCard label="Department" value={device.department || 'Unspecified'} />
                    <InfoCard
                      label="Assignment Date"
                      value={formatDateValue(device.updatedAt || device.createdAt || device.installDate)}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onEditAssignment(device.deviceId)}
                      className="rounded-2xl border border-outline-variant bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-primary transition-all hover:border-primary"
                    >
                      Change User
                    </button>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Device Status
                      </label>
                      <select
                        value={draftStatus}
                        onChange={(event) => setDraftStatus(event.target.value as Device['status'])}
                        className="rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-bold text-primary outline-none transition-all focus:border-primary"
                      >
                        {DEVICE_STATUS_OPTIONS.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSave}
                        className="rounded-xl bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary-container disabled:opacity-70"
                      >
                        {isSaving ? 'Saving' : 'Save Status'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    {!isDeleteConfirming ? (
                      <button
                        type="button"
                        onClick={() => setIsDeleteConfirming(true)}
                        className="flex items-center gap-2 rounded-2xl border border-[#f0c1c1] bg-[#fff5f5] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#cf1f1f] transition-all hover:border-[#cf1f1f]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Device
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-[#f0c1c1] bg-[#fff5f5] p-5">
                        <p className="text-sm font-bold text-[#8b1212]">
                          Delete <span className="font-mono">{device.deviceId}</span>? This action cannot be undone.
                        </p>
                        {deleteError && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#cf1f1f]">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {deleteError}
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={handleDelete}
                            className="rounded-xl bg-[#cf1f1f] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-[#a81818] disabled:opacity-70"
                          >
                            {isDeleting ? 'Deleting…' : 'Yes, Delete'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => { setIsDeleteConfirming(false); setDeleteError(''); }}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-primary transition-all hover:border-primary disabled:opacity-70"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-[#eef2fa] p-3 text-primary">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Purchase Info
                        </p>
                        <p className="text-base font-black italic text-primary">
                          {device.yearValue || 'Lifecycle record not stored'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                      Warranty {device.warranty || 'N/A'}
                    </span>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'warranty-lifecycle' && (
            <div className="space-y-6">
              <section
                className={`mx-auto max-w-5xl rounded-[2rem] border p-10 text-center shadow-sm ${
                  warrantySnapshot.status === 'expired'
                    ? 'border-[#f0c1c1] bg-[#fff5f5]'
                    : warrantySnapshot.status === 'expiring-soon'
                      ? 'border-[#f2d6a6] bg-[#fff8ee]'
                    : warrantySnapshot.status === 'active'
                      ? 'border-[#c7ead3] bg-[#f3fff7]'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div
                  className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] text-white shadow-lg ${
                    warrantySnapshot.status === 'expired'
                      ? 'bg-[#cf1f1f]'
                      : warrantySnapshot.status === 'expiring-soon'
                        ? 'bg-[#d98a00]'
                      : warrantySnapshot.status === 'active'
                        ? 'bg-[#0a8f47]'
                        : 'bg-slate-500'
                  }`}
                >
                  <ShieldCheck className="h-12 w-12" />
                </div>
                <h4 className="text-4xl font-black uppercase tracking-tight text-primary">
                  {warrantySnapshot.headline}
                </h4>
                <p className="mx-auto mt-4 max-w-2xl text-xl font-medium italic text-slate-500">
                  {warrantySnapshot.detail}
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
                  <InfoCard label="Expiration" value={warrantySnapshot.expirationText} compact />
                  <InfoCard label="Days Remaining" value={warrantySnapshot.daysRemainingText} compact />
                  <InfoCard label="Warranty Term" value={device.warranty || 'Not recorded'} compact />
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-3">
                <InfoCard label="Install Date" value={formatDateValue(device.installDate)} />
                <InfoCard label="Expiry" value={warrantySnapshot.expirationText} />
                <InfoCard label="Warranty Term" value={device.warranty || 'Not recorded'} />
              </div>
            </div>
          )}

          {activeTab === 'assignment-history' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-4xl font-black tracking-tight text-primary">Current Assignment</h4>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Full assignment history is not available yet. This section shows the current assignment from the device record.
                </p>
              </div>
              <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-[1.3fr_1.4fr_0.9fr_1fr_0.8fr] gap-4 border-b border-slate-200 bg-[#eef3fb] px-8 py-5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <span>Asset User</span>
                  <span>Department / Cost Center</span>
                  <span>Assigned On</span>
                  <span>Returned On</span>
                  <span className="text-right">Status</span>
                </div>
                {assignmentHistory.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1.3fr_1.4fr_0.9fr_1fr_0.8fr] gap-4 px-8 py-7 text-sm"
                  >
                    <div>
                      <p className="text-2xl font-black text-primary">{row.assetUser}</p>
                      <p className="text-sm font-bold italic text-slate-500">{row.assetUserMeta}</p>
                    </div>
                    <p className="self-center text-lg font-black uppercase tracking-[0.14em] text-slate-600">
                      {row.department}
                    </p>
                    <p className="self-center text-lg font-medium text-primary">{row.assignedOn}</p>
                    <p className="self-center text-lg font-black uppercase tracking-[0.18em] text-primary">
                      {row.returnedOn}
                    </p>
                    <div className="flex items-center justify-end">
                      <span className="rounded-xl border border-[#a4e0b3] bg-[#ebfff0] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#0a8f47]">
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}

          {activeTab === 'repair-log' && (
            <div className="space-y-8">
              <div>
                <h4 className="text-4xl font-black tracking-tight text-primary">Maintenance & Engineering Events</h4>
              </div>

              {/* ── Section A: Device Events ──────────────────────────────── */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <h5 className="text-lg font-black uppercase tracking-[0.18em] text-primary">Device Events</h5>
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Confirmed records specific to this asset — device notes and repair tickets created directly for this device.
                </p>
                {deviceEvents.length === 0 && persistedEntries.length === 0 && liveConfirmedEntries.length === 0 ? (
                  <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-8 py-12 text-center shadow-sm">
                    <p className="text-base font-black uppercase tracking-[0.18em] text-slate-500">
                      No device events recorded
                    </p>
                    <p className="mt-2 text-sm font-medium italic text-slate-400">
                      Add a note to this device record, or create a repair ticket for this device to surface entries here.
                    </p>
                  </section>
                ) : (
                  <>
                    {deviceEvents.map((entry) => (
                      <RepairLogCard key={entry.id} entry={entry} />
                    ))}
                    {persistedEntries.map((entry) => (
                      <RepairLogCard key={entry.id} entry={entry} />
                    ))}
                    {liveConfirmedEntries.map((entry) => (
                      <RepairLogCard key={entry.id} entry={entry} />
                    ))}
                  </>
                )}
              </div>

              {/* ── Section B: Possible Related Tickets ───────────────────── */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <h5 className="text-lg font-black uppercase tracking-[0.18em] text-primary">Possible Related Tickets</h5>
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Tickets matched by device model name — may include tickets from other assets with the same model.
                  Tickets created for this specific device appear in Device Events above.
                </p>
                {visibleInferredEntries.length === 0 && weakInferredEntries.length === 0 ? (
                  <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-8 py-12 text-center shadow-sm">
                    <p className="text-base font-black uppercase tracking-[0.18em] text-slate-500">
                      No matching tickets found
                    </p>
                    <p className="mt-2 text-sm font-medium italic text-slate-400">
                      No tickets matched this device model name.
                    </p>
                  </section>
                ) : (
                  <>
                    {visibleInferredEntries.map((entry) => (
                      <RepairLogCard key={entry.id} entry={entry} />
                    ))}
                    {weakMatches.length > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setShowWeakMatches((v) => !v)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 shadow-sm transition-all hover:border-slate-400 hover:text-primary"
                        >
                          {showWeakMatches ? 'Hide' : 'Show'} weak matches ({weakMatches.length})
                          <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                            model-only
                          </span>
                        </button>
                        {showWeakMatches && weakInferredEntries.map((entry) => (
                          <div key={entry.id} className="mt-4">
                            <RepairLogCard entry={entry} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function confidenceBadgeProps(confidence: MatchConfidence): { label: string; className: string } {
  if (confidence === 'high') {
    return {
      label: 'Strong match',
      className: 'border-green-300 bg-green-50 text-green-700',
    };
  }
  if (confidence === 'medium') {
    return {
      label: 'Model + department match',
      className: 'border-amber-300 bg-amber-50 text-amber-700',
    };
  }
  return {
    label: 'Weak model-only match',
    className: 'border-slate-300 bg-slate-100 text-slate-600',
  };
}

function RepairLogCard({ entry }: { entry: import('./inventoryDetail').RepairLogEntry }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white px-7 py-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-5">
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-500">
            <Wrench className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h5 className="text-2xl font-black text-primary">{entry.title}</h5>
            <p className="text-lg font-black uppercase tracking-[0.14em] text-slate-700">
              Event ID: {entry.eventId}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {entry.matchConfidence && (() => {
            const { label, className } = confidenceBadgeProps(entry.matchConfidence);
            return (
              <span className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${className}`}>
                {label}
              </span>
            );
          })()}
          <span className="rounded-xl border border-[#a4e0b3] bg-[#ebfff0] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#0a8f47]">
            {entry.status}
          </span>
        </div>
      </div>
      <div className="mt-5 rounded-[1.6rem] bg-[#eef3fb] px-6 py-6 text-lg font-medium italic leading-8 text-slate-600">
        {entry.detail}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-8 text-[13px] font-black uppercase tracking-[0.16em] text-primary">
        <span>{entry.timestamp}</span>
        <span>Technician: {entry.technician}</span>
      </div>
    </section>
  );
}

function HardwareMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black italic tracking-tight text-primary">{value}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[1.4rem] border border-slate-200 bg-white shadow-sm ${
        compact ? 'min-w-[160px] px-5 py-5 text-left' : 'px-5 py-5'
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black italic tracking-tight text-primary">{value}</p>
    </div>
  );
}

function AssignmentModal({
  device,
  onClose,
  onSaveAssignment,
}: {
  device: Device;
  onClose: () => void;
  onSaveAssignment: (deviceId: string, assignedTo: string) => Promise<void>;
}) {
  const [draftAssignedTo, setDraftAssignedTo] = useState(device.assignedTo);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);

    try {
      await onSaveAssignment(device.deviceId, draftAssignedTo.trim());
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md rounded-3xl border border-outline-variant bg-white p-8 shadow-2xl"
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus size={32} />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-primary">Assign Device User</h3>
            <div className="mt-2 inline-block rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest text-outline">
              Device: {device.deviceId}
            </div>
          </div>

          <label className="space-y-1.5">
            <span className="pl-1 text-[10px] font-black uppercase tracking-widest text-secondary">
              User Log On
            </span>
            <input
              value={draftAssignedTo}
              onChange={(event) => setDraftAssignedTo(event.target.value)}
              placeholder="e.g. chakrit"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm font-bold text-primary outline-none transition-all focus:border-primary"
            />
          </label>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-container disabled:opacity-70"
            >
              {isSaving ? 'Saving' : 'Save Assignment'}
            </button>
            <button
              onClick={() => setDraftAssignedTo('')}
              type="button"
              className="w-full rounded-xl border border-outline-variant px-6 py-3 text-[10px] font-black uppercase tracking-widest text-secondary transition-all hover:border-primary hover:text-primary"
            >
              Clear Assignment
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-outline transition-all hover:text-primary"
          >
            Cancel Operation
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function getAssignmentInitials(assignedTo: string) {
  const trimmed = assignedTo.trim();

  if (!trimmed) {
    return '--';
  }

  return trimmed
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function renderDeviceTypeIcon(deviceType: Device['deviceType']) {
  if (deviceType === 'Server') {
    return <Server size={14} />;
  }

  if (deviceType === 'PC' || deviceType === 'Desktop') {
    return <Cpu size={14} />;
  }

  return <Laptop size={14} />;
}
