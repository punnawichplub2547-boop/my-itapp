import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Clock3, Laptop, Search, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Device } from '../types';
import { getWarrantyExpiryDate, getWarrantyLifecycle } from '../lib/devices/warrantyAlerts';

type AuditStatusFilter = 'all' | 'expired' | 'expiring-soon' | 'missing-date';
type WarrantyAuditStatus = Exclude<AuditStatusFilter, 'all'>;

interface WarrantyAuditRow {
  device: Device;
  status: WarrantyAuditStatus;
  expiryLabel: string;
  statusLabel: string;
  daysRemainingLabel: string;
  sortRank: number;
  searchText: string;
}

export default function WarrantyAuditView({
  devices,
  onBack,
  onOpenDevice,
}: {
  devices: Device[];
  onBack: () => void;
  onOpenDevice: (deviceId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>('all');

  const auditRows = useMemo(() => buildWarrantyAuditRows(devices), [devices]);
  const departmentOptions = useMemo(
    () => ['all', ...new Set(auditRows.map((row) => row.device.department.trim()).filter(Boolean))],
    [auditRows]
  );

  const filteredRows = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    return auditRows.filter((row) => {
      const matchesDepartment =
        departmentFilter === 'all' || row.device.department.trim() === departmentFilter;
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesSearch =
        trimmedQuery.length === 0 || row.searchText.includes(trimmedQuery);

      return matchesDepartment && matchesStatus && matchesSearch;
    });
  }, [auditRows, departmentFilter, searchQuery, statusFilter]);

  const flaggedCount = auditRows.filter((row) => row.status !== 'missing-date').length;
  const expiredCount = auditRows.filter((row) => row.status === 'expired').length;
  const expiringSoonCount = auditRows.filter((row) => row.status === 'expiring-soon').length;
  const missingWarrantyCount = auditRows.filter((row) => row.status === 'missing-date').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary transition-colors hover:bg-surface-container-low"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-primary">Warranty Audit Center</h2>
            <p className="text-secondary font-medium">Read-only review of expired and upcoming warranty risks</p>
          </div>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Audit Scope</p>
          <p className="mt-2 text-sm font-bold text-primary">{auditRows.length} devices with warranty attention signals</p>
          <p className="mt-1 text-xs text-secondary">This page is view-only and does not change any saved inventory data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AuditStatCard label="Flagged" value={flaggedCount} icon={<ShieldAlert className="h-5 w-5" />} accent="text-primary" />
        <AuditStatCard label="Expired" value={expiredCount} icon={<TriangleAlert className="h-5 w-5" />} accent="text-error" />
        <AuditStatCard label="Expiring Soon" value={expiringSoonCount} icon={<Clock3 className="h-5 w-5" />} accent="text-amber-600" />
        <AuditStatCard label="Missing Warranty Date" value={missingWarrantyCount} icon={<ShieldCheck className="h-5 w-5" />} accent="text-secondary" />
      </div>

      <section className="overflow-hidden rounded-3xl border border-outline-variant bg-white shadow-sm">
        <div className="border-b border-outline-variant bg-surface-container-low px-6 py-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr),220px,220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by device ID or model"
                className="w-full rounded-2xl border border-outline-variant bg-white py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-primary"
              />
            </label>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm font-medium text-primary outline-none transition-colors focus:border-primary"
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department === 'all' ? 'All Departments' : department}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AuditStatusFilter)}
              className="rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm font-medium text-primary outline-none transition-colors focus:border-primary"
            >
              <option value="all">All Status</option>
              <option value="expired">Expired</option>
              <option value="expiring-soon">Expiring Soon</option>
              <option value="missing-date">Missing Warranty Date</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-outline-variant">
            <thead className="bg-white">
              <tr className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                <th className="px-6 py-4">Device</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Warranty End</th>
                <th className="px-6 py-4">Alert Status</th>
                <th className="px-6 py-4">Days Remaining</th>
                <th className="px-6 py-4 text-right">Inventory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/70">
              {filteredRows.length > 0 ? filteredRows.map((row) => (
                <tr key={row.device.deviceId} className="hover:bg-surface-container-low/40">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Laptop className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">{row.device.deviceId}</p>
                        <p className="text-xs text-secondary">{row.device.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary">{row.device.department || 'Unassigned'}</td>
                  <td className="px-6 py-4 text-sm text-secondary">{row.device.assignedTo.trim() || 'Not assigned'}</td>
                  <td className="px-6 py-4 text-sm text-primary">{row.expiryLabel}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusBadgeClassName(row.status)}`}>
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-secondary">{row.daysRemainingLabel}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenDevice(row.device.deviceId)}
                      className="rounded-xl border border-outline-variant px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/5"
                    >
                      Open in Inventory
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-sm font-bold text-primary">No devices match the current audit filters.</p>
                    <p className="mt-1 text-xs text-secondary">Try clearing the search or switching the department and status filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AuditStatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">{label}</p>
          <p className="mt-4 text-4xl font-bold text-primary">{value}</p>
        </div>
        <div className={accent}>{icon}</div>
      </div>
    </div>
  );
}

function buildWarrantyAuditRows(devices: Device[]): WarrantyAuditRow[] {
  const rows = devices
    .map<WarrantyAuditRow | null>((device) => {
      const lifecycle = getWarrantyLifecycle(device);
      const expiryDate = getWarrantyExpiryDate(device);

      if (lifecycle.state === 'active') {
        return null;
      }

      if (lifecycle.state === 'unknown') {
        return {
          device,
          status: 'missing-date',
          expiryLabel: 'Not recorded',
          statusLabel: 'Missing Warranty Date',
          daysRemainingLabel: 'Unknown',
          sortRank: 2,
          searchText: `${device.deviceId} ${device.model}`.toLowerCase(),
        } satisfies WarrantyAuditRow;
      }

      const daysRemaining = lifecycle.daysRemaining ?? 0;
      const isExpired = lifecycle.state === 'expired';

      return {
        device,
        status: isExpired ? 'expired' : 'expiring-soon',
        expiryLabel: expiryDate ? expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded',
        statusLabel: isExpired ? 'Expired' : 'Expiring Soon',
        daysRemainingLabel: isExpired ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days left`,
        sortRank: isExpired ? 0 : 1,
        searchText: `${device.deviceId} ${device.model}`.toLowerCase(),
      } satisfies WarrantyAuditRow;
    })
    .filter((row): row is WarrantyAuditRow => row !== null);

  return rows.sort((left, right) => {
      if (left.sortRank !== right.sortRank) {
        return left.sortRank - right.sortRank;
      }

      return left.device.deviceId.localeCompare(right.device.deviceId);
    });
}

function statusBadgeClassName(status: AuditStatusFilter) {
  if (status === 'expired') {
    return 'bg-error/10 text-error';
  }

  if (status === 'expiring-soon') {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-surface-container text-secondary';
}
