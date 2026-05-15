import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody<{
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }>(event)

  const endpoint = body?.endpoint?.trim()
  const p256dh = body?.keys?.p256dh?.trim()
  const authKey = body?.keys?.auth?.trim()

  if (!endpoint || !p256dh || !authKey) {
    throw createError({ statusCode: 400, statusMessage: 'Subscription tidak lengkap' })
  }
  if (endpoint.length > 512) {
    throw createError({ statusCode: 400, statusMessage: 'Endpoint terlalu panjang' })
  }

  const ua = getHeader(event, 'user-agent')?.slice(0, 500) || null
  const db = useDb()

  // Endpoint UNIQUE — kalau device ini sudah pernah subscribe, pindahkan
  // kepemilikannya ke user yang sekarang (mis. ganti akun di HP yang sama).
  await db.query<ResultSetHeader>(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       p256dh = VALUES(p256dh),
       auth_key = VALUES(auth_key),
       user_agent = VALUES(user_agent),
       last_used_at = CURRENT_TIMESTAMP`,
    [auth.sub, endpoint, p256dh, authKey, ua]
  )
  return { ok: true }
})
