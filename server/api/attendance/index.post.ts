import type { RowDataPacket, ResultSetHeader } from 'mysql2'

interface OfficeRow extends RowDataPacket {
  id: number
  latitude: number
  longitude: number
  radius_m: number
}

interface UserRow extends RowDataPacket {
  wfh: number
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const body = await readBody<{ type?: string; latitude?: number; longitude?: number }>(event)

  const type = body?.type
  if (type !== 'check_in' && type !== 'check_out') {
    throw createError({ statusCode: 400, statusMessage: 'type harus check_in atau check_out' })
  }

  // Reject absen on non-work days and holidays (tanggal merah / cuti bersama).
  await assertWorkingDay()

  const db = useDb()

  // WFH employees: admin sudah mematikan cek titik lokasi, GPS jadi opsional.
  const [userRows] = await db.query<UserRow[]>(
    'SELECT wfh FROM users WHERE id = ? LIMIT 1',
    [auth.sub]
  )
  const isWfh = !!userRows[0]?.wfh

  const [offices] = await db.query<OfficeRow[]>(
    'SELECT id, latitude, longitude, radius_m FROM offices ORDER BY id LIMIT 1'
  )
  const office = offices[0]
  if (!office) {
    throw createError({ statusCode: 500, statusMessage: 'Lokasi kantor belum dikonfigurasi' })
  }

  const hasCoords =
    isFinite(Number(body?.latitude)) && isFinite(Number(body?.longitude)) &&
    Math.abs(Number(body?.latitude)) <= 90 && Math.abs(Number(body?.longitude)) <= 180

  let lat = 0
  let lng = 0
  let distance = 0
  let status: 'valid' | 'wfh' = 'valid'

  if (isWfh) {
    // Tidak ada validasi radius. Simpan koordinat hanya kalau dikirim.
    status = 'wfh'
    if (hasCoords) {
      lat = Number(body!.latitude)
      lng = Number(body!.longitude)
      distance = haversineMeters(lat, lng, Number(office.latitude), Number(office.longitude))
    }
  } else {
    if (!hasCoords) {
      throw createError({ statusCode: 400, statusMessage: 'Koordinat GPS tidak valid' })
    }
    lat = Number(body!.latitude)
    lng = Number(body!.longitude)
    distance = haversineMeters(lat, lng, Number(office.latitude), Number(office.longitude))
    if (distance > office.radius_m) {
      throw createError({
        statusCode: 422,
        statusMessage: `Anda berada di luar area absensi (${distance} m dari kantor, maksimal ${office.radius_m} m)`
      })
    }
  }

  const [duplicate] = await db.query<RowDataPacket[]>(
    'SELECT id FROM attendance WHERE user_id = ? AND type = ? AND DATE(recorded_at) = CURDATE() LIMIT 1',
    [auth.sub, type]
  )
  if (duplicate[0]) {
    throw createError({
      statusCode: 409,
      statusMessage: `Anda sudah ${type === 'check_in' ? 'absen masuk' : 'absen pulang'} hari ini`
    })
  }

  if (type === 'check_out') {
    const [hasCheckIn] = await db.query<RowDataPacket[]>(
      "SELECT id FROM attendance WHERE user_id = ? AND type = 'check_in' AND DATE(recorded_at) = CURDATE() LIMIT 1",
      [auth.sub]
    )
    if (!hasCheckIn[0]) {
      throw createError({ statusCode: 409, statusMessage: 'Anda belum absen masuk hari ini' })
    }
  }

  const ua = getHeader(event, 'user-agent')?.slice(0, 500) || null
  const ip = getRequestIP(event, { xForwardedFor: true }) || null

  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO attendance (user_id, office_id, type, latitude, longitude, distance_m, status, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [auth.sub, office.id, type, lat, lng, distance, status, ua, ip]
  )

  return {
    id: result.insertId,
    type,
    distance_m: distance,
    status,
    recorded_at: new Date().toISOString()
  }
})
