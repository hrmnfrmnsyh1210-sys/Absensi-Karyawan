import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async () => {
  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, name, latitude, longitude, radius_m FROM offices ORDER BY id LIMIT 1'
  )
  if (!rows[0]) {
    throw createError({ statusCode: 500, statusMessage: 'Lokasi kantor belum dikonfigurasi. Jalankan npm run db:setup' })
  }
  return rows[0]
})
