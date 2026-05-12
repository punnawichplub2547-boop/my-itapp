import { readFileSync } from 'node:fs';

import * as XLSX from 'xlsx';

import type { Device, DeviceType } from '../../types';

export const DEVICE_WORKBOOK_SHEET_NAME = 'F-IT-010 Rev.00(Update)';
export const DEVICE_WORKBOOK_HEADER_ROW_INDEX = 3;

export interface WorkbookRow {
  No?: string;
  Name?: string;
  'IP Address'?: string;
  'Dept.'?: string;
  'User Log on'?: string;
  TYPE?: string;
  Model?: string;
  HDD?: string;
  RAM?: string;
  CPU?: string;
  'Install Date'?: string;
  'Expire Date'?: string;
  'Expire Date 2'?: string;
  Waranty?: string;
  Year?: string;
  OS?: string;
  'OS Licens'?: string;
  'MS Office V.'?: string;
}

const SKIPPED_NAME_MARKERS = ['หมายเหตุ', 'ผู้จัดทำ', 'ผู้อนุมัติ'];
const workbookDeviceTypes: DeviceType[] = ['Laptop', 'PC', 'Server', 'Notebook', 'Desktop', 'Unknown'];

export function readWorkbookRows(
  workbookPath: string,
  sheetName = DEVICE_WORKBOOK_SHEET_NAME
): WorkbookRow[] {
  const workbook = XLSX.read(readFileSync(workbookPath));
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Missing sheet ${sheetName}`);
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: DEVICE_WORKBOOK_HEADER_ROW_INDEX,
    defval: '',
  });

  return rows.map((row) => ({
    No: normalizeCellText(row.No),
    Name: normalizeCellText(row.Name),
    'IP Address': normalizeCellText(row['IP Address']),
    'Dept.': normalizeCellText(row['Dept.']),
    'User Log on': normalizeCellText(row['User Log on']),
    TYPE: normalizeCellText(row.TYPE),
    Model: normalizeCellText(row.Model),
    HDD: normalizeCellText(row.HDD),
    RAM: normalizeCellText(row.RAM),
    CPU: normalizeCellText(row.CPU),
    'Install Date': normalizeCellText(row['Install Date']),
    'Expire Date': normalizeCellText(row['Expire Date']),
    'Expire Date 2': normalizeCellText(row['Expire Date 2'] ?? row.Expire_Date_1 ?? row['Expire Date_1']),
    Waranty: normalizeCellText(row.Waranty),
    Year: normalizeCellText(row.Year),
    OS: normalizeCellText(row.OS),
    'OS Licens': normalizeCellText(row['OS Licens']),
    'MS Office V.': normalizeCellText(row['MS Office V.']),
  }));
}

export function shouldImportWorkbookRow(row: WorkbookRow) {
  const deviceId = row.Name?.trim() ?? '';

  if (!deviceId) {
    return false;
  }

  if (SKIPPED_NAME_MARKERS.some((marker) => deviceId.includes(marker))) {
    return false;
  }

  return [row.TYPE, row.Model, row.OS, row['Dept.'], row['User Log on']].some(
    (value) => (value ?? '').trim().length > 0
  );
}

export function mapWorkbookRowToDeviceRecord(row: WorkbookRow): Device {
  const rawIp = row['IP Address']?.trim() ?? '';
  const ipMode = rawIp.toUpperCase() === 'DHCP' ? 'DHCP' : rawIp ? 'Manual' : 'DHCP';

  return {
    deviceId: row.Name?.trim() ?? '',
    assetNo: row.No?.trim() ?? '',
    ipMode,
    ipAddress: ipMode === 'Manual' ? rawIp : '',
    department: row['Dept.']?.trim() ?? '',
    assignedTo: row['User Log on']?.trim() ?? '',
    deviceType: normalizeWorkbookDeviceType(row.TYPE),
    model: row.Model?.trim() ?? '',
    hdd: row.HDD?.trim() ?? '',
    ram: row.RAM?.trim() ?? '',
    cpu: row.CPU?.trim() ?? '',
    installDate: row['Install Date']?.trim() ?? '',
    expireDatePrimary: row['Expire Date']?.trim() ?? '',
    expireDateSecondary: row['Expire Date 2']?.trim() ?? '',
    warranty: row.Waranty?.trim() ?? '',
    yearValue: row.Year?.trim() ?? '',
    os: row.OS?.trim() ?? '',
    osLicense: row['OS Licens']?.trim() ?? '',
    msOfficeVersion: row['MS Office V.']?.trim() ?? '',
    status: 'Active',
    notes: '',
  };
}

export function normalizeWorkbookDeviceType(value: string | undefined): DeviceType {
  const normalized = value?.trim() ?? '';

  return workbookDeviceTypes.includes(normalized as DeviceType)
    ? (normalized as DeviceType)
    : 'Unknown';
}

function normalizeCellText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value.trim() : String(value).trim();
}
