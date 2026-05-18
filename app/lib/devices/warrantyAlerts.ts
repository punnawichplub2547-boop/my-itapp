import type { Device } from '../../types';

const ALERT_VISIBILITY_DAYS = 7;
const EXPIRING_SOON_DAYS = 30;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

export type WarrantyAlertKind = 'expired' | 'expiring-soon';
export type WarrantyLifecycleState = 'unknown' | 'active' | 'expiring-soon' | 'expired';

export interface WarrantyLifecycle {
  state: WarrantyLifecycleState;
  expiryDate?: Date;
  daysRemaining?: number;
}

export interface WarrantyAlertStatus {
  kind: WarrantyAlertKind | null;
  expiryDate?: Date;
  daysRemaining?: number;
}

export interface WarrantyAlertSyncResult {
  kind: WarrantyAlertKind | null;
  expiryDate?: Date;
  daysRemaining?: number;
  visible: boolean;
  nextAlertedAt?: string;
  shouldPersist: boolean;
}

export interface VisibleWarrantyAlert {
  device: Device;
  kind: WarrantyAlertKind;
  expiryDate: Date;
  daysRemaining: number;
  alertedAt: string;
}

export function parseDeviceDate(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || normalized === '-' || normalized.toUpperCase() === 'N/A') {
    return undefined;
  }

  if (/^\d{5}$/.test(normalized)) {
    const serial = Number(normalized);
    const utcDays = Math.floor(serial - 25569);
    const utcMilliseconds = utcDays * DAY_IN_MS;
    return new Date(utcMilliseconds);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const dayMonthYearMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (dayMonthYearMatch) {
    const [, day, month, year] = dayMonthYearMatch;
    const d = Number(day), m = Number(month), y = Number(year);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== y ||
      parsed.getUTCMonth() + 1 !== m ||
      parsed.getUTCDate() !== d
    ) {
      return undefined;
    }
    return parsed;
  }

  return undefined;
}

export function getWarrantyExpiryDate(device: Pick<Device, 'expireDatePrimary' | 'expireDateSecondary'>) {
  return parseDeviceDate(device.expireDatePrimary) ?? parseDeviceDate(device.expireDateSecondary);
}

export function getWarrantyLifecycle(
  device: Pick<Device, 'expireDatePrimary' | 'expireDateSecondary'>,
  now = new Date()
): WarrantyLifecycle {
  const expiryDate = getWarrantyExpiryDate(device);

  if (!expiryDate) {
    return { state: 'unknown' };
  }

  const normalizedNow = normalizeDay(now);
  const normalizedExpiry = normalizeDay(expiryDate);
  const daysRemaining = Math.trunc(
    (normalizedExpiry.getTime() - normalizedNow.getTime()) / DAY_IN_MS
  );

  if (daysRemaining < 0) {
    return { state: 'expired', expiryDate: normalizedExpiry, daysRemaining };
  }

  if (daysRemaining <= EXPIRING_SOON_DAYS) {
    return { state: 'expiring-soon', expiryDate: normalizedExpiry, daysRemaining };
  }

  return { state: 'active', expiryDate: normalizedExpiry, daysRemaining };
}

export function getWarrantyAlertStatus(
  device: Pick<Device, 'expireDatePrimary' | 'expireDateSecondary'>,
  now = new Date()
): WarrantyAlertStatus {
  const lifecycle = getWarrantyLifecycle(device, now);

  if (lifecycle.state === 'expired' || lifecycle.state === 'expiring-soon') {
    return {
      kind: lifecycle.state,
      expiryDate: lifecycle.expiryDate,
      daysRemaining: lifecycle.daysRemaining,
    };
  }

  return {
    kind: null,
    expiryDate: lifecycle.expiryDate,
    daysRemaining: lifecycle.daysRemaining,
  };
}

export function syncWarrantyAlert(device: Device, now = new Date()): WarrantyAlertSyncResult {
  const status = getWarrantyAlertStatus(device, now);
  const currentAlertedAt = normalizeTimestamp(device.warrantyAlertedAt);

  if (!status.kind) {
    return {
      kind: null,
      expiryDate: status.expiryDate,
      daysRemaining: status.daysRemaining,
      visible: false,
      nextAlertedAt: undefined,
      shouldPersist: currentAlertedAt !== undefined,
    };
  }

  const normalizedNow = normalizeDay(now);
  let nextAlertedAt = currentAlertedAt;
  let shouldPersist = false;

  if (!nextAlertedAt) {
    nextAlertedAt = normalizedNow.toISOString();
    shouldPersist = true;
  } else if (
    status.kind === 'expired' &&
    status.expiryDate &&
    normalizeDay(nextAlertedAt).getTime() < status.expiryDate.getTime()
  ) {
    // The device has moved from expiring soon into an expired state, so surface a new alert window.
    nextAlertedAt = normalizedNow.toISOString();
    shouldPersist = true;
  }

  const visibleUntil = addDays(nextAlertedAt, ALERT_VISIBILITY_DAYS);

  return {
    kind: status.kind,
    expiryDate: status.expiryDate,
    daysRemaining: status.daysRemaining,
    visible: normalizedNow.getTime() <= visibleUntil.getTime(),
    nextAlertedAt,
    shouldPersist,
  };
}

export function getVisibleWarrantyAlerts(devices: Device[], now = new Date()): VisibleWarrantyAlert[] {
  return devices
    .map((device) => {
      const alert = syncWarrantyAlert(device, now);

      if (!alert.visible || !alert.kind || !alert.expiryDate || alert.daysRemaining === undefined || !alert.nextAlertedAt) {
        return null;
      }

      return {
        device,
        kind: alert.kind,
        expiryDate: alert.expiryDate,
        daysRemaining: alert.daysRemaining,
        alertedAt: alert.nextAlertedAt,
      } satisfies VisibleWarrantyAlert;
    })
    .filter((alert): alert is VisibleWarrantyAlert => alert !== null)
    .sort(compareVisibleWarrantyAlerts);
}

function compareVisibleWarrantyAlerts(left: VisibleWarrantyAlert, right: VisibleWarrantyAlert) {
  const severityRank = getSeverityRank(left.kind) - getSeverityRank(right.kind);

  if (severityRank !== 0) {
    return severityRank;
  }

  const alertedAtDiff =
    new Date(right.alertedAt).getTime() - new Date(left.alertedAt).getTime();

  if (alertedAtDiff !== 0) {
    return alertedAtDiff;
  }

  return left.device.deviceId.localeCompare(right.device.deviceId);
}

function getSeverityRank(kind: WarrantyAlertKind) {
  return kind === 'expired' ? 0 : 1;
}

function normalizeDay(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function normalizeTimestamp(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : normalizeDay(parsed).toISOString();
}

function addDays(value: string, days: number) {
  const date = normalizeDay(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}
