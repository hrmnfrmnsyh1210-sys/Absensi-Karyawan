import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const body = await readBody<{
    work_start_time?: string
    work_end_time?: string
    work_days?: number[]
    annual_leave_quota?: number
    location_check_enabled?: boolean
  }>(event)

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
  const start = body?.work_start_time?.trim()
  const end = body?.work_end_time?.trim()
  if (!start || !timeRe.test(start)) {
    throw createError({ statusCode: 400, statusMessage: 'Jam masuk tidak valid (format HH:MM)' })
  }
  if (!end || !timeRe.test(end)) {
    throw createError({ statusCode: 400, statusMessage: 'Jam pulang tidak valid (format HH:MM)' })
  }
  if (start >= end) {
    throw createError({ statusCode: 400, statusMessage: 'Jam masuk harus sebelum jam pulang' })
  }

  const days = Array.isArray(body?.work_days)
    ? [...new Set(body!.work_days.map(Number))]
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        .sort((a, b) => a - b)
    : []
  if (!days.length) {
    throw createError({ statusCode: 400, statusMessage: 'Pilih minimal satu hari kerja' })
  }

  const quota = Math.round(Number(body?.annual_leave_quota))
  if (!Number.isInteger(quota) || quota < 0 || quota > 365) {
    throw createError({ statusCode: 400, statusMessage: 'Kuota cuti tahunan tidak valid (0-365)' })
  }

  // Mode WFH global — default aktif (wajib cek lokasi) kecuali dikirim false.
  const locationCheck = body?.location_check_enabled === false ? '0' : '1'

  const db = useDb()
  const entries: [string, string][] = [
    ['work_start_time', start],
    ['work_end_time', end],
    ['work_days', days.join(',')],
    ['annual_leave_quota', String(quota)],
    ['location_check_enabled', locationCheck]
  ]
  for (const [k, v] of entries) {
    await db.query<ResultSetHeader>(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [k, v]
    )
  }

  await recordActivity(event, auth, {
    action: 'update',
    entity: 'settings',
    summary:
      `Mengubah pengaturan kerja — jam ${start}-${end}, ${days.length} hari kerja, kuota cuti ${quota} hari, ` +
      `cek titik lokasi ${locationCheck === '1' ? 'AKTIF' : 'NONAKTIF (mode WFH)'}`
  })

  return getAppSettings()
})
