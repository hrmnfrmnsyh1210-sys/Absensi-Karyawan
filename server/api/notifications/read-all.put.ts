import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const db = useDb()
  const [res] = await db.query<ResultSetHeader>(
    `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND is_read = 0`,
    [auth.sub]
  )
  return { updated: res.affectedRows }
})
