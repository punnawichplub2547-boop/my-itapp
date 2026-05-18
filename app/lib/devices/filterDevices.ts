import type { Device } from '../../types';

export interface DeviceFilterCriteria {
  search?: string;
  department?: string;
  deviceType?: string;
  os?: string;
}

export function filterDevices(devices: Device[], criteria: DeviceFilterCriteria): Device[] {
  const query = (criteria.search ?? '').trim().toLowerCase();
  const department = criteria.department ?? 'All';
  const deviceType = criteria.deviceType ?? 'All';
  const os = criteria.os ?? 'All';

  return devices.filter((device) => {
    const matchesSearch =
      query.length === 0 ||
      device.deviceId.toLowerCase().includes(query) ||
      device.assetNo.toLowerCase().includes(query) ||
      device.ipAddress.toLowerCase().includes(query) ||
      device.department.toLowerCase().includes(query) ||
      device.assignedTo.toLowerCase().includes(query) ||
      device.model.toLowerCase().includes(query) ||
      device.os.toLowerCase().includes(query);

    const matchesDepartment = department === 'All' || device.department === department;
    const matchesDeviceType = deviceType === 'All' || device.deviceType === deviceType;
    const matchesOs = os === 'All' || device.os === os;

    return matchesSearch && matchesDepartment && matchesDeviceType && matchesOs;
  });
}
