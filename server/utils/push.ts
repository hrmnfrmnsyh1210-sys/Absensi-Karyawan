import webpush from 'web-push'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'

interface SubscriptionRow extends RowDataPacket {
  id: number
  endpoint: string
  p256dh: string
  auth_key: string
}

export interface PushPayload {
  title: string
  body?: string
  url?: string
  tag?: string
  refType?: string
  refId?: number | null
}

let configured = false
function configureVapid() {
  if (configured) return
  const cfg = useRuntimeConfig()
  const pub = (cfg.public as any).vapidPublicKey as string
  const priv = (cfg as any).vapidPrivateKey as string
  const subject = (cfg as any).vapidSubject as string
  if (!pub || !priv) return // belum dikonfigurasi — skip
  webpush.setVapidDetails(subject || 'mailto:admin@example.com', pub, priv)
  configured = true
}

/**
 * Kirim Web Push ke seluruh device yang ter-subscribe milik 1 user.
 * Subscription yang sudah kadaluarsa (410 / 404) otomatis dihapus.
 * Selalu "best-effort" — kegagalan push tidak akan menggagalkan request utama.
 */
export async function sendPushToUser(userId: number, payload: PushPayload) {
  try {
    configureVapid()
    if (!configured) return
    const db = useDb()
    const [subs] = await db.query<SubscriptionRow[]>(
      'SELECT id, endpoint, p256dh, auth_key FROM push_subscriptions WHERE user_id = ?',
      [userId]
    )
    if (!subs.length) return

    const body = JSON.stringify(payload)
    const expiredIds: number[] = []

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
            body,
            { TTL: 60 * 60 * 24 } // 1 hari
          )
        } catch (e: any) {
          // 404 Not Found atau 410 Gone = subscription sudah tidak valid.
          const status = e?.statusCode
          if (status === 404 || status === 410) {
            expiredIds.push(s.id)
          } else {
            console.error('[push] gagal kirim:', status, e?.body || e?.message)
          }
        }
      })
    )

    if (expiredIds.length) {
      await db.query<ResultSetHeader>(
        `DELETE FROM push_subscriptions WHERE id IN (${expiredIds.map(() => '?').join(',')})`,
        expiredIds
      )
    }
  } catch (e) {
    console.error('[push] error:', e)
  }
}
