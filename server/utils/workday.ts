import type { RowDataPacket } from 'mysql2'

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Today's date in WIB (UTC+7) — the calendar day employees actually experience. */
export function wibToday(): { ymd: string; dow: number } {
  const wib = new Date(Date.now() + 7 * 3600 * 1000)
  return { ymd: wib.toISOString().slice(0, 10), dow: wib.getUTCDay() }
}

/**
 * Throws a 422 if today is not a configured work day, or if it falls on a
 * holiday (national tanggal merah or a manually-added holiday).
 */
export async function assertWorkingDay(): Promise<void> {
  const { ymd, dow } = wibToday()
  const settings = await getAppSettings()

  if (!settings.work_days.includes(dow)) {
    throw createError({
      statusCode: 422,
      statusMessage: `Hari ini ${DAY_NAMES[dow]} bukan hari kerja. Absensi hanya bisa dilakukan pada hari kerja.`
    })
  }

  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT name FROM holidays WHERE ? BETWEEN date_from AND date_to ORDER BY source DESC LIMIT 1',
    [ymd]
  )
  if (rows.length) {
    throw createError({
      statusCode: 422,
      statusMessage: `Hari ini libur: ${rows[0].name}. Absensi dinonaktifkan.`
    })
  }
}
