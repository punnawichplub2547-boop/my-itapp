import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CreateRequestForm, {
  REPAIR_PRIORITY_OPTIONS,
  listRequestAssignees,
  listRequestDepartments,
  listRequestDeviceModels,
} from './CreateRequestForm';
import type { Device } from '../types';

const REQUEST_DEVICES: Device[] = [
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
    ram: '8 GB',
    cpu: 'Core i5',
    installDate: '2024-01-01',
    expireDatePrimary: '2025-01-01',
    expireDateSecondary: '',
    warranty: '',
    yearValue: '',
    os: 'Windows 11 Pro',
    osLicense: '',
    msOfficeVersion: '',
    status: 'Active',
    notes: '',
  },
  {
    deviceId: 'CAR002',
    assetNo: '2',
    ipMode: 'Manual',
    ipAddress: '10.0.0.11',
    department: 'IT',
    assignedTo: 'suda',
    deviceType: 'Notebook',
    model: 'ThinkBook 15',
    hdd: '512 GB',
    ram: '16 GB',
    cpu: 'Ryzen 5',
    installDate: '2024-02-01',
    expireDatePrimary: '2025-02-01',
    expireDateSecondary: '',
    warranty: '',
    yearValue: '',
    os: 'Windows 11 Pro',
    osLicense: '',
    msOfficeVersion: '',
    status: 'Active',
    notes: '',
  },
  {
    deviceId: 'CAR003',
    assetNo: '3',
    ipMode: 'DHCP',
    ipAddress: '',
    department: 'Finance',
    assignedTo: 'mali',
    deviceType: 'Server',
    model: 'PowerEdge R740',
    hdd: '2 TB',
    ram: '32 GB',
    cpu: 'Xeon Silver',
    installDate: '2024-03-01',
    expireDatePrimary: '2027-03-01',
    expireDateSecondary: '',
    warranty: '',
    yearValue: '',
    os: 'Windows Server',
    osLicense: '',
    msOfficeVersion: '',
    status: 'Active',
    notes: '',
  },
  {
    deviceId: 'CAR004',
    assetNo: '4',
    ipMode: 'DHCP',
    ipAddress: '',
    department: 'IT',
    assignedTo: 'chakrit',
    deviceType: 'PC',
    model: 'OptiPlex 360',
    hdd: '500 GB',
    ram: '8 GB',
    cpu: 'Core i5',
    installDate: '2024-01-15',
    expireDatePrimary: '2025-01-15',
    expireDateSecondary: '',
    warranty: '',
    yearValue: '',
    os: 'Windows 11 Pro',
    osLicense: '',
    msOfficeVersion: '',
    status: 'Inactive',
    notes: '',
  },
];

test('derives unique repair-request departments from inventory devices', () => {
  assert.deepEqual(listRequestDepartments(REQUEST_DEVICES), ['Finance', 'IT']);
});

test('filters repair-request device models by department', () => {
  assert.deepEqual(listRequestDeviceModels(REQUEST_DEVICES, 'IT'), ['OptiPlex 360', 'ThinkBook 15']);
  assert.deepEqual(listRequestDeviceModels(REQUEST_DEVICES, 'Finance'), ['PowerEdge R740']);
  assert.deepEqual(listRequestDeviceModels(REQUEST_DEVICES, ''), []);
});

test('filters unique assignees by department and device model', () => {
  assert.deepEqual(listRequestAssignees(REQUEST_DEVICES, 'IT', 'OptiPlex 360'), ['chakrit']);
  assert.deepEqual(listRequestAssignees(REQUEST_DEVICES, 'IT', 'ThinkBook 15'), ['suda']);
  assert.deepEqual(listRequestAssignees(REQUEST_DEVICES, 'Finance', 'PowerEdge R740'), ['mali']);
});

test('renders inventory-backed department choices and repair priority options', () => {
  const markup = renderToStaticMarkup(
    React.createElement(CreateRequestForm, { devices: REQUEST_DEVICES, onBack: () => undefined })
  );

  assert.match(markup, />Department</);
  assert.match(markup, /<option value="IT"><\/option>/);
  assert.match(markup, /<option value="Finance"><\/option>/);
  assert.match(markup, />Priority</);
  assert.match(markup, /<option>Low<\/option>/);
  assert.match(markup, /<option(?: selected="")?>Medium<\/option>/);
  assert.match(markup, /<option>High<\/option>/);
  assert.match(markup, /<option>Critical<\/option>/);
});

test('exposes the admin priority choices for repair requests', () => {
  assert.deepEqual(REPAIR_PRIORITY_OPTIONS, ['Low', 'Medium', 'High', 'Critical']);
});
