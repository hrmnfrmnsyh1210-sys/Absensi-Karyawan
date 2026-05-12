import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const query = getQuery(event)

  const from = (query.from as string | undefined) || null
  const to = (query.to as string | undefined) || null
  const userId = query.user_id ? Number(query.user_id) : null
  const type = query.type as 'check_in' | 'check_out' | undefined

  const conds: string[] = []
  const params: any[] = []

  if (from) {
    conds.push('DATE(a.recorded_at) >= ?')
    params.push(from)
  }
  if (to) {
    conds.push('DATE(a.recorded_at) <= ?')
    params.push(to)
  }
  if (userId) {
    conds.push('a.user_id = ?')
    params.push(userId)
  }
  if (type === 'check_in' || type === 'check_out') {
    conds.push('a.type = ?')
    params.push(type)
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT a.id, a.type, a.latitude, a.longitude, a.distance_m, a.status, a.recorded_at,
            u.id AS user_id, u.nip, u.name, u.email
     FROM attendance a
     INNER JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.recorded_at DESC
     LIMIT 1000`,
    params
  )
  return rows
})
