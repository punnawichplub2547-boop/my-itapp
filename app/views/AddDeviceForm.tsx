"use client";

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Laptop,
  Loader2,
} from 'lucide-react';
import { DEVICE_DEPARTMENTS } from '../data/departments';
import type { Device, DeviceStatus, DeviceType, IpMode } from '../types';

const DEVICE_STATUS_OPTIONS: DeviceStatus[] = ['Active', 'Inactive', 'Out of Service'];
const DEVICE_TYPE_OPTIONS: DeviceType[] = [
  'Notebook',
  'PC',
  'Server',
];
const IP_MODE_OPTIONS: IpMode[] = ['Manual', 'DHCP'];

export interface AddDeviceFormValues {
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
}

function createInitialValues(): AddDeviceFormValues {
  return {
    deviceId: '',
    assetNo: '',
    ipMode: 'DHCP',
    ipAddress: '',
    department: '',
    assignedTo: '',
    deviceType: 'Notebook',
    model: '',
    hdd: '',
    ram: '',
    cpu: '',
    installDate: '',
    expireDatePrimary: '',
    expireDateSecondary: '',
    warranty: '',
    yearValue: '',
    os: '',
    osLicense: '',
    msOfficeVersion: '',
    status: 'Active',
    notes: '',
  };
}

export function validateDeviceForm(values: AddDeviceFormValues) {
  if (!values.deviceId.trim()) {
    return 'Device ID is required.';
  }

  if (!values.department.trim()) {
    return 'Department is required.';
  }

  if (!values.os.trim()) {
    return 'Operating system is required.';
  }

  if (values.ipMode === 'Manual' && !values.ipAddress.trim()) {
    return 'IP address is required when IP mode is Manual.';
  }

  return '';
}

export function buildCreateDevicePayload(values: AddDeviceFormValues) {
  return {
    deviceId: values.deviceId.trim(),
    assetNo: values.assetNo.trim(),
    ipMode: values.ipMode,
    ipAddress: values.ipMode === 'Manual' ? values.ipAddress.trim() : '',
    department: values.department.trim(),
    assignedTo: values.assignedTo.trim(),
    deviceType: values.deviceType,
    model: values.model.trim(),
    hdd: values.hdd.trim(),
    ram: values.ram.trim(),
    cpu: values.cpu.trim(),
    installDate: values.installDate.trim(),
    expireDatePrimary: values.expireDatePrimary.trim(),
    expireDateSecondary: values.expireDateSecondary.trim(),
    warranty: values.warranty.trim(),
    yearValue: values.yearValue.trim(),
    os: values.os.trim(),
    osLicense: values.osLicense.trim(),
    msOfficeVersion: values.msOfficeVersion.trim(),
    status: values.status,
    notes: values.notes.trim(),
  };
}

