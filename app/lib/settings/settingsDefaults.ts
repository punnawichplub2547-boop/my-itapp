import { DEVICE_DEPARTMENTS } from '../../data/departments';
import type { SystemSettings } from '../../types';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  departments: [...DEVICE_DEPARTMENTS],
  problemTypes: [
    'Hardware Failure',
    'Software Bug',
    'Physical Damage',
    'Maintenance',
    'Network Issue',
    'Printer / Peripheral',
  ],
  deviceTypes: ['Notebook', 'PC', 'Server'],
  notificationEmails: ['punnawich@car-1996.com'],
  warrantyExpiringSoonDays: 30,
  companyName: 'RepairLink IT Support',
};

function cleanStringList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const set = new Set<string>();
  for (const item of items) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.length > 0) {
        set.add(trimmed);
      }
    }
  }
  return Array.from(set);
}

export function normalizeSettingsPayload(input: unknown): SystemSettings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }

  const raw = input as Record<string, unknown>;

  const departments = Array.isArray(raw.departments)
    ? cleanStringList(raw.departments)
    : DEFAULT_SYSTEM_SETTINGS.departments;

  const problemTypes = Array.isArray(raw.problemTypes)
    ? cleanStringList(raw.problemTypes)
    : DEFAULT_SYSTEM_SETTINGS.problemTypes;

  const deviceTypes = Array.isArray(raw.deviceTypes)
    ? cleanStringList(raw.deviceTypes)
    : DEFAULT_SYSTEM_SETTINGS.deviceTypes;

  const notificationEmails = Array.isArray(raw.notificationEmails)
    ? cleanStringList(raw.notificationEmails)
    : DEFAULT_SYSTEM_SETTINGS.notificationEmails;

  const warrantyExpiringSoonDays =
    typeof raw.warrantyExpiringSoonDays === 'number' &&
    raw.warrantyExpiringSoonDays > 0 &&
    raw.warrantyExpiringSoonDays <= 365
      ? Math.round(raw.warrantyExpiringSoonDays)
      : DEFAULT_SYSTEM_SETTINGS.warrantyExpiringSoonDays;

  const companyName =
    typeof raw.companyName === 'string' && raw.companyName.trim().length > 0
      ? raw.companyName.trim()
      : DEFAULT_SYSTEM_SETTINGS.companyName;

  return {
    departments: departments.length > 0 ? departments : DEFAULT_SYSTEM_SETTINGS.departments,
    problemTypes: problemTypes.length > 0 ? problemTypes : DEFAULT_SYSTEM_SETTINGS.problemTypes,
    deviceTypes: deviceTypes.length > 0 ? deviceTypes : DEFAULT_SYSTEM_SETTINGS.deviceTypes,
    notificationEmails: notificationEmails.length > 0 ? notificationEmails : DEFAULT_SYSTEM_SETTINGS.notificationEmails,
    warrantyExpiringSoonDays,
    companyName,
  };
}
