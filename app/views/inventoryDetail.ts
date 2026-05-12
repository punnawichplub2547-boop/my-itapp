import type { Device } from '../types';

export type DeviceDetailTabKey =
  | 'hardware-os'
  | 'warranty-lifecycle'
  | 'assignment-history'
  | 'repair-log';

export interface DeviceDetailTab {
  key: DeviceDetailTabKey;
  label: string;
}

export interface WarrantySnapshot {
  status: 'active' | 'expired' | 'unknown';
  headline: string;
  detail: string;
  expirationText: string;
  daysRemainingText: string;
}

export interface AssignmentHistoryRow {
  id: string;
  assetUser: string;
  assetUserMeta: string;
  department: string;
  assignedOn: string;
  returnedOn: string;
  status: string;
}

export interface RepairLogEntry {
  id: string;
  title: string;
  eventId: string;
  detail: string;
  timestamp: string;
  technician: string;
  status: string;
}

export const DEVICE_DETAIL_TABS: DeviceDetailTab[] = [
  { key: 'hardware-os', label: 'HARDWARE & OS' },
  { key: 'warranty-lifecycle', label: 'WARRANTY & LIFECYCLE' },
  { key: 'assignment-history', label: 'ASSIGNMENT HISTORY' },
  { key: 'repair-log', label: 'REPAIR LOG' },
];

export function getDeviceDetailHeroTitle(device: Device) {
  return device.ipAddress || device.deviceId;
}

export function getDeviceDetailHeroSubtitle(device: Device) {
  const parts = [
    device.model || device.deviceType || 'Unknown device',
    device.assetNo ? `Asset #${device.assetNo}` : '',
    device.deviceId ? `ID: ${device.deviceId}` : '',
  ].filter(Boolean);

  return parts.join(' • ');
}

export function getWarrantySnapshot(device: Device, now = new Date()): WarrantySnapshot {
  const expiryDate =
    parseDeviceDate(device.expireDateSecondary) ?? parseDeviceDate(device.expireDatePrimary);

  if (!expiryDate) {
    return {
      status: 'unknown',
      headline: 'Warranty status unavailable',
      detail: 'No parseable lifecycle date is stored for this asset yet.',
      expirationText: device.expireDateSecondary || device.expireDatePrimary || 'Not recorded',
      daysRemainingText: 'Unknown',
    };
  }

  const normalizedNow = new Date(now);
  normalizedNow.setUTCHours(0, 0, 0, 0);

  const normalizedExpiry = new Date(expiryDate);
  normalizedExpiry.setUTCHours(0, 0, 0, 0);

  const daysRemaining = Math.round(
    (normalizedExpiry.getTime() - normalizedNow.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = daysRemaining < 0;

  return {
    status: isExpired ? 'expired' : 'active',
    headline: isExpired ? 'Warranty status: expired' : 'Warranty status: active',
    detail: isExpired
      ? 'Support for this asset has expired. Review lifecycle risk before the next hardware issue.'
      : 'This asset still has active lifecycle coverage based on the stored expiration date.',
    expirationText: formatIsoDate(normalizedExpiry),
    daysRemainingText: `${daysRemaining} days`,
  };
}

export function buildAssignmentHistory(device: Device): AssignmentHistoryRow[] {
  return [
    {
      id: `${device.deviceId}-assignment-current`,
      assetUser: device.assignedTo || 'Unassigned',
      assetUserMeta: device.assignedTo ? deriveAssignmentIdentity(device.assignedTo) : 'No active custodian',
      department: device.department || 'Unspecified',
      assignedOn: formatDateValue(device.updatedAt || device.createdAt || device.installDate),
      returnedOn: device.assignedTo ? 'Active session' : 'Awaiting assignment',
      status: device.assignedTo ? 'In possession' : 'Available',
    },
  ];
}

export function buildRepairLog(device: Device): RepairLogEntry[] {
  if (!device.notes) {
    return [];
  }

  return [
    {
      id: `${device.deviceId}-repair-note`,
      title: 'Current device note',
      eventId: `LOG-${device.deviceId}`,
      detail: device.notes,
      timestamp: formatDateValue(device.updatedAt || device.createdAt || device.installDate),
      technician: 'Admin record',
      status: 'Recorded',
    },
  ];
}

export function deriveAssignmentIdentity(assignedTo: string) {
  const normalized = assignedTo.trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (normalized.includes('@')) {
    return normalized;
  }

  return `${normalized}@company.local`;
}

export function formatDateValue(value: string | undefined) {
  const parsed = parseDeviceDate(value);
  return parsed ? formatIsoDate(parsed) : value?.trim() || 'Not recorded';
}

export function parseDeviceDate(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || normalized === '-' || normalized.toUpperCase() === 'N/A') {
    return undefined;
  }

  if (/^\d{5}$/.test(normalized)) {
    const serial = Number(normalized);
    const utcDays = Math.floor(serial - 25569);
    const utcMilliseconds = utcDays * 86400 * 1000;
    return new Date(utcMilliseconds);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const dayMonthYearMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (dayMonthYearMatch) {
    const [, day, month, year] = dayMonthYearMatch;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
