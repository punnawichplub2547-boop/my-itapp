import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AddDeviceForm, { buildCreateDevicePayload, validateDeviceForm } from './AddDeviceForm';

test('renders the department field as a free-text input with datalist suggestions', () => {
  const markup = renderToStaticMarkup(React.createElement(AddDeviceForm, { onBack: () => undefined }));

  assert.match(markup, /<input[^>]*list="depts"[^>]*value=""[^>]*>/);
  assert.match(markup, /<datalist id="depts">/);
  assert.match(markup, /<option value="IT"><\/option>/);
});

test('renders only the admin-approved device type options', () => {
  const markup = renderToStaticMarkup(React.createElement(AddDeviceForm, { onBack: () => undefined }));

  assert.match(markup, /<option selected="">Notebook<\/option>/);
  assert.match(markup, /<option>PC<\/option>/);
  assert.match(markup, /<option>Server<\/option>/);
  assert.doesNotMatch(markup, /<option>Laptop<\/option>/);
  assert.doesNotMatch(markup, /<option>Desktop<\/option>/);
  assert.doesNotMatch(markup, /<option>Unknown<\/option>/);
});

test('removes non-admin inventory fields from the new device form', () => {
  const markup = renderToStaticMarkup(React.createElement(AddDeviceForm, { onBack: () => undefined }));

  assert.doesNotMatch(markup, /Asset No/);
  assert.doesNotMatch(markup, /Expire Date 2/);
  assert.doesNotMatch(markup, /Warranty/);
  assert.doesNotMatch(markup, /Year Value/);
  assert.doesNotMatch(markup, /OS License/);
  assert.doesNotMatch(markup, /MS Office Version/);
  assert.doesNotMatch(markup, /Notes/);
});

test('renders install and expire date fields as native date pickers', () => {
  const markup = renderToStaticMarkup(React.createElement(AddDeviceForm, { onBack: () => undefined }));

  assert.match(markup, /<input[^>]*type="date"[^>]*value=""[^>]*>/);
  assert.match(markup, /Install Date/);
  assert.match(markup, /Expire Date/);
});

test('requires a device name in add-device payloads', () => {
  assert.equal(
    validateDeviceForm({
      deviceId: '',
      department: 'IT',
      status: 'Active',
      ipMode: 'DHCP',
      ipAddress: '',
      os: 'Windows 11 Pro',
      deviceType: 'PC',
      assignedTo: '',
      model: 'OptiPlex 7000',
      hdd: '',
      ram: '',
      cpu: '',
      installDate: '',
      expireDatePrimary: '',
      expireDateSecondary: '',
      warranty: '',
      yearValue: '',
      osLicense: '',
      msOfficeVersion: '',
      notes: '',
      assetNo: '',
    } as never),
    'Device Name is required.'
  );
});

test('requires an IP address only when manual mode is selected', () => {
  assert.equal(
    validateDeviceForm({
      deviceId: 'CAR001',
      department: 'IT',
      status: 'Active',
      ipMode: 'Manual',
      ipAddress: '',
      os: 'Windows 11 Pro',
      deviceType: 'PC',
      assignedTo: '',
      model: 'OptiPlex 7000',
      hdd: '',
      ram: '',
      cpu: '',
      installDate: '',
      expireDatePrimary: '',
      expireDateSecondary: '',
      warranty: '',
      yearValue: '',
      osLicense: '',
      msOfficeVersion: '',
      notes: '',
      assetNo: '',
    } as never),
    'IP address is required when IP mode is Manual.'
  );
});

test('builds a workbook-backed device payload keyed by deviceId', () => {
  assert.deepEqual(
    buildCreateDevicePayload({
      deviceId: 'CAR200',
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
      os: '  Windows 10 Pro  ',
      status: 'Active',
      assetNo: '',
      expireDateSecondary: '',
      warranty: '',
      yearValue: '',
      osLicense: '',
      msOfficeVersion: '',
      notes: '',
    } as never),
    {
      deviceId: 'CAR200',
      assetNo: '',
      ipMode: 'DHCP',
      ipAddress: '',
      department: 'IT',
      assignedTo: 'chakrit',
      assignedEmail: '',
      deviceType: 'PC',
      model: 'OptiPlex 360',
      hdd: '500 GB',
      ram: '4',
      cpu: 'Pentium Dual-Core',
      installDate: '42971',
      expireDatePrimary: '43356',
      expireDateSecondary: '',
      warranty: '',
      yearValue: '',
      os: 'Windows 10 Pro',
      osLicense: '',
      msOfficeVersion: '',
      status: 'Active',
      notes: '',
    }
  );
});
