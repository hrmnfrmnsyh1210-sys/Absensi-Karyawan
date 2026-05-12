import type { ResultSetHeader, RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }

  const body = await readBody<{ status?: 'approved' | 'rejected'; note?: string }>(event)
  const status = body?.status
  if (status !== 'approved' && status !== 'rejected') {
    throw createError({ statusCode: 400, statusMessage: 'Status harus approved atau rejected' })
  }
  const note = body?.note?.trim() || null

  const db = useDb()
  const [existing] = await db.query<RowDataPacket[]>(
    'SELECT id, status FROM leaves WHERE id = ? LIMIT 1',
    [id]
  )
  if (!existing[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Pengajuan tidak ditemukan' })
  }
  if (existing[0].status !== 'pending') {
    throw createError({
      statusCode: 409,
      statusMessage: `Pengajuan sudah di-${existing[0].status}, tidak bisa diubah`
    })
  }

  await db.query<ResultSetHeader>(
    `UPDATE leaves SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
     WHERE id = ?`,
    [status, auth.sub, note, id]
  )
  return { id, status, review_note: note }
})
