import PDFDocument from 'pdfkit'
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
    `SELECT a.id, u.nip, u.name, a.type, a.distance_m, a.status, a.recorded_at
     FROM attendance a INNER JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.recorded_at DESC
     LIMIT 5000`,
    params
  )

  const buffer: Buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(16).font('Helvetica-Bold').text('Rekap Absensi Karyawan', { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(9).font('Helvetica').fillColor('#555')
    const periode = from || to ? `Periode: ${from || '-'} s/d ${to || '-'}` : 'Periode: Semua'
    doc.text(periode, { align: 'center' })
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'center' })
    doc.fillColor('#000').moveDown(0.8)

    const cols = [
      { key: 'recorded_at', label: 'Waktu', width: 110 },
      { key: 'nip', label: 'NIP', width: 70 },
      { key: 'name', label: 'Nama', width: 180 },
      { key: 'type', label: 'Tipe', width: 60 },
      { key: 'distance_m', label: 'Jarak (m)', width: 65 },
      { key: 'status', label: 'Status', width: 80 }
    ]
    const startX = doc.x
    const rowHeight = 18

    function drawHeader(y: number) {
      doc.rect(startX, y, cols.reduce((s, c) => s + c.width, 0), rowHeight).fill('#0EA5E9')
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9)
      let x = startX
      for (const c of cols) {
        doc.text(c.label, x + 5, y + 5, { width: c.width - 10, ellipsis: true })
        x += c.width
      }
      doc.fillColor('#000').font('Helvetica')
    }

    let y = doc.y
    drawHeader(y)
    y += rowHeight

    for (const r of rows) {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        y = doc.page.margins.top
        drawHeader(y)
        y += rowHeight
      }
      doc.fontSize(8)
      let x = startX
      const fmt = (k: string, v: any) => {
        if (k === 'recorded_at') return new Date(v).toLocaleString('id-ID')
        if (k === 'type') return v === 'check_in' ? 'Masuk' : 'Pulang'
        if (k === 'status') return v === 'valid' ? 'Valid' : v === 'wfh' ? 'WFH' : 'Out of range'
        return String(v)
      }
      for (const c of cols) {
        doc.text(fmt(c.key, (r as any)[c.key]), x + 5, y + 5, {
          width: c.width - 10,
          ellipsis: true
        })
        x += c.width
      }
      doc.moveTo(startX, y + rowHeight).lineTo(startX + cols.reduce((s, c) => s + c.width, 0), y + rowHeight).strokeColor('#e5e7eb').stroke()
      y += rowHeight
    }

    doc.moveDown(2)
    doc.fontSize(8).fillColor('#666').text(`Total: ${rows.length} record`, { align: 'right' })

    doc.end()
  })

  const filename = `rekap-absensi-${new Date().toISOString().slice(0, 10)}.pdf`
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`
  })
  return buffer
})
