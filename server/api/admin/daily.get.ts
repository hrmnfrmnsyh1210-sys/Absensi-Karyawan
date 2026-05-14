import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const query = getQuery(event)
  const date = (query.date as string | undefined)?.trim()
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Parameter date wajib (YYYY-MM-DD)' })
  }

  const db = useDb()

  const [users] = await db.query<RowDataPacket[]>(
    `SELECT id, nip, name, email FROM users WHERE role = 'pegawai' ORDER BY name ASC`
  )

  const [attRows] = await db.query<RowDataPacket[]>(
    `SELECT user_id, type, recorded_at, latitude, longitude, distance_m, status
     FROM attendance
     WHERE DATE(recorded_at) = ?
     ORDER BY recorded_at ASC`,
    [date]
  )

  const [leaveRows] = await db.query<RowDataPacket[]>(
    `SELECT user_id, type, status, date_from, date_to
     FROM leaves
     WHERE status = 'approved' AND date_from <= ? AND date_to >= ?`,
    [date, date]
  )

  const [holidayRows] = await db.query<RowDataPacket[]>(
    `SELECT id, name, date_from, date_to
     FROM holidays
     WHERE date_from <= ? AND date_to >= ?
     ORDER BY date_from ASC`,
    [date, date]
  )

  type AttRec = {
    type: 'check_in' | 'check_out'
    recorded_at: string
    latitude: number
    longitude: number
    distance_m: number
    status: 'valid' | 'out_of_range' | 'wfh'
  }

  const byUser = new Map<number, { check_in: AttRec | null; check_out: AttRec | null }>()
  for (const r of attRows as any[]) {
    const uid = Number(r.user_id)
    if (!byUser.has(uid)) byUser.set(uid, { check_in: null, check_out: null })
    const slot = byUser.get(uid)!
    const rec: AttRec = {
      type: r.type,
      recorded_at: r.recorded_at,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      distance_m: Number(r.distance_m),
      status: r.status
    }
    if (r.type === 'check_in') {
      if (!slot.check_in) slot.check_in = rec
    } else {
      slot.check_out = rec
    }
  }

  const leaveByUser = new Map<number, { type: string; status: string }>()
  for (const l of leaveRows as any[]) {
    leaveByUser.set(Number(l.user_id), { type: l.type, status: l.status })
  }

  const isHoliday = holidayRows.length > 0

  const result = (users as any[]).map(u => {
    const att = byUser.get(u.id) || { check_in: null, check_out: null }
    const leave = leaveByUser.get(u.id) || null
    let status: 'hadir' | 'belum' | 'cuti' | 'sakit' | 'izin' | 'libur'
    if (att.check_in) status = 'hadir'
    else if (leave) status = leave.type as 'cuti' | 'sakit' | 'izin'
    else if (isHoliday) status = 'libur'
    else status = 'belum'

    let duration_min: number | null = null
    if (att.check_in && att.check_out) {
      duration_min = Math.round(
        (new Date(att.check_out.recorded_at).getTime() - new Date(att.check_in.recorded_at).getTime()) / 60000
      )
    }

    return {
      user_id: u.id,
      nip: u.nip,
      name: u.name,
      email: u.email,
      status,
      check_in: att.check_in,
      check_out: att.check_out,
      duration_min,
      leave
    }
  })

  return {
    date,
    is_holiday: isHoliday,
    holidays: holidayRows,
    users: result,
    summary: {
      total: result.length,
      hadir: result.filter(r => r.status === 'hadir').length,
      belum: result.filter(r => r.status === 'belum').length,
      cuti: result.filter(r => r.status === 'cuti' || r.status === 'sakit' || r.status === 'izin').length,
      libur: result.filter(r => r.status === 'libur').length
    }
  }
})
