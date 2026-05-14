import type { ResultSetHeader, RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }
  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT name, date_from, date_to FROM holidays WHERE id = ? LIMIT 1',
    [id]
  )
  const holiday = rows[0]
  const [result] = await db.query<ResultSetHeader>('DELETE FROM holidays WHERE id = ?', [id])
  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Hari libur tidak ditemukan' })
  }

  await recordActivity(event, auth, {
    action: 'delete',
    entity: 'holiday',
    entityId: id,
    summary: holiday
      ? `Menghapus hari libur "${holiday.name}"`
      : `Menghapus hari libur #${id}`
  })

  return { id }
})
