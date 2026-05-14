import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RowDataPacket } from 'mysql2'

interface LeaveRow extends RowDataPacket {
  user_id: number
  attachment_path: string | null
  attachment_name: string | null
  attachment_type: string | null
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }

  const db = useDb()
  const [rows] = await db.query<LeaveRow[]>(
    'SELECT user_id, attachment_path, attachment_name, attachment_type FROM leaves WHERE id = ? LIMIT 1',
    [id]
  )
  const leave = rows[0]
  if (!leave || !leave.attachment_path) {
    throw createError({ statusCode: 404, statusMessage: 'Lampiran tidak ditemukan' })
  }

  // Hanya pemilik pengajuan atau admin yang boleh membuka lampiran.
  if (auth.role !== 'admin' && auth.sub !== leave.user_id) {
    throw createError({ statusCode: 403, statusMessage: 'Tidak boleh mengakses lampiran ini' })
  }

  // Cegah path traversal — path di DB selalu relatif tanpa "..".
  const rel = String(leave.attachment_path)
  if (rel.includes('..') || rel.startsWith('/') || rel.startsWith('\\')) {
    throw createError({ statusCode: 400, statusMessage: 'Path lampiran tidak valid' })
  }

  let data: Buffer
  try {
    data = await readFile(join(UPLOAD_ROOT, rel))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File lampiran hilang dari server' })
  }

  setHeader(event, 'Content-Type', leave.attachment_type || 'application/octet-stream')
  setHeader(
    event,
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(leave.attachment_name || 'lampiran')}"`
  )
  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return data
})
