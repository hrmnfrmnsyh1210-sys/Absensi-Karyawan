import type { ResultSetHeader, RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const body = await readBody<{
    name?: string
    latitude?: number
    longitude?: number
    radius_m?: number
  }>(event)

  const name = body?.name?.trim()
  const lat = Number(body?.latitude)
  const lng = Number(body?.longitude)
  const radius = Math.round(Number(body?.radius_m))

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Nama kantor wajib diisi' })
  if (!isFinite(lat) || Math.abs(lat) > 90) {
    throw createError({ statusCode: 400, statusMessage: 'Latitude tidak valid (-90 sd 90)' })
  }
  if (!isFinite(lng) || Math.abs(lng) > 180) {
    throw createError({ statusCode: 400, statusMessage: 'Longitude tidak valid (-180 sd 180)' })
  }
  if (!Number.isInteger(radius) || radius < 5 || radius > 5000) {
    throw createError({ statusCode: 400, statusMessage: 'Radius harus antara 5-5000 meter' })
  }

  const db = useDb()
  const [existing] = await db.query<RowDataPacket[]>('SELECT id FROM offices ORDER BY id LIMIT 1')

  if (existing[0]) {
    await db.query<ResultSetHeader>(
      'UPDATE offices SET name = ?, latitude = ?, longitude = ?, radius_m = ? WHERE id = ?',
      [name, lat, lng, radius, existing[0].id]
    )
    await recordActivity(event, auth, {
      action: 'update',
      entity: 'office',
      entityId: existing[0].id,
      summary: `Mengubah lokasi kantor "${name}" — radius ${radius} m`
    })
    return { id: existing[0].id, name, latitude: lat, longitude: lng, radius_m: radius }
  }

  const [result] = await db.query<ResultSetHeader>(
    'INSERT INTO offices (name, latitude, longitude, radius_m) VALUES (?, ?, ?, ?)',
    [name, lat, lng, radius]
  )
  await recordActivity(event, auth, {
    action: 'create',
    entity: 'office',
    entityId: result.insertId,
    summary: `Menambahkan lokasi kantor "${name}" — radius ${radius} m`
  })
  return { id: result.insertId, name, latitude: lat, longitude: lng, radius_m: radius }
})
