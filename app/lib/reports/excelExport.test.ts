import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';

import { buildDeviceInventoryXlsx } from '../devices/excelExport';
import { buildRepairReportXlsx } from './excelExport';
import type { Device, RepairTicket } from '../../types';

const COMPANY_TITLE = 'COMPLETE  AUTO  RUBBER  MANUFACTURING  CO.,LTD.';

const REPORT_TICKET: RepairTicket = {
  id: 'TK-100',
  deviceName: 'CAR001',
  employeeName: 'chakrit',
  employeeEmail: 'chakrit@example.com',
  department: 'IT',
  problemType: 'Hardware Failure',
  description: 'No display after boot.',
  status: 'Completed',
  priority: 'High',
  createdAt: '2026-05-01T08:00:00.000Z',
  completedAt: '2026-05-02T09:30:00.000Z',
  notes: [],
  history: [],
  attachments: [],
};

const INVENTORY_DEVICE: Device = {
  deviceId: 'CAR001',
  assetNo: '1',
  ipMode: 'DHCP',
  ipAddress: '10.0.0.10',
  department: 'IT',
  assignedTo: 'chakrit',
  deviceType: 'PC',
  model: 'OptiPlex 360',
  hdd: '500 GB',
  ram: '4',
  cpu: 'Pentium Dual-Core',
  installDate: '42971',
  expireDatePrimary: '43356',
  expireDateSecondary: '',
  warranty: '1',
  yearValue: '6',
  os: 'Windows 10 Pro',
  osLicense: 'OEM',
  msOfficeVersion: '2019',
  status: 'Active',
  notes: '',
};

test('repair report workbook keeps one company heading and adds a sign-off block', async () => {
  const worksheet = await readFirstWorksheet(await buildRepairReportXlsx([REPORT_TICKET]));

  assert.equal(countFirstColumnText(worksheet, COMPANY_TITLE), 1);
  assert.equal(worksheet.getRow(3).getCell(1).value, 'No');
  assert.equal(worksheet.getRow(6).getCell(1).value, null);
  assert.equal(worksheet.getRow(6).getCell(8).value, 'ผู้จัดทำ');
  assert.equal(worksheet.getRow(7).height, 52);
  assert.equal(hasCellText(worksheet, 'ผู้จัดทำ'), true);
  assert.equal(hasCellText(worksheet, 'ผู้ตรวจสอบ'), true);
  assert.equal(hasCellText(worksheet, 'IT Support'), true);
  assert.equal(hasCellText(worksheet, 'IT Mgr'), true);
  assertLandscapeA4PrintSetup(worksheet);
});

test('repair report workbook expands rows for wrapped description and solution text', async () => {
  const worksheet = await readFirstWorksheet(
    await buildRepairReportXlsx([
      {
        ...REPORT_TICKET,
        description:
          'The workstation loses video output after startup and requires a longer repair description for print verification.',
        notes: [
          {
            id: 'note-1',
            author: 'admin@repairlink.local',
            content:
              'Replaced the damaged display cable, reseated the connector, and verified a stable image after reboot.',
            timestamp: '2026-05-02T09:00:00.000Z',
          },
        ],
      },
    ])
  );

  assert.ok((worksheet.getRow(4).height ?? 0) > 24);
  assert.equal(worksheet.getRow(4).getCell(5).alignment?.wrapText, true);
  assert.equal(worksheet.getRow(4).getCell(6).alignment?.wrapText, true);
});

test('device inventory workbook keeps one company heading and adds a sign-off block', async () => {
  const worksheet = await readFirstWorksheet(await buildDeviceInventoryXlsx([INVENTORY_DEVICE]));

  assert.equal(countFirstColumnText(worksheet, COMPANY_TITLE), 1);
  assert.equal(worksheet.getRow(3).getCell(1).value, 'No');
  assert.equal(worksheet.getRow(6).getCell(1).value, null);
  assert.equal(worksheet.getRow(6).getCell(15).value, 'ผู้จัดทำ');
  assert.equal(worksheet.getRow(7).height, 52);
  assert.equal(worksheet.getRow(7).getCell(15).value, '(..............................)');
  assert.equal(hasCellText(worksheet, 'ผู้จัดทำ'), true);
  assert.equal(hasCellText(worksheet, 'ผู้ตรวจสอบ'), true);
  assert.equal(hasCellText(worksheet, 'IT Support'), true);
  assert.equal(hasCellText(worksheet, 'IT Mgr'), true);
  assertLandscapeA4PrintSetup(worksheet);
});

async function readFirstWorksheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
}

function countCellText(worksheet: ExcelJS.Worksheet, expected: string) {
  let count = 0;

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (String(cell.value ?? '') === expected) {
        count += 1;
      }
    });
  });

  return count;
}

function countFirstColumnText(worksheet: ExcelJS.Worksheet, expected: string) {
  let count = 0;

  worksheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? '') === expected) {
      count += 1;
    }
  });

  return count;
}

function hasCellText(worksheet: ExcelJS.Worksheet, expected: string) {
  return countCellText(worksheet, expected) > 0;
}

function assertLandscapeA4PrintSetup(worksheet: ExcelJS.Worksheet) {
  assert.equal(worksheet.pageSetup.paperSize, 9);
  assert.equal(worksheet.pageSetup.orientation, 'landscape');
  assert.equal(worksheet.pageSetup.fitToPage, true);
  assert.equal(worksheet.pageSetup.fitToWidth, 1);
  assert.equal(worksheet.pageSetup.fitToHeight, 0);
  assert.equal(worksheet.pageSetup.printTitlesRow, '1:3');
}
