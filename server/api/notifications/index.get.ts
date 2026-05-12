import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, type, title, body, ref_type, ref_id, is_read, created_at, read_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [auth.sub]
  )
  return rows
})
