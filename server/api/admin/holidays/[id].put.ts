import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }

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
    `UPDATE holidays SET name = ?, date_from = ?, date_to = ?, description = ?
     WHERE id = ?`,
    [name, dateFrom, dateTo, description, id]
  )
  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Hari libur tidak ditemukan' })
  }

  await recordActivity(event, auth, {
    action: 'update',
    entity: 'holiday',
    entityId: id,
    summary: `Memperbarui hari libur "${name}" (${dateFrom} s/d ${dateTo})`
  })

  return { id, name, date_from: dateFrom, date_to: dateTo, description }
})
