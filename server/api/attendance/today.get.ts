import type { RowDataPacket } from 'mysql2'

interface AttendanceRow extends RowDataPacket {
  id: number
  type: 'check_in' | 'check_out'
  recorded_at: string
  distance_m: number
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDb()
  const [rows] = await db.query<AttendanceRow[]>(
    `SELECT id, type, recorded_at, distance_m FROM attendance
     WHERE user_id = ? AND DATE(recorded_at) = CURDATE()`,
    [auth.sub]
  )
  return {
    check_in: rows.find((r) => r.type === 'check_in') || null,
    check_out: rows.find((r) => r.type === 'check_out') || null
  }
})
