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
