import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }
  if (id === auth.sub) {
    throw createError({ statusCode: 400, statusMessage: 'Tidak bisa menghapus akun sendiri' })
  }
  const db = useDb()
  const [result] = await db.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id])
  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })
  }
  return { ok: true }
})
