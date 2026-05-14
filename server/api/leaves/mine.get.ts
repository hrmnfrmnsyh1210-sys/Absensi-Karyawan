import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT l.id, l.type, l.date_from, l.date_to, l.reason, l.status,
            l.review_note, l.reviewed_at, r.name AS reviewer_name, l.created_at,
            l.attachment_name, l.attachment_type
     FROM leaves l
     LEFT JOIN users r ON r.id = l.reviewed_by
     WHERE l.user_id = ?
     ORDER BY l.created_at DESC
     LIMIT 200`,
    [auth.sub]
  )
  return rows
})
