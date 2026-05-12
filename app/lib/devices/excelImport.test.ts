import assert from 'node:assert/strict';
import test from 'node:test';

import { mapWorkbookRowToDeviceRecord, shouldImportWorkbookRow } from './excelImport';

test('maps workbook columns into a device record keyed by deviceId', () => {
  const record = mapWorkbookRowToDeviceRecord({
    No: '64',
    Name: 'CAR163',
    'IP Address': 'DHCP',
    'Dept.': 'EN',
    'User Log on': 'sasiluk_en',
    TYPE: 'Notebook',
    Model: 'Thinkbook15 G3 ACL',
    HDD: '500 GB',
    RAM: '8',
    CPU: 'Ryzen 5 5500U',
    'Install Date': '44613',
    'Expire Date': '44613',
    'Expire Date 2': '44978',
    Waranty: '1',
    Year: '0',
    OS: '11 Pro',
    'OS Licens': 'OEM',
    'MS Office V.': '2016',
  });

  assert.equal(record.deviceId, 'CAR163');
  assert.equal(record.assetNo, '64');
  assert.equal(record.assignedTo, 'sasiluk_en');
  assert.equal(record.ipMode, 'DHCP');
});

test('skips workbook footer and note rows', () => {
  assert.equal(
    shouldImportWorkbookRow({
      Name: 'หมายเหตุ : ทำการอัพเดททุก 3 เดือน ( ทุกวันที่ 1 )',
      TYPE: '',
      Model: '',
      OS: '',
      'Dept.': '',
      'User Log on': '',
    }),
    false
  );
});
