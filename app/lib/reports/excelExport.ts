import ExcelJS from 'exceljs';
import type { RepairTicket } from '../../types';
import {
  addSignatureBlock,
  applyCellStyle,
  applyLandscapeA4PrintSetup,
  loadTemplateStyles,
} from './excelTemplate';

const REPORT_SUBTITLE = 'รายงานการซ่อมแซมอุปกรณ์ระบบสารสนเทศ (IT Equipment Repair Report)';

const HEADER_LABELS: readonly string[] = [
  'No',
  'Ticket ID',
  'Device',
  'Department',
  'Description',
  'Solution',
  'Email',
  'Problem Type',
  'Created',
  'Completed',
  'Status',
];

const COLUMN_WIDTHS: readonly number[] = [
  5, 12, 17, 11, 34, 34, 24, 18, 12, 12, 13,
];

const LEFT_ALIGNED_COL_INDEXES = new Set([4, 5]);
const WRAPPED_TEXT_COL_INDEXES = new Set([4, 5]);

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

function formatSolution(ticket: RepairTicket): string {
  if (!ticket.notes || ticket.notes.length === 0) return '';
  return ticket.notes
    .map((note) => note.content)
    .join('\n');
}

export function ticketToReportRow(ticket: RepairTicket, index: number): (string | number)[] {
  return [
    index + 1,
    ticket.id,
    ticket.deviceName,
    ticket.department,
    ticket.description,
    formatSolution(ticket),
    ticket.employeeEmail,
    ticket.problemType,
    formatDate(ticket.createdAt),
    formatDate(ticket.completedAt),
    ticket.status,
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
    font: styles.subtitleFont,
    alignment: styles.subtitleAlign,
  });
  ws.getRow(2).getCell(1).value = REPORT_SUBTITLE;

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

  tickets.forEach((ticket, i) => {
    const rowNum = 4 + i;
    const row = ws.getRow(rowNum);
    const values = ticketToReportRow(ticket, i);
    row.height = getReportRowHeight(values);
    values.forEach((value, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = value;
      const alignment: Partial<ExcelJS.Alignment> = {
        ...styles.dataAlign,
        horizontal: LEFT_ALIGNED_COL_INDEXES.has(idx) ? 'left' : 'center',
        wrapText: true,
      };
      applyCellStyle(cell, {
        font: styles.dataFont,
        alignment,
        border: styles.dataBorder,
      });
    });
  });

  addSignatureBlock(ws, 5 + tickets.length, headerSpan, styles, { columnCount: 4 });
  applyLandscapeA4PrintSetup(ws);

  ws.views = [{ state: 'frozen', ySplit: 3 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function getReportRowHeight(values: (string | number)[]) {
  const maxLineCount = Math.max(
    ...values.map((value, index) =>
      WRAPPED_TEXT_COL_INDEXES.has(index)
        ? getEstimatedWrappedLineCount(value, COLUMN_WIDTHS[index])
        : String(value ?? '').split('\n').length
    )
  );

  return Math.max(24, maxLineCount * 18 + 6);
}

function getEstimatedWrappedLineCount(value: string | number, columnWidth: number) {
  const charsPerLine = Math.max(1, Math.floor(columnWidth * 0.8));

  return String(value ?? '')
    .split('\n')
    .reduce(
      (lineCount, line) =>
        lineCount + Math.max(1, Math.ceil(line.length / charsPerLine)),
      0
    );
}
