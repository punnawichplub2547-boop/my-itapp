import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WarrantyAuditView from './WarrantyAuditView';

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test('renders read-only warranty audit metrics and rows from provided devices', () => {
  const markup = renderToStaticMarkup(
    React.createElement(WarrantyAuditView, {
      onBack: () => undefined,
      onOpenDevice: () => undefined,
      devices: [
        {
          deviceId: 'EXP100',
          assetNo: '1',
          ipMode: 'DHCP' as const,
          ipAddress: '',
          department: 'IT',
          assignedTo: 'chakrit',
          assignedEmail: '',
          deviceType: 'Notebook' as const,
          model: 'Expired Device',
          hdd: '512 GB',
          ram: '8',
          cpu: 'Ryzen 5',
          installDate: '44613',
          expireDatePrimary: daysFromNow(-2),
          expireDateSecondary: '',
          warranty: '1',
          yearValue: '0',
          os: 'Windows 11 Pro',
          osLicense: 'OEM',
          msOfficeVersion: '2016',
          status: 'Active' as const,
          notes: '',
        },
        {
          deviceId: 'SOON200',
          assetNo: '2',
          ipMode: 'DHCP' as const,
          ipAddress: '',
          department: 'Finance',
          assignedTo: 'mali',
          assignedEmail: '',
          deviceType: 'PC' as const,
          model: 'Soon Device',
          hdd: '512 GB',
          ram: '8',
          cpu: 'Intel i5',
          installDate: '44613',
          expireDatePrimary: daysFromNow(10),
          expireDateSecondary: '',
          warranty: '1',
          yearValue: '0',
          os: 'Windows 11 Pro',
          osLicense: 'OEM',
          msOfficeVersion: '2016',
          status: 'Active' as const,
          notes: '',
        },
        {
          deviceId: 'MISS300',
          assetNo: '3',
          ipMode: 'DHCP' as const,
          ipAddress: '',
          department: 'HR',
          assignedTo: '',
          assignedEmail: '',
          deviceType: 'Server' as const,
          model: 'Missing Warranty',
          hdd: '1 TB',
          ram: '16',
          cpu: 'Xeon',
          installDate: '44613',
          expireDatePrimary: '',
          expireDateSecondary: '',
          warranty: '1',
          yearValue: '0',
          os: 'Windows Server',
          osLicense: 'OEM',
          msOfficeVersion: '2019',
          status: 'Active' as const,
          notes: '',
        },
      ],
    })
  );

  assert.match(markup, /Warranty Audit Center/);
  assert.match(markup, /Read-only review of expired and upcoming warranty risks/);
  assert.match(markup, /Flagged[\s\S]*?>2</);
  assert.match(markup, /Expired[\s\S]*?>1</);
  assert.match(markup, /Expiring Soon[\s\S]*?>1</);
  assert.match(markup, /Missing Warranty Date[\s\S]*?>1</);
  assert.match(markup, /EXP100/);
  assert.match(markup, /SOON200/);
  assert.match(markup, /MISS300/);
  assert.match(markup, /Open in Inventory/);
});
