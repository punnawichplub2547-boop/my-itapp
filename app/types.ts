/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AssignmentEntry {
  id: string;
  userName: string;
  userEmail: string;
  department: string;
  assignedAt: string;
  returnedAt?: string;
  notes?: string;
}

export type DeviceType = 'Laptop' | 'PC' | 'Server' | 'Notebook' | 'Desktop' | 'Unknown';
export type DeviceStatus = 'Active' | 'Inactive' | 'Out of Service';
export type IpMode = 'Manual' | 'DHCP';

export interface DeviceAssignee {
  name: string;
  email: string;
  department: string;
}

export interface Device {
  deviceId: string;
  assetNo: string;
  ipMode: IpMode;
  ipAddress: string;
  department: string;
  assignedTo: string;
  deviceType: DeviceType;
  model: string;
  hdd: string;
  ram: string;
  cpu: string;
  installDate: string;
  expireDatePrimary: string;
  expireDateSecondary: string;
  warranty: string;
  yearValue: string;
  os: string;
  osLicense: string;
  msOfficeVersion: string;
  status: DeviceStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TicketNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface TicketHistoryEvent {
  id: string;
  action: string;
  user: string;
  timestamp: string;
}

export interface RepairTicket {
  id: string;
  deviceName: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  problemType: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Waiting for Parts' | 'Completed' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt: string;
  notes?: TicketNote[];
  history?: TicketHistoryEvent[];
  attachments?: string[];
}

export type ViewType = 'dashboard' | 'inventory' | 'tickets' | 'create-request' | 'add-device' | 'reports' | 'login';

export interface ReportEntry {
  id: string;
  summary: string;
  description: string;
  created: string;
  createdBy: string;
  status: string;
}

export type DeliveryStatus = 'Sent' | 'Delivered' | 'Failed' | 'Pending';
export type NotificationType = 'Repair Request Created' | 'Status Updated' | 'Waiting for Parts' | 'Repair Completed' | 'Ticket Closed';

export interface EmailNotification {
  id: string;
  ticketId: string;
  employeeName: string;
  employeeEmail: string;
  notificationType: NotificationType;
  subject: string;
  message: string;
  ticketStatus: RepairTicket['status'];
  deliveryStatus: DeliveryStatus;
  sentAt: string;
  sentByAdmin: string;
}
