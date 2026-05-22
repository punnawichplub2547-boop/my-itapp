import path from 'node:path';
import ExcelJS from 'exceljs';

export const TEMPLATE_FILENAME = 'F-IT-010 Rev.01.xlsx';

export type CellStylePack = {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  alignment?: Partial<ExcelJS.Alignment>;
  border?: Partial<ExcelJS.Borders>;
};

export type TemplateStyles = {
  companyText: string;
  subtitleText: string;
  titleFont: Partial<ExcelJS.Font>;
  titleAlign: Partial<ExcelJS.Alignment>;
  subtitleFont: Partial<ExcelJS.Font>;
  subtitleAlign: Partial<ExcelJS.Alignment>;
  headerFont: Partial<ExcelJS.Font>;
  headerFill: ExcelJS.Fill;
  headerAlign: Partial<ExcelJS.Alignment>;
  headerBorder: Partial<ExcelJS.Borders>;
  dataFont: Partial<ExcelJS.Font>;
  dataAlign: Partial<ExcelJS.Alignment>;
  dataBorder: Partial<ExcelJS.Borders>;
};

const FALLBACK_FONT: Partial<ExcelJS.Font> = {
  name: 'Cordia New',
  family: 2,
  size: 18,
  color: { argb: 'FF000000' },
};

const FALLBACK_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

export const FALLBACK_STYLES: TemplateStyles = {
  companyText: 'COMPLETE  AUTO  RUBBER  MANUFACTURING  CO.,LTD.',
  subtitleText:
    'ทะเบียนรายชื่ออุปกรณ์ระบบสารสนเทศและอุปกรณ์ต่อพ่วง (IT System Asset)',
  titleFont: { ...FALLBACK_FONT, bold: true },
  titleAlign: { horizontal: 'center', vertical: 'middle' },
  subtitleFont: { ...FALLBACK_FONT, bold: true },
  subtitleAlign: { horizontal: 'center', vertical: 'middle' },
  headerFont: { ...FALLBACK_FONT, bold: true, size: 14 },
  headerFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  },
  headerAlign: { horizontal: 'center', vertical: 'middle', wrapText: true },
  headerBorder: FALLBACK_BORDER,
  dataFont: { ...FALLBACK_FONT, size: 14 },
  dataAlign: { horizontal: 'center', vertical: 'middle', wrapText: true },
  dataBorder: FALLBACK_BORDER,
};

export async function loadTemplateStyles(): Promise<TemplateStyles> {
  try {
    const templatePath = path.join(process.cwd(), TEMPLATE_FILENAME);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.worksheets[0];
    const row1Cell = ws.getRow(1).getCell(1);
    const row3Cell = ws.getRow(3).getCell(1);
    const row4Cell = ws.getRow(4).getCell(1);
    const row6Cell = ws.getRow(6).getCell(2);

    return {
      companyText: String(row1Cell.value ?? FALLBACK_STYLES.companyText),
      subtitleText: String(row3Cell.value ?? FALLBACK_STYLES.subtitleText),
      titleFont: row1Cell.font ?? FALLBACK_STYLES.titleFont,
      titleAlign: row1Cell.alignment ?? FALLBACK_STYLES.titleAlign,
      subtitleFont: row3Cell.font ?? FALLBACK_STYLES.subtitleFont,
      subtitleAlign: row3Cell.alignment ?? FALLBACK_STYLES.subtitleAlign,
      headerFont: row4Cell.font ?? FALLBACK_STYLES.headerFont,
      headerFill: (row4Cell.fill as ExcelJS.Fill) ?? FALLBACK_STYLES.headerFill,
      headerAlign: row4Cell.alignment ?? FALLBACK_STYLES.headerAlign,
      headerBorder: row4Cell.border ?? FALLBACK_STYLES.headerBorder,
      dataFont: row6Cell.font ?? FALLBACK_STYLES.dataFont,
      dataAlign: row6Cell.alignment ?? FALLBACK_STYLES.dataAlign,
      dataBorder: row6Cell.border ?? FALLBACK_STYLES.dataBorder,
    };
  } catch {
    return FALLBACK_STYLES;
  }
}

