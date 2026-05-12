import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const query = getQuery(event)
  const search = (query.q as string | undefined)?.trim()

  const db = useDb()
  const params: any[] = []
  let where = ''
  if (search) {
    where = 'WHERE (name LIKE ? OR nip LIKE ? OR email LIKE ?)'
    const term = `%${search}%`
    params.push(term, term, term)
  }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, nip, email, name, role, created_at FROM users ${where} ORDER BY name ASC`,
    params
  )
  return rows
})
