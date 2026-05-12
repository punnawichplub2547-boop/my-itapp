import { AlertTriangle, History, ShieldCheck } from 'lucide-react';
import { Device } from '../types';

// Helper for Warranty Colors
export const getWarrantyStatus = (expireDate: string) => {
  const now = new Date();
  const expire = new Date(expireDate);
  const diffTime = expire.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Expired', color: 'text-error bg-error/10 border-error/20', icon: <AlertTriangle size={12} className="text-error" />, days: diffDays };
  if (diffDays <= 30) return { label: 'Expiring Soon', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: <History size={12} className="text-amber-500" />, days: diffDays };
  return { label: 'Active', color: 'text-green-600 bg-green-50 border-green-200', icon: <ShieldCheck size={12} className="text-green-500" />, days: diffDays };
};

export const getDeviceStatusColor = (status: Device['status']) => {
  if (status === 'Active') return 'bg-green-500';
  if (status === 'Inactive') return 'bg-red-500';
  return 'bg-gray-400';
};

export const getDeviceStatusBadgeColor = (status: Device['status']) => {
  if (status === 'Active') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Inactive') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-50 text-secondary border-gray-200';
};
