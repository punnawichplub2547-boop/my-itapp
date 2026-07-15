import ExcelJS from 'exceljs';
import type { Device } from '../../types';
import {
  addSignatureBlock,
  applyCellStyle,
  applyLandscapeA4PrintSetup,
  loadTemplateStyles,
} from '../reports/excelTemplate';
import { parseDeviceDate } from './warrantyAlerts';

const HEADER_LABELS: readonly string[] = [
  'No',
  'Name',
  'IP Address',
  'Dept.',
  'User Log on',
  'TYPE',
  'Model',
  'HDD',
  'RAM',
  'CPU',
  'Install Date',
  'Expire Date',
  'Expire Date',
  'Waranty',
  'Year',
  'OS',
  'OS Licens',
  'MS Office V.',
];

const COLUMN_WIDTHS: readonly number[] = [
  6, 18, 16, 14, 22, 14, 22, 12, 12, 22, 16, 16, 16, 12, 10, 18, 14, 18,
];

function formatDeviceDate(value: string | undefined): string {
  if (!value || !value.trim() || value === '-') return '';
  const parsed = parseDeviceDate(value);
  if (parsed) {
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const year = parsed.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  return value.trim();
}

export function deviceToReportRow(device: Device, index: number): (string | number)[] {
  return [
    index + 1,
    device.deviceId ?? '',
    device.ipAddress ?? '',
    device.department ?? '',
    device.assignedTo ?? '',
    device.deviceType ?? '',
    device.model ?? '',
    device.hdd ?? '',
    device.ram ?? '',
    device.cpu ?? '',
    formatDeviceDate(device.installDate),
    formatDeviceDate(device.expireDatePrimary),
    formatDeviceDate(device.expireDateSecondary),
    device.warranty ?? '',
    device.yearValue ?? '',
    device.os ?? '',
    device.osLicense ?? '',
    device.msOfficeVersion ?? '',
  ];
}

export const DEVICE_EXCEL_HEADERS = HEADER_LABELS;

export async function buildDeviceInventoryXlsx(devices: Device[]): Promise<Buffer> {
  const styles = await loadTemplateStyles();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IT System';
  wb.created = new Date();

  const ws = wb.addWorksheet('IT System Asset', {
    properties: { defaultRowHeight: 22 },
  });

  COLUMN_WIDTHS.forEach((width, idx) => {
    ws.getColumn(idx + 1).width = width;
  });

  const headerSpan = HEADER_LABELS.length;

  ws.mergeCells(1, 1, 1, headerSpan);
  ws.getRow(1).height = 30;
  applyCellStyle(ws.getRow(1).getCell(1), {
    font: styles.titleFont,
    alignment: styles.titleAlign,
  });
  ws.getRow(1).getCell(1).value = styles.companyText;

  ws.mergeCells(2, 1, 2, headerSpan);
  ws.getRow(2).height = 30;
  applyCellStyle(ws.getRow(2).getCell(1), {
    font: styles.subtitleFont,
    alignment: styles.subtitleAlign,
  });
  ws.getRow(2).getCell(1).value = styles.subtitleText;

  const headerRow = ws.getRow(3);
  headerRow.height = 28;
  HEADER_LABELS.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    applyCellStyle(cell, {
      font: styles.headerFont,
      fill: styles.headerFill,
      alignment: styles.headerAlign,
      border: styles.headerBorder,
    });
  });

  devices.forEach((device, i) => {
    const rowNum = 4 + i;
    const row = ws.getRow(rowNum);
    row.height = 24;
    const values = deviceToReportRow(device, i);
    values.forEach((value, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = value;
      applyCellStyle(cell, {
        font: styles.dataFont,
        alignment: styles.dataAlign,
        border: styles.dataBorder,
      });
    });
  });

  addSignatureBlock(ws, 5 + devices.length, headerSpan, styles, { columnCount: 4 });
  applyLandscapeA4PrintSetup(ws);

  ws.views = [{ state: 'frozen', ySplit: 3 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
