import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody<{
    type?: 'izin' | 'sakit' | 'cuti'
    date_from?: string
    date_to?: string
    reason?: string
  }>(event)

  const type = body?.type
  if (type !== 'izin' && type !== 'sakit' && type !== 'cuti') {
    throw createError({ statusCode: 400, statusMessage: 'Tipe harus izin/sakit/cuti' })
  }
  const dateFrom = body?.date_from
  const dateTo = body?.date_to
  const reason = body?.reason?.trim()

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateFrom || !dateRe.test(dateFrom)) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal mulai tidak valid' })
  }
  if (!dateTo || !dateRe.test(dateTo)) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal selesai tidak valid' })
  }
  if (dateFrom > dateTo) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal selesai harus >= tanggal mulai' })
  }
  if (!reason || reason.length < 5) {
    throw createError({ statusCode: 400, statusMessage: 'Alasan minimal 5 karakter' })
  }

  const db = useDb()
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO leaves (user_id, type, date_from, date_to, reason, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [auth.sub, type, dateFrom, dateTo, reason]
  )
  return { id: result.insertId, type, date_from: dateFrom, date_to: dateTo, reason, status: 'pending' as const }
})
