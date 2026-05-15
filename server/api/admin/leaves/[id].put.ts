import type { ResultSetHeader, RowDataPacket } from 'mysql2'

const TYPE_LABEL: Record<string, string> = {
  cuti: 'Cuti Tahunan',
  sakit: 'Izin Sakit',
  izin: 'Izin Pribadi'
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }

  const body = await readBody<{ status?: 'approved' | 'rejected'; note?: string }>(event)
  const status = body?.status
  if (status !== 'approved' && status !== 'rejected') {
    throw createError({ statusCode: 400, statusMessage: 'Status harus approved atau rejected' })
  }
  const note = body?.note?.trim() || null

  const db = useDb()
  const [existing] = await db.query<RowDataPacket[]>(
    'SELECT id, user_id, type, date_from, date_to, status FROM leaves WHERE id = ? LIMIT 1',
    [id]
  )
  const leave = existing[0]
  if (!leave) {
    throw createError({ statusCode: 404, statusMessage: 'Pengajuan tidak ditemukan' })
  }
  if (leave.status !== 'pending') {
    throw createError({
      statusCode: 409,
      statusMessage: `Pengajuan sudah di-${leave.status}, tidak bisa diubah`
    })
  }

  await db.query<ResultSetHeader>(
    `UPDATE leaves SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
     WHERE id = ?`,
    [status, auth.sub, note, id]
  )

  const typeLabel = TYPE_LABEL[leave.type] || 'Pengajuan'
  const rangeLabel = leave.date_from === leave.date_to
    ? fmtDate(leave.date_from)
    : `${fmtDate(leave.date_from)} – ${fmtDate(leave.date_to)}`
  const isApproved = status === 'approved'
  const title = isApproved
    ? `${typeLabel} disetujui`
    : `${typeLabel} ditolak`
  const notifBody = isApproved
    ? `Pengajuan ${typeLabel.toLowerCase()} kamu untuk ${rangeLabel} telah disetujui.${note ? ` Catatan admin: ${note}` : ''}`
    : `Pengajuan ${typeLabel.toLowerCase()} kamu untuk ${rangeLabel} ditolak.${note ? ` Alasan: ${note}` : ''}`

  // Notif in-app + Web Push ke HP user.
  await createNotification(leave.user_id, {
    type: isApproved ? 'leave_approved' : 'leave_rejected',
    title,
    body: notifBody,
    refType: 'leave',
    refId: id
  })

  await recordActivity(event, auth, {
    action: isApproved ? 'approve' : 'reject',
    entity: 'leave',
    entityId: id,
    summary: `${isApproved ? 'Menyetujui' : 'Menolak'} ${typeLabel.toLowerCase()} (${rangeLabel})`
  })

  return { id, status, review_note: note }
})
