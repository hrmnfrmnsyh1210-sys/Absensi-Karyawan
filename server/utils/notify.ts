import type { ResultSetHeader } from 'mysql2'

type NotifType = 'leave_approved' | 'leave_rejected' | 'info'

export interface NotifyInput {
  type: NotifType
  title: string
  body?: string | null
  refType?: string | null
  refId?: number | null
}

/**
 * Buat notifikasi in-app sekaligus kirim Web Push ke seluruh device user.
 * Push bersifat best-effort — kalau gagal, baris notifikasi tetap tersimpan
 * dan akan terlihat saat user membuka aplikasi.
 */
export async function createNotification(userId: number, input: NotifyInput) {
  const db = useDb()
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, input.type, input.title, input.body ?? null, input.refType ?? null, input.refId ?? null]
  )

  // URL tujuan saat notif diklik di HP.
  const url = input.refType === 'leave' ? '/izin' : '/notifikasi'

  await sendPushToUser(userId, {
    title: input.title,
    body: input.body ?? undefined,
    url,
    refType: input.refType ?? undefined,
    refId: input.refId ?? undefined,
    tag: `${input.refType || 'info'}-${input.refId || result.insertId}`
  })

  return { id: result.insertId }
}
