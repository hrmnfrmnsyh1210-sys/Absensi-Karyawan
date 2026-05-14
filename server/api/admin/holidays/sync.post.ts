export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody<{ year?: number }>(event)

  let year: number | undefined
  if (body?.year !== undefined && body.year !== null) {
    year = Number(body.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw createError({ statusCode: 400, statusMessage: 'Tahun tidak valid' })
    }
  }

  try {
    const result = await syncNationalHolidays(year)
    return {
      ...result,
      message: `${result.count} hari libur nasional tahun ${result.year} berhasil disinkronkan`
    }
  } catch (e) {
    console.error('[holidays/sync] failed:', e)
    throw createError({
      statusCode: 502,
      statusMessage: 'Gagal mengambil kalender nasional. Periksa koneksi internet server lalu coba lagi.'
    })
  }
})
