import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, nip, email, name, role, jabatan,
            DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS tanggal_lahir, wfh
     FROM users WHERE id = ? LIMIT 1`,
    [auth.sub]
  )
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })
  return rows[0]
})
