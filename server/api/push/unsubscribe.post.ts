import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody<{ endpoint?: string }>(event)
  const endpoint = body?.endpoint?.trim()
  if (!endpoint) {
    throw createError({ statusCode: 400, statusMessage: 'Endpoint wajib diisi' })
  }
  const db = useDb()
  await db.query<ResultSetHeader>(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    [auth.sub, endpoint]
  )
  return { ok: true }
})
