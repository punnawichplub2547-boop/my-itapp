export const DEVICE_DEPARTMENTS = [
  'ACC&FN',
  'Advisor',
  'EN',
  'GM',
  'HR',
  'IT',
  'LGT',
  'MK',
  'MT',
  'PC',
  'PD',
  'PU',
  'QA&QC',
  'RD',
  'SF',
  'SGM',
  'SMD',
] as const;

export type DeviceDepartment = (typeof DEVICE_DEPARTMENTS)[number];
