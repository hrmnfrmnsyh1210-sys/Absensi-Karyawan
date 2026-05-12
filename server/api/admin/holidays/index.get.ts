import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT h.id, h.name, h.date_from, h.date_to, h.description,
            h.created_at, h.updated_at, u.name AS created_by_name
     FROM holidays h
     LEFT JOIN users u ON u.id = h.created_by
     ORDER BY h.date_from DESC
     LIMIT 500`
  )
  return rows
})