export function applyCellStyle(cell: ExcelJS.Cell, style: CellStylePack): void {
  if (style.font) cell.font = style.font as ExcelJS.Font;
  if (style.fill) cell.fill = style.fill;
  if (style.alignment) cell.alignment = style.alignment as ExcelJS.Alignment;
  if (style.border) cell.border = style.border as ExcelJS.Borders;
}

const SIGNATURE_BORDER = {
  style: 'thin' as const,
  color: { argb: 'FF000000' },
};

const SIGNATURE_ROWS = [
  {
    leftText: 'ผู้จัดทำ',
    rightText: 'ผู้ตรวจสอบ',
    height: 28,
    isHeading: true,
  },
  {
    leftText: '(..............................)',
    rightText: '(..............................)',
    height: 52,
  },
  {
    leftText: 'IT Support',
    rightText: 'IT Mgr',
    height: 28,
  },
  {
    leftText: 'วันที่ ....../....../......',
    rightText: 'วันที่ ....../....../......',
    height: 28,
  },
] as const;

export function addSignatureBlock(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endColumn: number,
  styles: TemplateStyles,
  options: { columnCount?: number } = {}
) {
  const safeEndColumn = Math.max(2, endColumn);
  const blockColumnCount = Math.min(
    Math.max(2, options.columnCount ?? 6),
    safeEndColumn
  );
  const startColumn = safeEndColumn - blockColumnCount + 1;
  const leftColumnCount = Math.floor(blockColumnCount / 2);
  const leftEndColumn = startColumn + leftColumnCount - 1;
  const rightStartColumn = leftEndColumn + 1;
  const endRow = startRow + SIGNATURE_ROWS.length - 1;

  SIGNATURE_ROWS.forEach((signatureRow, index) => {
    const rowNumber = startRow + index;
    const row = worksheet.getRow(rowNumber);
    const isHeading = 'isHeading' in signatureRow && signatureRow.isHeading;
    row.height = signatureRow.height;

    applySignatureBorders(
      worksheet,
      rowNumber,
      startRow,
      endRow,
      startColumn,
      safeEndColumn,
      leftEndColumn
    );

    worksheet.mergeCells(rowNumber, startColumn, rowNumber, leftEndColumn);
    worksheet.mergeCells(rowNumber, rightStartColumn, rowNumber, safeEndColumn);

    applySignatureCell(row.getCell(startColumn), signatureRow.leftText, styles, isHeading);
    applySignatureCell(
      row.getCell(rightStartColumn),
      signatureRow.rightText,
      styles,
      isHeading
    );
  });
}

export function applyLandscapeA4PrintSetup(worksheet: ExcelJS.Worksheet) {
  worksheet.pageSetup.paperSize = 9;
  worksheet.pageSetup.orientation = 'landscape';
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToWidth = 1;
  worksheet.pageSetup.fitToHeight = 0;
  worksheet.pageSetup.printTitlesRow = '1:3';
  worksheet.pageSetup.margins = {
    left: 0.25,
    right: 0.25,
    top: 0.35,
    bottom: 0.35,
    header: 0.15,
    footer: 0.15,
  };
}

function applySignatureBorders(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
  leftEndColumn: number
) {
  for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
    const cell = worksheet.getRow(rowNumber).getCell(columnNumber);
    const border: Partial<ExcelJS.Borders> = {
      bottom: SIGNATURE_BORDER,
    };

    if (rowNumber === startRow) border.top = SIGNATURE_BORDER;
    if (rowNumber === endRow) border.bottom = SIGNATURE_BORDER;
    if (columnNumber === startColumn) border.left = SIGNATURE_BORDER;
    if (columnNumber === endColumn) border.right = SIGNATURE_BORDER;

    if (columnNumber === leftEndColumn) {
      border.right = SIGNATURE_BORDER;
    }

    if (columnNumber === leftEndColumn + 1) {
      border.left = SIGNATURE_BORDER;
    }

    cell.border = border as ExcelJS.Borders;
  }
}

function applySignatureCell(
  cell: ExcelJS.Cell,
  value: string,
  styles: TemplateStyles,
  isHeading?: boolean
) {
  cell.value = value;
  applyCellStyle(cell, {
    font: isHeading ? styles.headerFont : styles.dataFont,
    alignment: {
      ...styles.dataAlign,
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    },
  });
}
