import type { H3Event } from 'h3'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { JwtPayload } from './auth'

export interface ActivityLogInput {
  // Jenis aksi: create | update | delete | approve | reject | sync
  action: string
  // Objek yang dikenai aksi: pegawai | leave | settings | office | holiday
  entity: string
  entityId?: number | null
  // Ringkasan singkat untuk ditampilkan ke super admin.
  summary: string
}

/**
 * Catat aksi admin/super admin ke activity_logs.
 * Sengaja "best-effort" — kegagalan logging tidak boleh menggagalkan request utama.
 */
export async function recordActivity(
  event: H3Event,
  auth: JwtPayload,
  input: ActivityLogInput
) {
  try {
    const db = useDb()
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT name FROM users WHERE id = ? LIMIT 1',
      [auth.sub]
    )
    const actorName = rows[0]?.name || auth.nip
    const ip = getRequestIP(event, { xForwardedFor: true }) || null
    await db.query<ResultSetHeader>(
      `INSERT INTO activity_logs
         (actor_id, actor_name, actor_role, action, entity, entity_id, summary, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auth.sub,
        actorName,
        auth.role,
        input.action,
        input.entity,
        input.entityId ?? null,
        input.summary.slice(0, 512),
        ip
      ]
    )
  } catch (e) {
    console.error('[activity-log] gagal mencatat:', e)
  }
}
