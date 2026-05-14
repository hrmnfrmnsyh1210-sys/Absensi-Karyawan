import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  let type: string | undefined
  let dateFrom: string | undefined
  let dateTo: string | undefined
  let reason: string | undefined
  let attachment: { path: string; name: string; type: string } | null = null

  const contentType = getHeader(event, 'content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    // Form dengan lampiran file (pdf / gambar).
    const parts = (await readMultipartFormData(event)) || []
    for (const p of parts) {
      if (p.name === 'file' && p.filename && p.data?.length) {
        attachment = await saveLeaveAttachment(p)
      } else if (p.name === 'type') {
        type = p.data.toString('utf-8')
      } else if (p.name === 'date_from') {
        dateFrom = p.data.toString('utf-8')
      } else if (p.name === 'date_to') {
        dateTo = p.data.toString('utf-8')
      } else if (p.name === 'reason') {
        reason = p.data.toString('utf-8')
      }
    }
  } else {
    const body = await readBody<{
      type?: 'izin' | 'sakit' | 'cuti'
      date_from?: string
      date_to?: string
      reason?: string
    }>(event)
    type = body?.type
    dateFrom = body?.date_from
    dateTo = body?.date_to
    reason = body?.reason
  }

  if (type !== 'izin' && type !== 'sakit' && type !== 'cuti') {
    throw createError({ statusCode: 400, statusMessage: 'Tipe harus izin/sakit/cuti' })
  }
  reason = reason?.trim()

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
    `INSERT INTO leaves (user_id, type, date_from, date_to, reason, attachment_path, attachment_name, attachment_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [auth.sub, type, dateFrom, dateTo, reason, attachment?.path || null, attachment?.name || null, attachment?.type || null]
  )
  return {
    id: result.insertId,
    type,
    date_from: dateFrom,
    date_to: dateTo,
    reason,
    status: 'pending' as const,
    attachment_name: attachment?.name || null
  }
})
