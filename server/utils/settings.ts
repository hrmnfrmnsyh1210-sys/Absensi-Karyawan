import type { RowDataPacket } from 'mysql2'

interface SettingRow extends RowDataPacket {
  setting_key: string
  setting_value: string
}

export interface AppSettings {
  work_start_time: string
  work_end_time: string
  work_days: number[]
  annual_leave_quota: number
}

export const SETTINGS_DEFAULTS: AppSettings = {
  work_start_time: '08:00',
  work_end_time: '17:00',
  work_days: [1, 2, 3, 4, 5],
  annual_leave_quota: 12
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = useDb()
  const [rows] = await db.query<SettingRow[]>(
    'SELECT setting_key, setting_value FROM app_settings'
  )
  const map = new Map(rows.map((r) => [r.setting_key, r.setting_value]))
  return {
    work_start_time: map.get('work_start_time') || SETTINGS_DEFAULTS.work_start_time,
    work_end_time: map.get('work_end_time') || SETTINGS_DEFAULTS.work_end_time,
    work_days: (map.get('work_days') || SETTINGS_DEFAULTS.work_days.join(','))
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6),
    annual_leave_quota: Number(map.get('annual_leave_quota')) || SETTINGS_DEFAULTS.annual_leave_quota
  }
}
