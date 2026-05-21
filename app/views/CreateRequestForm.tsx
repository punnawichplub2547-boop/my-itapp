"use client";

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Ticket, Laptop, ArrowLeft, Send, User, AlertCircle } from 'lucide-react';
import type { Device, RepairTicket } from '../types';

const PROBLEM_TYPE_OPTIONS = ['Hardware Failure', 'Software Bug', 'Physical Damage', 'Maintenance'];
export const REPAIR_PRIORITY_OPTIONS: RepairTicket['priority'][] = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

function uniqueSortedValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));
}

export function listRequestDepartments(devices: Device[]) {
  return uniqueSortedValues(devices.map((device) => device.department));
}

export function listRequestDeviceNames(devices: Device[], department: string) {
  return uniqueSortedValues(
    devices
      .filter((device) => !department.trim() || device.department === department)
      .map((device) => device.deviceId)
  );
}

export function listRequestAssignees(devices: Device[], department: string, deviceName: string) {
  if (!department.trim() || !deviceName.trim()) {
    return [];
  }

  return uniqueSortedValues(
    devices
      .filter((device) => device.department === department && device.deviceId === deviceName)
      .map((device) => device.assignedTo)
  );
}

export function getRequestDeviceModel(devices: Device[], department: string, deviceName: string) {
  return findRequestDeviceByName(devices, department, deviceName)?.model ?? '';
}

function findRequestDeviceByName(devices: Device[], department: string, deviceName: string) {
  const normalizedDeviceName = deviceName.trim();

  if (!normalizedDeviceName) {
    return null;
  }

  return (
    devices.find(
      (device) =>
        device.deviceId === normalizedDeviceName &&
        (!department.trim() || device.department === department)
    ) ?? null
  );
}

