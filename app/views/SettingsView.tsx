"use client";

import { useState, useTransition, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  Building2,
  AlertTriangle,
  Laptop,
  Mail,
  ShieldAlert,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import type { SystemSettings } from '../types';
import { DEFAULT_SYSTEM_SETTINGS } from '../lib/settings/settingsDefaults';

interface SettingsViewProps {
  initialSettings?: SystemSettings;
  onSettingsUpdated?: (settings: SystemSettings) => void;
}

type TabType = 'master-data' | 'notifications' | 'rules' | 'backup';

export default function SettingsView({
  initialSettings,
  onSettingsUpdated,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('master-data');
  const [settings, setSettings] = useState<SystemSettings>(
    initialSettings ?? DEFAULT_SYSTEM_SETTINGS
  );

  // New item inputs
  const [newDepartment, setNewDepartment] = useState('');
  const [newProblemType, setNewProblemType] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Status and feedback
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  function handleSave(updatedSettings: SystemSettings = settings) {
    setSaveStatus('idle');
    setStatusMessage('');

    startTransition(async () => {
      try {
        const response = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: updatedSettings }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? 'Failed to save settings');
        }

        setSettings(result.settings);
        onSettingsUpdated?.(result.settings);
        setSaveStatus('success');
        setStatusMessage('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
        setTimeout(() => setSaveStatus('idle'), 4000);
      } catch (error) {
        setSaveStatus('error');
        setStatusMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึก');
      }
    });
  }

  function handleResetToDefaults() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/settings/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? 'Failed to reset settings');
        }

        setSettings(result.settings);
        onSettingsUpdated?.(result.settings);
        setShowResetConfirm(false);
        setSaveStatus('success');
        setStatusMessage('คืนค่าเริ่มต้นโรงงานเรียบร้อยแล้ว');
        setTimeout(() => setSaveStatus('idle'), 4000);
      } catch (error) {
        setSaveStatus('error');
        setStatusMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการรีเซ็ต');
      }
    });
  }

  function handleExportJson() {
    const jsonStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `repairlink-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          const imported = { ...settings, ...parsed };
          setSettings(imported);
          handleSave(imported);
        }
      } catch {
        setSaveStatus('error');
        setStatusMessage('ไฟล์ JSON ไม่ถูกต้อง');
      }
    };
    reader.readAsText(file);
  }

  // Master Data Add/Delete helpers
  function addDepartment() {
    const val = newDepartment.trim();
    if (!val || settings.departments.includes(val)) return;
    const updated = { ...settings, departments: [...settings.departments, val].sort() };
    setSettings(updated);
    setNewDepartment('');
    handleSave(updated);
  }

  function removeDepartment(target: string) {
    if (settings.departments.length <= 1) return;
    const updated = { ...settings, departments: settings.departments.filter(d => d !== target) };
    setSettings(updated);
    handleSave(updated);
  }

  function addProblemType() {
    const val = newProblemType.trim();
    if (!val || settings.problemTypes.includes(val)) return;
    const updated = { ...settings, problemTypes: [...settings.problemTypes, val] };
    setSettings(updated);
    setNewProblemType('');
    handleSave(updated);
  }

  function removeProblemType(target: string) {
    if (settings.problemTypes.length <= 1) return;
    const updated = { ...settings, problemTypes: settings.problemTypes.filter(p => p !== target) };
    setSettings(updated);
    handleSave(updated);
  }

  function addDeviceType() {
    const val = newDeviceType.trim();
    if (!val || settings.deviceTypes.includes(val)) return;
    const updated = { ...settings, deviceTypes: [...settings.deviceTypes, val] };
    setSettings(updated);
    setNewDeviceType('');
    handleSave(updated);
  }

  function removeDeviceType(target: string) {
    if (settings.deviceTypes.length <= 1) return;
    const updated = { ...settings, deviceTypes: settings.deviceTypes.filter(d => d !== target) };
    setSettings(updated);
    handleSave(updated);
  }

  function addEmail() {
    const val = newEmail.trim().toLowerCase();
    if (!val || !val.includes('@') || settings.notificationEmails.includes(val)) return;
    const updated = { ...settings, notificationEmails: [...settings.notificationEmails, val] };
    setSettings(updated);
    setNewEmail('');
    handleSave(updated);
  }

  function removeEmail(target: string) {
    const updated = { ...settings, notificationEmails: settings.notificationEmails.filter(e => e !== target) };
    setSettings(updated);
    handleSave(updated);
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                ตั้งค่าระบบ (System Settings)
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Low-Code Config
                </span>
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                จัดการตัวเลือก Master Data, แผนก, ประเภทปัญหา, และระบบแจ้งเตือนโดยไม่ต้องแก้ไขโค้ด
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSave(settings)}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <AnimatePresence>
        {saveStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 font-medium text-sm shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{statusMessage || 'บันทึกการตั้งค่าเรียบร้อยแล้ว'}</span>
          </motion.div>
        )}
        {saveStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 font-medium text-sm shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{statusMessage || 'เกิดข้อผิดพลาดในการบันทึก'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('master-data')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all shrink-0 ${
            activeTab === 'master-data'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Master Data & ตัวเลือก Dropdown
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all shrink-0 ${
            activeTab === 'notifications'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          ระบบแจ้งเตือน (Notifications)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all shrink-0 ${
            activeTab === 'rules'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          เงื่อนไขประกัน & ระบบ
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all shrink-0 ${
            activeTab === 'backup'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          สำรองข้อมูล & คืนค่า (Backup / Reset)
        </button>
      </div>

      {/* Tab 1: Master Data */}
      {activeTab === 'master-data' && (
        <div className="space-y-6">
          {/* Section: Departments */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  รายชื่อแผนก (Departments)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  รายการแผนกที่จะแสดงในตัวเลือกการแจ้งซ่อมและข้อมูลอุปกรณ์ ({settings.departments.length} แผนก)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
                placeholder="พิมพ์ชื่อแผนกใหม่ เช่น EN, HR, IT..."
                className="flex-1 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={addDepartment}
                disabled={!newDepartment.trim()}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                เพิ่มแผนก
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {settings.departments.map((dept) => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-700 font-semibold text-xs transition-all hover:bg-slate-200/60"
                >
                  <span>{dept}</span>
                  <button
                    type="button"
                    onClick={() => removeDepartment(dept)}
                    title={`ลบแผนก ${dept}`}
                    className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Section: Problem Types */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ประเภทปัญหาแจ้งซ่อม (Problem Types)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  ตัวเลือกประเภทปัญหาในหน้าสร้างคำขอแจ้งซ่อม ({settings.problemTypes.length} ประเภท)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newProblemType}
                onChange={(e) => setNewProblemType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProblemType()}
                placeholder="พิมพ์ประเภทปัญหาใหม่ เช่น Network Issue, Printer..."
                className="flex-1 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={addProblemType}
                disabled={!newProblemType.trim()}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                เพิ่มประเภทปัญหา
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {settings.problemTypes.map((prob) => (
                <span
                  key={prob}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 font-semibold text-xs transition-all hover:bg-amber-100"
                >
                  <span>{prob}</span>
                  <button
                    type="button"
                    onClick={() => removeProblemType(prob)}
                    title={`ลบประเภท ${prob}`}
                    className="p-0.5 text-amber-400 hover:text-rose-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Section: Device Types */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-indigo-600" />
                  ประเภทอุปกรณ์ (Device Types)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  รายการประเภทอุปกรณ์ในหน้าเพิ่มอุปกรณ์และบันทึกทรัพย์สิน ({settings.deviceTypes.length} ประเภท)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newDeviceType}
                onChange={(e) => setNewDeviceType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDeviceType()}
                placeholder="พิมพ์ประเภทอุปกรณ์ใหม่ เช่น Tablet, Mac, All-in-One..."
                className="flex-1 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={addDeviceType}
                disabled={!newDeviceType.trim()}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                เพิ่มประเภทอุปกรณ์
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {settings.deviceTypes.map((dev) => (
                <span
                  key={dev}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200 text-indigo-900 font-semibold text-xs transition-all hover:bg-indigo-100"
                >
                  <span>{dev}</span>
                  <button
                    type="button"
                    onClick={() => removeDeviceType(dev)}
                    title={`ลบประเภท ${dev}`}
                    className="p-0.5 text-indigo-400 hover:text-rose-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              อีเมลผู้รับแจ้งเตือนระบบ (Notification Recipients)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              อีเมลทีม IT หรือผู้รับผิดชอบที่จะได้รับการแจ้งเตือนอัตโนมัติเมื่อมีการเปิดคำขอซ่อมใหม่
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              placeholder="กรอกอีเมล เช่น it-support@car-1996.com..."
              className="flex-1 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
            <button
              type="button"
              onClick={addEmail}
              disabled={!newEmail.trim() || !newEmail.includes('@')}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              เพิ่มอีเมล
            </button>
          </div>

          <div className="space-y-2">
            {settings.notificationEmails.length === 0 ? (
              <p className="text-xs text-slate-400 italic">ยังไม่มีอีเมลในรายการ</p>
            ) : (
              settings.notificationEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/80 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="font-semibold text-sm text-slate-700">{email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Rules & SLA */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-600" />
              เงื่อนไขประกัน & ชื่อองค์กร
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              กำหนดเกณฑ์การแจ้งเตือนอุปกรณ์หมดประกันและการแสดงผล
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                จำนวนวันแจ้งเตือนก่อนประกันหมดอายุ (วัน)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.warrantyExpiringSoonDays}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0) {
                    setSettings({ ...settings, warrantyExpiringSoonDays: val });
                  }
                }}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
              />
              <p className="text-xs text-slate-500">
                ค่าเริ่มต้นคือ 30 วัน (ระบบจะนับว่า Expiring Soon เมื่อเหลือ &le; {settings.warrantyExpiringSoonDays} วัน)
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                ชื่อองค์กร / ชื่อระบบ (Company Title)
              </label>
              <input
                type="text"
                value={settings.companyName ?? ''}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                placeholder="RepairLink IT Support"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
              />
              <p className="text-xs text-slate-500">
                จะแสดงในหัวข้ออีเมลและการออกรายงาน Excel
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSave(settings)}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าส่วนนี้'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Backup & Reset */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-600" />
                สำรองและกู้คืนการตั้งค่า (JSON Backup & Restore)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                ดาวน์โหลดการตั้งค่าทั้งหมดเก็บไว้เป็นไฟล์ หรือกู้คืนการตั้งค่าจากไฟล์ JSON สำรอง
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-sm transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดไฟล์ Backup (JSON)
              </button>

              <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm cursor-pointer transition-all shadow-sm">
                <Upload className="w-4 h-4" />
                นำเข้าไฟล์ Backup (JSON)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-rose-200/80 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-black text-rose-700 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                คืนค่าเริ่มต้นโรงงาน (Factory Reset)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                กรณีที่ตั้งค่าผิดพลาดหรือต้องการย้อนกลับไปใช้ค่าเริ่มต้นระบบ สามารถกดปุ่มนี้เพื่อล้างการตั้งค่าทั้งหมดกลับเป็นค่า Default ได้
              </p>
            </div>

            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                คืนค่าเริ่มต้นทั้งหมด (Reset to Defaults)
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
                <p className="text-sm font-bold text-rose-800">
                  คุณแน่ใจหรือไม่ว่าต้องการคืนค่าเริ่มต้นทั้งหมด?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefaults}
                    disabled={isPending}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
                  >
                    ยืนยันการคืนค่าเริ่มต้น
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-all"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
