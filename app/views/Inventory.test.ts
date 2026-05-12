import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEVICE_PAGE_SIZE,
  DEVICE_STATUS_OPTIONS,
  default as Inventory,
  clampInventoryPage,
  paginateDevices,
  upsertDevice,
  updateDeviceAssignment,
  updateDeviceStatus,
} from './Inventory';

const INVENTORY_DEVICES = [
  {
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
    expireDateSecondary: '43356',
    warranty: '1',
    yearValue: '6',
    os: 'Windows 10 Pro',
    osLicense: 'OEM',
    msOfficeVersion: '2019',
    status: 'Active',
    notes: '',
  },
  {
    deviceId: 'CAR002',
    assetNo: '2',
    ipMode: 'Manual',
    ipAddress: '10.0.0.11',
    department: 'Finance',
    assignedTo: '',
    deviceType: 'Notebook',
    model: 'ThinkBook 15',
    hdd: '512 GB',
    ram: '8',
    cpu: 'Ryzen 5 5500U',
    installDate: '44613',
    expireDatePrimary: '44978',
    expireDateSecondary: '44978',
    warranty: '1',
    yearValue: '0',
    os: 'Windows 11 Pro',
    osLicense: 'OEM',
    msOfficeVersion: '2016',
    status: 'Inactive',
    notes: '',
  },
];

test('exposes the workbook-backed inventory status options', () => {
  assert.deepEqual(DEVICE_STATUS_OPTIONS, ['Active', 'Inactive', 'Out of Service']);
});

test('updates only the targeted device status by deviceId', () => {
  const updated = updateDeviceStatus(INVENTORY_DEVICES as never, 'CAR001', 'Out of Service');

  assert.equal(updated[0].status, 'Out of Service');
  assert.equal(updated[1].status, INVENTORY_DEVICES[1].status);
  assert.notStrictEqual(updated, INVENTORY_DEVICES);
  assert.notStrictEqual(updated[0], INVENTORY_DEVICES[0]);
});

test('keeps assignment updates separate from device identity', () => {
  const updated = updateDeviceAssignment(INVENTORY_DEVICES as never, 'CAR001', 'new.user' as never);

  assert.equal(updated[0].deviceId, INVENTORY_DEVICES[0].deviceId);
  assert.equal(updated[0].assignedTo, 'new.user');
});

test('appends a newly created device into inventory state by unique deviceId', () => {
  const createdDevice = {
    ...INVENTORY_DEVICES[0],
    deviceId: 'CAR999',
    assetNo: '999',
  };

  const updated = upsertDevice(INVENTORY_DEVICES as never, createdDevice as never);

  assert.equal(updated.length, INVENTORY_DEVICES.length + 1);
  assert.equal(updated.at(-1)?.deviceId, 'CAR999');
  assert.equal(updated.at(-1)?.assetNo, '999');
});

test('does not render Asset No or Status table columns in inventory', () => {
  const markup = renderToStaticMarkup(
    React.createElement(Inventory, { devices: INVENTORY_DEVICES as never })
  );

  assert.doesNotMatch(markup, />Asset No</);
  assert.doesNotMatch(markup, />Status</);
  assert.match(markup, />Device ID</);
});

test('uses a fixed inventory page size of 10 devices', () => {
  assert.equal(DEVICE_PAGE_SIZE, 10);
});

test('paginates inventory devices 10 rows at a time', () => {
  const manyDevices = Array.from({ length: 12 }, (_, index) => ({
    ...INVENTORY_DEVICES[0],
    deviceId: `CAR${String(index + 1).padStart(3, '0')}`,
    assetNo: String(index + 1),
  }));

  const firstPage = paginateDevices(manyDevices as never, 1, DEVICE_PAGE_SIZE);
  const secondPage = paginateDevices(manyDevices as never, 2, DEVICE_PAGE_SIZE);

  assert.equal(firstPage.length, 10);
  assert.equal(firstPage[0].deviceId, 'CAR001');
  assert.equal(firstPage.at(-1)?.deviceId, 'CAR010');
  assert.equal(secondPage.length, 2);
  assert.equal(secondPage[0].deviceId, 'CAR011');
  assert.equal(secondPage[1].deviceId, 'CAR012');
});

test('clamps inventory pagination to the valid page range', () => {
  assert.equal(clampInventoryPage(0, 3), 1);
  assert.equal(clampInventoryPage(2, 3), 2);
  assert.equal(clampInventoryPage(5, 3), 3);
  assert.equal(clampInventoryPage(1, 0), 1);
});
