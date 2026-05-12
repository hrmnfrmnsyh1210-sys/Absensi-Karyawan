import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, nip, email, name, role FROM users WHERE id = ? LIMIT 1',
    [auth.sub]
  )
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })
  return rows[0]
})
