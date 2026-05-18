import ExcelJS from 'exceljs';
import type { RepairTicket } from '../../types';
import { applyCellStyle, loadTemplateStyles } from './excelTemplate';

const REPORT_SUBTITLE = 'รายงานการซ่อมแซมอุปกรณ์ระบบสารสนเทศ (IT Equipment Repair Report)';

const HEADER_LABELS: readonly string[] = [
  'No',
  'Ticket ID',
  'Device',
  'Department',
  'Employee',
  'Email',
  'Problem Type',
  'Priority',
  'Status',
  'Created',
  'Completed',
  'Description',
  'Notes',
];

const COLUMN_WIDTHS: readonly number[] = [
  6, 14, 22, 14, 22, 28, 22, 12, 14, 14, 14, 40, 30,
];

const LEFT_ALIGNED_COL_INDEXES = new Set([11, 12]);

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

function formatNotes(ticket: RepairTicket): string {
  if (!ticket.notes || ticket.notes.length === 0) return '';
  return ticket.notes
    .map((n) => `${n.author}: ${n.content}`)
    .join('\n');
}

export function ticketToReportRow(ticket: RepairTicket, index: number): (string | number)[] {
  return [
    index + 1,
    ticket.id,
    ticket.deviceName,
    ticket.department,
    ticket.employeeName,
    ticket.employeeEmail,
    ticket.problemType,
    ticket.priority,
    ticket.status,
    formatDate(ticket.createdAt),
    formatDate(ticket.completedAt),
    ticket.description,
    formatNotes(ticket),
  ];
}

export const REPORT_EXCEL_HEADERS = HEADER_LABELS;

export async function buildRepairReportXlsx(tickets: RepairTicket[]): Promise<Buffer> {
  const styles = await loadTemplateStyles();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'RepairLink';
  wb.created = new Date();

  const ws = wb.addWorksheet('Repair Report', {
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
    font: styles.titleFont,
    alignment: styles.titleAlign,
  });
  ws.getRow(2).getCell(1).value = styles.companyText;

  ws.mergeCells(3, 1, 3, headerSpan);
  ws.getRow(3).height = 30;
  applyCellStyle(ws.getRow(3).getCell(1), {
    font: styles.subtitleFont,
    alignment: styles.subtitleAlign,
  });
  ws.getRow(3).getCell(1).value = REPORT_SUBTITLE;

  const headerRow = ws.getRow(4);
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

  tickets.forEach((ticket, i) => {
    const rowNum = 5 + i;
    const row = ws.getRow(rowNum);
    row.height = 24;
    const values = ticketToReportRow(ticket, i);
    values.forEach((value, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = value;
      const alignment: Partial<ExcelJS.Alignment> = {
        ...styles.dataAlign,
        horizontal: LEFT_ALIGNED_COL_INDEXES.has(idx) ? 'left' : 'center',
      };
      applyCellStyle(cell, {
        font: styles.dataFont,
        alignment,
        border: styles.dataBorder,
      });
    });
  });

  ws.views = [{ state: 'frozen', ySplit: 4 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
