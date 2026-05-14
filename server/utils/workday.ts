const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Today's date in WIB (UTC+7) — the calendar day employees actually experience. */
export function wibToday(): { ymd: string; dow: number } {
  const wib = new Date(Date.now() + 7 * 3600 * 1000)
  return { ymd: wib.toISOString().slice(0, 10), dow: wib.getUTCDay() }
}

/**
 * Throws a 422 if today is not a configured work day (e.g. weekend).
 *
 * Holidays (national tanggal merah / cuti bersama or manually-added) do NOT
 * block attendance: employees may still check in on a holiday (e.g. for
 * lembur). Not checking in on a holiday simply isn't counted as alpa — that
 * exclusion lives in the recap logic (see `isHolidayYmd` in pages/saya.vue and
 * the `libur` status in server/api/admin/daily.get.ts).
 */
export async function assertWorkingDay(): Promise<void> {
  const { dow } = wibToday()
  const settings = await getAppSettings()

  if (!settings.work_days.includes(dow)) {
    throw createError({
      statusCode: 422,
      statusMessage: `Hari ini ${DAY_NAMES[dow]} bukan hari kerja. Absensi hanya bisa dilakukan pada hari kerja.`
    })
  }
}
