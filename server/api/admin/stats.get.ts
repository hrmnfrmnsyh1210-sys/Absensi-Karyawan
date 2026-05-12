import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = useDb()

  const [[totalUsers]] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'pegawai'"
  ) as any
  const [[checkInToday]] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(DISTINCT user_id) AS total FROM attendance WHERE type = 'check_in' AND DATE(recorded_at) = CURDATE()"
  ) as any
  const [[checkOutToday]] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(DISTINCT user_id) AS total FROM attendance WHERE type = 'check_out' AND DATE(recorded_at) = CURDATE()"
  ) as any
  const [[totalRecords]] = await db.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM attendance'
  ) as any

  const [recent] = await db.query<RowDataPacket[]>(
    `SELECT a.id, a.type, a.distance_m, a.recorded_at, u.name, u.nip
     FROM attendance a INNER JOIN users u ON u.id = a.user_id
     ORDER BY a.recorded_at DESC LIMIT 10`
  )

  return {
    total_pegawai: Number(totalUsers.total),
    masuk_hari_ini: Number(checkInToday.total),
    pulang_hari_ini: Number(checkOutToday.total),
    total_records: Number(totalRecords.total),
    recent
  }
})
