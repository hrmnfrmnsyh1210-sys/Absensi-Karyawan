import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const query = getQuery(event)
  const status = query.status as string | undefined
  const userId = query.user_id ? Number(query.user_id) : null

  const conds: string[] = []
  const params: any[] = []
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    conds.push('l.status = ?')
    params.push(status)
  }
  if (userId) {
    conds.push('l.user_id = ?')
    params.push(userId)
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT l.id, l.type, l.date_from, l.date_to, l.reason, l.status,
            l.review_note, l.reviewed_at, l.created_at,
            u.id AS user_id, u.nip, u.name AS user_name,
            r.name AS reviewer_name
     FROM leaves l
     INNER JOIN users u ON u.id = l.user_id
     LEFT JOIN users r ON r.id = l.reviewed_by
     ${where}
     ORDER BY
       CASE l.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
       l.created_at DESC
     LIMIT 500`,
    params
  )
  return rows
})
