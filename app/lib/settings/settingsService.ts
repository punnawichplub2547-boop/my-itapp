import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getDeviceDbPool } from '../db/mysql';
import type { SystemSettings } from '../../types';
import { DEFAULT_SYSTEM_SETTINGS, normalizeSettingsPayload } from './settingsDefaults';

export { DEFAULT_SYSTEM_SETTINGS, normalizeSettingsPayload };

export interface SettingsRepository {
  getSettings(): Promise<SystemSettings>;
  updateSettings(partial: Partial<SystemSettings>, updatedBy?: string): Promise<SystemSettings>;
  resetSettings(keys?: Array<keyof SystemSettings>): Promise<SystemSettings>;
}

export class InMemorySettingsRepository implements SettingsRepository {
  private currentSettings: SystemSettings;

  constructor(initialSettings: Partial<SystemSettings> = {}) {
    this.currentSettings = { ...DEFAULT_SYSTEM_SETTINGS, ...initialSettings };
  }

  async getSettings(): Promise<SystemSettings> {
    return { ...this.currentSettings };
  }

  async updateSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
    this.currentSettings = normalizeSettingsPayload({
      ...this.currentSettings,
      ...partial,
    });
    return { ...this.currentSettings };
  }

  async resetSettings(keys?: Array<keyof SystemSettings>): Promise<SystemSettings> {
    if (!keys || keys.length === 0) {
      this.currentSettings = { ...DEFAULT_SYSTEM_SETTINGS };
    } else {
      for (const key of keys) {
        if (key in DEFAULT_SYSTEM_SETTINGS) {
          (this.currentSettings as unknown as Record<string, unknown>)[key] = DEFAULT_SYSTEM_SETTINGS[key];
        }
      }
    }
    return { ...this.currentSettings };
  }
}

export class MySqlSettingsRepository implements SettingsRepository {
  constructor(private readonly getPool: () => Pool = getDeviceDbPool) {}

  async getSettings(): Promise<SystemSettings> {
    const pool = this.getPool();
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_key, setting_value FROM system_settings`
      );

      const dbMap: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          dbMap[row.setting_key] = typeof row.setting_value === 'string'
            ? JSON.parse(row.setting_value)
            : row.setting_value;
        } catch {
          dbMap[row.setting_key] = row.setting_value;
        }
      }

      return normalizeSettingsPayload({
        departments: (dbMap.departments as string[]) ?? DEFAULT_SYSTEM_SETTINGS.departments,
        problemTypes: (dbMap.problemTypes as string[]) ?? DEFAULT_SYSTEM_SETTINGS.problemTypes,
        deviceTypes: (dbMap.deviceTypes as string[]) ?? DEFAULT_SYSTEM_SETTINGS.deviceTypes,
        notificationEmails: (dbMap.notificationEmails as string[]) ?? DEFAULT_SYSTEM_SETTINGS.notificationEmails,
        warrantyExpiringSoonDays: typeof dbMap.warrantyExpiringSoonDays === 'number'
          ? dbMap.warrantyExpiringSoonDays
          : DEFAULT_SYSTEM_SETTINGS.warrantyExpiringSoonDays,
        companyName: typeof dbMap.companyName === 'string'
          ? dbMap.companyName
          : DEFAULT_SYSTEM_SETTINGS.companyName,
      });
    } catch {
      // If table does not exist or database is offline, fall back to defaults gracefully
      return { ...DEFAULT_SYSTEM_SETTINGS };
    }
  }

  async updateSettings(partial: Partial<SystemSettings>, updatedBy: string = 'system'): Promise<SystemSettings> {
    const pool = this.getPool();
    const current = await this.getSettings();
    const merged = normalizeSettingsPayload({ ...current, ...partial });

    const entries = Object.entries(merged) as [keyof SystemSettings, unknown][];

    for (const [key, value] of entries) {
      if (key in partial) {
        await pool.query(
          `INSERT INTO system_settings (setting_key, setting_value, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             setting_value = VALUES(setting_value),
             updated_by = VALUES(updated_by)`,
          [key, JSON.stringify(value), updatedBy]
        );
      }
    }

    return merged;
  }

  async resetSettings(keys?: Array<keyof SystemSettings>): Promise<SystemSettings> {
    const pool = this.getPool();
    if (!keys || keys.length === 0) {
      await pool.query(`DELETE FROM system_settings`);
      return { ...DEFAULT_SYSTEM_SETTINGS };
    }

    for (const key of keys) {
      await pool.query(`DELETE FROM system_settings WHERE setting_key = ?`, [key]);
    }

    return this.getSettings();
  }
}

let activeRepository: SettingsRepository | null = null;

export function getSettingsService(): SettingsRepository {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_USE_MYSQL) {
    if (!activeRepository) {
      activeRepository = new InMemorySettingsRepository();
    }
    return activeRepository;
  }

  if (!activeRepository) {
    activeRepository = new MySqlSettingsRepository();
  }
  return activeRepository;
}

export function setSettingsRepositoryForTest(repo: SettingsRepository | null) {
  activeRepository = repo;
}
