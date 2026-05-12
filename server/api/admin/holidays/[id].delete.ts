import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }
  const db = useDb()
  const [result] = await db.query<ResultSetHeader>('DELETE FROM holidays WHERE id = ?', [id])
  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Hari libur tidak ditemukan' })
  }
  return { id }
})
