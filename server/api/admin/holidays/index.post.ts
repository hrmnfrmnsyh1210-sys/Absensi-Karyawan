import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const body = await readBody<{
    name?: string
    date_from?: string
    date_to?: string
    description?: string | null
  }>(event)

  const name = body?.name?.trim()
  const dateFrom = body?.date_from?.trim()
  const dateTo = body?.date_to?.trim()
  const description = body?.description?.trim() || null

  if (!name || name.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Nama hari libur minimal 2 karakter' })
  }
  if (!dateFrom || !dateTo) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal mulai dan selesai wajib diisi' })
  }
  if (new Date(dateFrom).getTime() > new Date(dateTo).getTime()) {
    throw createError({ statusCode: 400, statusMessage: 'Tanggal mulai harus sebelum atau sama dengan tanggal selesai' })
  }

  const db = useDb()
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO holidays (name, date_from, date_to, description, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [name, dateFrom, dateTo, description, auth.sub]
  )

  await recordActivity(event, auth, {
    action: 'create',
    entity: 'holiday',
    entityId: result.insertId,
    summary: `Menambahkan hari libur "${name}" (${dateFrom} s/d ${dateTo})`
  })

  return { id: result.insertId, name, date_from: dateFrom, date_to: dateTo, description }
})
