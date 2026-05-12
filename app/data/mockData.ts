/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepairTicket, ReportEntry, EmailNotification } from '../types';

export const MOCK_TICKETS: RepairTicket[] = [
  { id: 'TK-4521', deviceName: 'MacBook Pro 16"', employeeName: 'Mark T.', employeeEmail: 'mark.t@enterprise.com', department: 'Engineering', problemType: 'Hardware Failure', description: 'Screen flickering after 2 hours of use.', status: 'In Progress', priority: 'High', createdAt: '2h ago' },
  { id: 'TK-4510', deviceName: 'Dell R740', employeeName: 'Sarah L.', employeeEmail: 'sarah.l@enterprise.com', department: 'Operations', problemType: 'Hardware Failure', description: 'PSU Failure on backup node.', status: 'Waiting for Parts', priority: 'Critical', createdAt: '5h ago' },
  { id: 'TK-4532', deviceName: 'HP Laserjet', employeeName: 'Admin Office', employeeEmail: 'admin@enterprise.com', department: 'Internal', problemType: 'Maintenance', description: 'Persistent paper jam in tray 2.', status: 'Pending', priority: 'Medium', createdAt: '1d ago' },
  { id: 'TK-4498', deviceName: 'iPhone 13', employeeName: 'John D.', employeeEmail: 'john.d@enterprise.com', department: 'Sales', problemType: 'Battery', description: 'Battery replacement needed.', status: 'Completed', priority: 'Low', createdAt: '2d ago' },
];

export const MOCK_REPORTS: ReportEntry[] = [
  { id: '1', summary: 'ติดตั้งเครื่องสำหรับเช็ค slip', description: 'ติดตั้งเครื่อง PC เรียบร้อย', created: '3/19/2026', createdBy: 'chakrit@car-1996.com', status: 'closed' },
  { id: '2', summary: 'set notebook admin forming', description: 'set notebook เรียบร้อย', created: '3/19/2026', createdBy: 'chakrit@car-1996.com', status: 'closed' },
  { id: '3', summary: 'เครื่อง computer เปิดไม่ติด', description: 'ทำความสะอาด RAM', created: '20/03/2026', createdBy: 'finishing@car-1996.com', status: 'closed' },
  { id: '4', summary: 'เครื่อง K.Chagkrit เปิดอีเมลไม่ได้', description: 'พื้นที่ในไดรฟ์ D ไม่เพียงพอ', created: '20/03/2026', createdBy: 'markeitng1@car-1996.com', status: 'closed' },
  { id: '5', summary: 'Recheck Data inventory', description: 'Recheck Data Inventory ทั้งหมด', created: '23/03/2026', createdBy: 'chakrit@car-1996.com', status: 'closed' },
  { id: '6', summary: 'เพิ่ม RAM เครื่อง K.Tanomnuan(RD)', description: 'เพิ่ม RAM เป็น 8GB', created: '23/03/2026', createdBy: 'chakrit@car-1996.com', status: 'closed' },
  { id: '7', summary: 'Notebook admin forming login ไม่ได้', description: 'rejoin domain', created: '3/24/2026', createdBy: 'forming@car-1996.com', status: 'closed' },
  { id: '10', summary: 'ขอเข้าใช้หน้าจอ ItemlotLocation', description: 'แก้ไขสิทธิ์เข้าใช้หน้าจอ ItemlotLocation', created: '3/26/2026', createdBy: 'chonticha@car-1996.com', status: 'closed' },
  { id: '11', summary: 'set meeting room', description: 'set meeting room for ENG', created: '3/26/2026', createdBy: 'chakrit@car-1996.com', status: 'closed' },
  { id: '12', summary: 'แจ้ง Install Certificate ระบบ TNS', description: 'Install certificate เรียบร้อย', created: '27/03/2026', createdBy: 'markeitng@car-1996.com', status: 'closed' },
  { id: '13', summary: 'ติดตั้งเครื่อง PC สำหรับ Print Tag (Extruder)', description: 'ติดตั้งเครื่อง PC เรียบร้อย', created: '27/03/2026', createdBy: 'panisara@car-1996.com', status: 'closed' },
  { id: '14', summary: 'เข้าใช้งาน Outlook ไม่ได้', description: 'Update Outlook ใช้งานได้ปกติ', created: '27/03/2026', createdBy: 'warit@car-1996.com', status: 'closed' },
];

export const MOCK_NOTIFICATIONS: EmailNotification[] = [
  {
    id: 'EN-001',
    ticketId: 'TK-4521',
    employeeName: 'Mark Thompson',
    employeeEmail: 'mark.t@enterprise.com',
    notificationType: 'Repair Request Created',
    subject: 'Repair Request Received: TK-4521',
    message: 'Hello Mark,\n\nWe have received your repair request for MacBook Pro 16". Our team is currently reviewing it.\n\nTicket ID: TK-4521\nStatus: Pending',
    ticketStatus: 'Pending',
    deliveryStatus: 'Delivered',
    sentAt: '2026-05-08 09:12 AM',
    sentByAdmin: 'Admin Infrastructure'
  },
  {
    id: 'EN-002',
    ticketId: 'TK-4521',
    employeeName: 'Mark Thompson',
    employeeEmail: 'mark.t@enterprise.com',
    notificationType: 'Status Updated',
    subject: 'Repair Status Updated: TK-4521',
    message: 'Hello Mark,\n\nYour repair ticket TK-4521 has been updated to "In Progress".\n\nNotes from Technician: Screen part ordered.',
    ticketStatus: 'In Progress',
    deliveryStatus: 'Sent',
    sentAt: '2026-05-08 11:40 AM',
    sentByAdmin: 'Admin Infrastructure'
  },
  {
    id: 'EN-003',
    ticketId: 'TK-4510',
    employeeName: 'Sarah Jenkins',
    employeeEmail: 'sarah.j@car-1996.com',
    notificationType: 'Waiting for Parts',
    subject: 'Waiting for Parts: TK-4510',
    message: 'Hello Sarah,\n\nYour repair ticket TK-4510 is currently waiting for parts (PSU Module).\n\nEstimated arrival: 3 days.',
    ticketStatus: 'Waiting for Parts',
    deliveryStatus: 'Delivered',
    sentAt: '2026-05-08 02:15 PM',
    sentByAdmin: 'IT Operations'
  },
  {
    id: 'EN-004',
    ticketId: 'TK-4498',
    employeeName: 'John Doe',
    employeeEmail: 'john.d@enterprise.com',
    notificationType: 'Repair Completed',
    subject: 'Action Required: Repair Completed TK-4498',
    message: 'Hello John,\n\nYour iPhone 13 repair is complete. Please pick up your device at the IT desk.',
    ticketStatus: 'Completed',
    deliveryStatus: 'Failed',
    sentAt: '2026-05-07 10:00 AM',
    sentByAdmin: 'Admin Infrastructure'
  },
  {
    id: 'EN-005',
    ticketId: 'TK-4532',
    employeeName: 'Admin Office',
    employeeEmail: 'admin@enterprise.com',
    notificationType: 'Repair Request Created',
    subject: 'Repair Request Received: TK-4532',
    message: 'Hello Admin Office,\n\nWe have received your repair request for HP Laserjet. Our team is currently reviewing it.\n\nTicket ID: TK-4532\nStatus: Pending',
    ticketStatus: 'Pending',
    deliveryStatus: 'Pending',
    sentAt: '2026-05-08 04:50 PM',
    sentByAdmin: 'IT Operations'
  }
];
