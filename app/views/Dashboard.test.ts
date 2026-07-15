import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from './Dashboard';

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

test('renders fleet summary from provided devices instead of mock devices', () => {
  const devices = Array.from({ length: 11 }, (_, index) => ({
    deviceId: `CAR${String(index + 1).padStart(3, '0')}`,
    assetNo: String(index + 1),
    ipMode: 'DHCP' as const,
    ipAddress: '',
    department: 'IT',
    assignedTo: index === 10 ? '' : 'chakrit',
    assignedEmail: '',
    deviceType: 'Notebook' as const,
    model: 'ThinkBook 15',
    hdd: '512 GB',
    ram: '8',
    cpu: 'Ryzen 5 5500U',
    installDate: '44613',
    expireDatePrimary: '2099-01-01',
    expireDateSecondary: '',
    warranty: '1',
    yearValue: '0',
    os: 'Windows 11 Pro',
    osLicense: 'OEM',
    msOfficeVersion: '2016',
    status: 'Active' as const,
    notes: '',
  }));

  const markup = renderToStaticMarkup(
    React.createElement(Dashboard, {
      onTicketClick: () => undefined,
      devices,
    })
  );

  assert.match(markup, /Total Assets[\s\S]*?<h3[^>]*>11<\/h3>/);
});

test('renders only visible warranty alerts and orders expired items before expiring soon', () => {
  const markup = renderToStaticMarkup(
    React.createElement(Dashboard, {
      onTicketClick: () => undefined,
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
          cpu: 'Ryzen 5 5500U',
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
          warrantyAlertedAt: daysAgo(1),
        },
        {
          deviceId: 'SOON200',
          assetNo: '2',
          ipMode: 'DHCP' as const,
          ipAddress: '',
          department: 'IT',
          assignedTo: 'chakrit',
          assignedEmail: '',
          deviceType: 'Notebook' as const,
          model: 'Soon Device',
          hdd: '512 GB',
          ram: '8',
          cpu: 'Ryzen 5 5500U',
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
          warrantyAlertedAt: daysAgo(2),
        },
        {
          deviceId: 'HIDE300',
          assetNo: '3',
          ipMode: 'DHCP' as const,
          ipAddress: '',
          department: 'IT',
          assignedTo: 'chakrit',
          assignedEmail: '',
          deviceType: 'Notebook' as const,
          model: 'Hidden Device',
          hdd: '512 GB',
          ram: '8',
          cpu: 'Ryzen 5 5500U',
          installDate: '44613',
          expireDatePrimary: daysFromNow(5),
          expireDateSecondary: '',
          warranty: '1',
          yearValue: '0',
          os: 'Windows 11 Pro',
          osLicense: 'OEM',
          msOfficeVersion: '2016',
          status: 'Active' as const,
          notes: '',
          warrantyAlertedAt: daysAgo(9),
        },
      ],
    })
  );

  const expiredIndex = markup.indexOf('EXP100');
  const expiringSoonIndex = markup.indexOf('SOON200');

  assert.match(markup, /Warranty Alerts[\s\S]*?>2<\/span>/);
  assert.ok(expiredIndex >= 0);
  assert.ok(expiringSoonIndex > expiredIndex);
  assert.doesNotMatch(markup, /HIDE300/);
  assert.match(markup, /Expired/);
  assert.match(markup, /Expiring Soon 10d/);
});

test('renders the warranty audit navigation button label', () => {
  const markup = renderToStaticMarkup(
    React.createElement(Dashboard, {
      onTicketClick: () => undefined,
      onOpenWarrantyAudit: () => undefined,
      devices: [],
    })
  );

  assert.match(markup, /Open Warranty Audit/);
});
