import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 200)

  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, type, latitude, longitude, distance_m, status, recorded_at
     FROM attendance WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ?`,
    [auth.sub, limit]
  )
  return rows
})
