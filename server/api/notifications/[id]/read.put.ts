import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }
  const db = useDb()
  const [res] = await db.query<ResultSetHeader>(
    `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ? AND is_read = 0`,
    [id, auth.sub]
  )
  return { updated: res.affectedRows }
})