export default function AddDeviceForm({
  onBack,
  onDeviceCreated,
}: {
  onBack: () => void;
  onDeviceCreated?: (device: Device) => void;
}) {
  const [values, setValues] = useState<AddDeviceFormValues>(createInitialValues);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField<K extends keyof AddDeviceFormValues>(field: K, value: AddDeviceFormValues[K]) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
  }

  function handleTextInput(
    field: keyof AddDeviceFormValues,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setField(field, event.target.value as AddDeviceFormValues[keyof AddDeviceFormValues]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateDeviceForm(values);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildCreateDevicePayload(values)),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? 'Unable to save this device.');
        return;
      }

      onDeviceCreated?.(result.device);
      setSuccess(`Device ${result.device.deviceId} was saved to the database.`);
      setValues(createInitialValues());
    } catch {
      setError('Unable to reach the device database API.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-xl p-2 text-primary transition-colors hover:bg-surface-container"
        >
          <ArrowLeft />
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Add New Device</h2>
          <p className="font-medium text-secondary">
            Register a workbook-backed IT asset in the shared device inventory.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12" noValidate>
        <div className="space-y-6 lg:col-span-8">
          <section className="space-y-8 rounded-2xl border border-outline-variant bg-white p-8 shadow-sm">
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-outline-variant/50 pb-2">
                <Laptop className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-primary">Core Identity</h3>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field label="Device ID">
                  <input
                    value={values.deviceId}
                    onChange={(event) => handleTextInput('deviceId', event)}
                    placeholder="e.g. CAR200"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm font-mono outline-none transition-all focus:border-primary"
                  />
                </Field>
                <Field label="Device Type">
                  <select
                    value={values.deviceType}
                    onChange={(event) => setField('deviceType', event.target.value as DeviceType)}
                    className="w-full appearance-none rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    {DEVICE_TYPE_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Model">
                  <input
                    value={values.model}
                    onChange={(event) => handleTextInput('model', event)}
                    placeholder="e.g. OptiPlex 360"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                  />
                </Field>
                <Field label="Device Status">
                  <select
                    value={values.status}
                    onChange={(event) => setField('status', event.target.value as DeviceStatus)}
                    className="w-full appearance-none rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    {DEVICE_STATUS_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned To">
                  <input
                    value={values.assignedTo}
                    onChange={(event) => handleTextInput('assignedTo', event)}
                    placeholder="User logon or blank"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-outline-variant/50 pb-2">
                <Cpu className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-primary">Hardware And Software</h3>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field label="Operating System">
                  <input
                    value={values.os}
                    onChange={(event) => handleTextInput('os', event)}
                    placeholder="e.g. Windows 11 Pro"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                  />
                </Field>
                <Field label="CPU">
                  <input
                    value={values.cpu}
                    onChange={(event) => handleTextInput('cpu', event)}
                    placeholder="e.g. Ryzen 5 5500U"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                  />
                </Field>
                <Field label="RAM">
                  <input
                    value={values.ram}
                    onChange={(event) => handleTextInput('ram', event)}
                    placeholder="e.g. 8"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                  />
                </Field>
                <Field label="HDD">
                  <input
                    value={values.hdd}
                    onChange={(event) => handleTextInput('hdd', event)}
                    placeholder="e.g. 500 GB"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="space-y-6 rounded-2xl border border-outline-variant bg-white p-8 shadow-sm">
            <h3 className="font-bold text-primary">Lifecycle Metadata</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label="Install Date">
                <input
                  type="date"
                  value={values.installDate}
                  onChange={(event) => handleTextInput('installDate', event)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                />
              </Field>
              <Field label="Expire Date">
                <input
                  type="date"
                  value={values.expireDatePrimary}
                  onChange={(event) => handleTextInput('expireDatePrimary', event)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm outline-none transition-all focus:border-primary"
                />
              </Field>
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <section className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-6 shadow-sm">
            <h3 className="font-bold text-primary">Network And Department</h3>
            <Field label="Department">
              <input
                list="depts"
                type="text"
                value={values.department}
                onChange={(event) => handleTextInput('department', event)}
                placeholder="Choose or enter department"
                className="w-full appearance-none rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <datalist id="depts">
                {DEVICE_DEPARTMENTS.map((departmentOption) => (
                  <option key={departmentOption} value={departmentOption} />
                ))}
              </datalist>
            </Field>
            <Field label="IP Mode">
              <select
                value={values.ipMode}
                onChange={(event) => {
                  const nextIpMode = event.target.value as IpMode;
                  setField('ipMode', nextIpMode);

                  if (nextIpMode === 'DHCP') {
                    setField('ipAddress', '');
                  }
                }}
                className="w-full appearance-none rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
              >
                {IP_MODE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            {values.ipMode === 'Manual' && (
              <Field label="IP Address">
                <input
                  type="text"
                  value={values.ipAddress}
                  onChange={(event) => handleTextInput('ipAddress', event)}
                  placeholder="e.g. 10.10.10.25"
                  className="w-full rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
                />
              </Field>
            )}
          </section>

          <div className="space-y-6 rounded-2xl bg-primary-container p-6 text-white shadow-xl">
            <h4 className="font-bold leading-tight">Finalize Entry</h4>
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-white/95 px-4 py-3 text-xs font-bold text-error">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-white/95 px-4 py-3 text-xs font-bold text-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-bold text-primary shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    Saving Asset <Loader2 className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  'Save Asset to Database'
                )}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full rounded-xl border border-white/20 py-3 font-medium text-white transition-all hover:bg-white/5"
              >
                Discard Changes
              </button>
            </div>
            <p className="text-center text-[10px] leading-relaxed text-primary-fixed-dim/70">
              Saved devices are returned through the shared `/api/devices` contract and appear in
              inventory immediately.
            </p>
          </div>
        </div>
      </form>
    </motion.div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="pl-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}
