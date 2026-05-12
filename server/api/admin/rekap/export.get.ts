import ExcelJS from 'exceljs'
import type { RowDataPacket } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const query = getQuery(event)
  const from = (query.from as string | undefined) || null
  const to = (query.to as string | undefined) || null
  const userId = query.user_id ? Number(query.user_id) : null

  const conds: string[] = []
  const params: any[] = []
  if (from) { conds.push('DATE(a.recorded_at) >= ?'); params.push(from) }
  if (to) { conds.push('DATE(a.recorded_at) <= ?'); params.push(to) }
  if (userId) { conds.push('a.user_id = ?'); params.push(userId) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  const db = useDb()
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT a.id, u.nip, u.name, u.email, a.type, a.latitude, a.longitude,
            a.distance_m, a.status, a.recorded_at
     FROM attendance a INNER JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.recorded_at DESC
     LIMIT 10000`,
    params
  )

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Absensi Karyawan'
  wb.created = new Date()
  const ws = wb.addWorksheet('Rekap Absensi')
  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'NIP', key: 'nip', width: 14 },
    { header: 'Nama', key: 'name', width: 28 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Tipe', key: 'type', width: 12 },
    { header: 'Latitude', key: 'latitude', width: 14 },
    { header: 'Longitude', key: 'longitude', width: 14 },
    { header: 'Jarak (m)', key: 'distance_m', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Waktu', key: 'recorded_at', width: 22 }
  ]
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0EA5E9' }
  }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const r of rows) {
    ws.addRow({
      id: r.id,
      nip: r.nip,
      name: r.name,
      email: r.email,
      type: r.type === 'check_in' ? 'Masuk' : 'Pulang',
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      distance_m: r.distance_m,
      status: r.status === 'valid' ? 'Valid' : 'Out of range',
      recorded_at: new Date(r.recorded_at).toLocaleString('id-ID')
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `rekap-absensi-${new Date().toISOString().slice(0, 10)}.xlsx`
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`
  })
  return buffer
})
