import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = getQuery(event)
  const from = (query.from as string | undefined) || null
  const to = (query.to as string | undefined) || null

  const conds: string[] = []
  const params: any[] = []

  // Overlap: holiday's range intersects with [from, to]
  if (from) {
    conds.push('date_to >= ?')
    params.push(from)
  }
  if (to) {
    conds.push('date_from <= ?')
    params.push(to)
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, name, date_from, date_to, description
     FROM holidays
     ${where}
     ORDER BY date_from ASC
     LIMIT 500`,
    params
  )
  return rows
})
