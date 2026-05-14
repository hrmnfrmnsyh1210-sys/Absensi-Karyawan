import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  // Hanya super admin yang boleh melihat activity log.
  requireSuperAdmin(event)
  const query = getQuery(event)
  const search = (query.q as string | undefined)?.trim()
  const entity = (query.entity as string | undefined)?.trim()
  const limit = Math.min(Math.max(Number(query.limit) || 200, 1), 500)

  const conds: string[] = []
  const params: any[] = []
  if (search) {
    conds.push('(summary LIKE ? OR actor_name LIKE ?)')
    const term = `%${search}%`
    params.push(term, term)
  }
  if (entity && entity !== 'all') {
    conds.push('entity = ?')
    params.push(entity)
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, actor_id, actor_name, actor_role, action, entity, entity_id,
            summary, ip_address, created_at
     FROM activity_logs
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [...params, limit]
  )
  return rows
})
