import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from './Dashboard';

test('renders fleet summary from provided devices instead of mock devices', () => {
  const devices = Array.from({ length: 11 }, (_, index) => ({
    deviceId: `CAR${String(index + 1).padStart(3, '0')}`,
    assetNo: String(index + 1),
    ipMode: 'DHCP' as const,
    ipAddress: '',
    department: 'IT',
    assignedTo: index === 10 ? '' : 'chakrit',
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