export default function CreateRequestForm({
  devices = [],
  tickets = [],
  onBack,
  onTicketCreated,
}: {
  devices?: Device[];
  tickets?: RepairTicket[];
  onBack: () => void;
  onTicketCreated?: (ticket: RepairTicket) => void;
}) {
  const [department, setDepartment] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [selectedInventoryDeviceId, setSelectedInventoryDeviceId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [problemType, setProblemType] = useState(PROBLEM_TYPE_OPTIONS[0]);
  const [priority, setPriority] = useState<RepairTicket['priority']>('Medium');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const openTickets = tickets.filter(t => t.status !== 'Completed' && t.status !== 'Closed');
  const criticalOpenTickets = openTickets.filter(t => t.priority === 'Critical');
  const featuredTicket = criticalOpenTickets[0] ?? openTickets[0] ?? null;

  const departmentSuggestions = useMemo(() => listRequestDepartments(devices), [devices]);

  const deviceNameSuggestions = useMemo(
    () => listRequestDeviceNames(devices, department),
    [devices, department]
  );

  const selectedInventoryDevice = useMemo(
    () => findRequestDeviceByName(devices, department, deviceName),
    [devices, department, deviceName]
  );

  const assigneeSuggestions = useMemo(
    () => listRequestAssignees(devices, department, deviceName),
    [devices, department, deviceName]
  );

  function handleDepartmentChange(value: string) {
    setDepartment(value);
    setDeviceName('');
    setAssignedTo('');
    setSelectedInventoryDeviceId(null);
  }

  function handleDeviceNameChange(value: string) {
    setDeviceName(value);
    const matchedDevice = findRequestDeviceByName(devices, department, value);

    if (matchedDevice) {
      // Unique inventory device identified — capture its ID for confirmed ticket linking
      setSelectedInventoryDeviceId(matchedDevice.deviceId);

      if (!department.trim() && matchedDevice.department) {
        setDepartment(matchedDevice.department);
      }

      if (!assignedTo && matchedDevice.assignedTo) {
        setAssignedTo(matchedDevice.assignedTo);
      }
    } else {
      setSelectedInventoryDeviceId(null);
    }
  }

  async function handleSubmit() {
    setSubmitError(null);

    const payload = {
      deviceId: selectedInventoryDeviceId ?? undefined,
      deviceName: deviceName.trim(),
      employeeName: assignedTo.trim(),
      employeeEmail: employeeEmail.trim(),
      department: department.trim(),
      problemType: problemType.trim(),
      description: description.trim(),
      priority,
    };

    console.log('[CreateRequest] Submitting payload:', payload);

    if (
      !payload.deviceName ||
      !payload.employeeName ||
      !payload.employeeEmail ||
      !payload.department ||
      !payload.problemType ||
      !payload.description
    ) {
      setSubmitError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitError(result.error ?? 'Failed to create ticket. Please try again.');
        return;
      }

      onTicketCreated?.(result.ticket as RepairTicket);
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const comboInputClass =
    'w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:bg-white outline-none focus:border-primary transition-all';

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-surface-container rounded-xl transition-colors text-primary"><ArrowLeft /></button>
        <div>
          <h2 className="text-3xl font-bold text-primary tracking-tight">Create Repair Request</h2>
          <p className="text-secondary font-medium">Submit a new maintenance or repair ticket.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-outline-variant rounded-2xl p-8 shadow-sm space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-outline-variant/50 pb-2">
                <User className="text-primary w-5 h-5" />
                <h3 className="font-bold text-primary">Employee Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Department</label>
                  <input
                    type="text"
                    list="department-options"
                    value={department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    placeholder="Select or type a department"
                    className={comboInputClass}
                  />
                  <datalist id="department-options">
                    {departmentSuggestions.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Assigned To</label>
                  <input
                    type="text"
                    list="assignee-options"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="Select or type an employee name"
                    className={comboInputClass}
                  />
                  <datalist id="assignee-options">
                    {assigneeSuggestions.map(a => <option key={a} value={a} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Employee Email</label>
                  <input
                    value={employeeEmail}
                    onChange={(event) => setEmployeeEmail(event.target.value)}
                    placeholder="jane.doe@enterprise.com"
                    className={comboInputClass}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-outline-variant/50 pb-2">
                <Laptop className="text-primary w-5 h-5" />
                <h3 className="font-bold text-primary">Request Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Device Name</label>
                  <input
                    type="text"
                    list="device-name-options"
                    value={deviceName}
                    onChange={(e) => handleDeviceNameChange(e.target.value)}
                    placeholder="Select or type a device name"
                    className={comboInputClass}
                  />
                  <datalist id="device-name-options">
                    {deviceNameSuggestions.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Device Model</label>
                  <input
                    value={selectedInventoryDevice?.model ?? ''}
                    readOnly
                    placeholder="Select a device name to show its model"
                    className={`${comboInputClass} cursor-default text-secondary`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Problem Type</label>
                  <select
                    value={problemType}
                    onChange={(event) => setProblemType(event.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm outline-none focus:border-primary appearance-none"
                  >
                    {PROBLEM_TYPE_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as RepairTicket['priority'])}
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm outline-none focus:border-primary appearance-none"
                  >
                    {REPAIR_PRIORITY_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-widest pl-1">Problem Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Detailed explanation of the issue..."
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:bg-white outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 text-error text-sm font-medium bg-error/5 border border-error/20 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="shrink-0" />
                {submitError}
              </div>
            )}
            <div className="pt-6 border-t border-outline-variant flex justify-end gap-4">
              <button onClick={onBack} disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-secondary hover:bg-surface-container rounded-xl transition-all disabled:opacity-50">Discard</button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-10 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send size={16} /> {isSubmitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <section className="bg-primary-container text-white rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 space-y-6">
              <h3 className="font-bold text-on-primary-container flex items-center gap-2">
                <Ticket className="w-5 h-5 text-on-primary-container" /> Active Repair Queue
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-xl text-center border border-white/5">
                  <p className="text-[9px] font-bold text-on-primary-container uppercase tracking-widest mb-1">Open Tickets</p>
                  <p className="text-3xl font-bold">{openTickets.length}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-xl text-center border border-white/5">
                  <p className="text-[9px] font-bold text-on-primary-container uppercase tracking-widest mb-1">Critical</p>
                  <p className="text-3xl font-bold text-error">{criticalOpenTickets.length}</p>
                </div>
              </div>
              <div className="space-y-2">
                {featuredTicket ? (
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 group hover:bg-white/10 cursor-pointer transition-all">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-mono font-bold text-on-primary-container">{featuredTicket.id}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${featuredTicket.priority === 'Critical' ? 'bg-error text-white' : 'bg-white/20 text-white'}`}>
                        {featuredTicket.priority}
                      </span>
                    </div>
                    <p className="text-xs font-bold truncate">{featuredTicket.description.split('.')[0]}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-on-primary-container/60 italic text-center py-2">No open tickets in the queue.</p>
                )}
              </div>
              <button onClick={onBack} className="w-full text-center py-2 text-[10px] font-bold uppercase tracking-widest text-on-primary-container hover:text-white transition-colors">View Dashboard →</button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
