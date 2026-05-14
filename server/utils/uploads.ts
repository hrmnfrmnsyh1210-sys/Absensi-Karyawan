import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

// Folder penyimpanan lampiran (di luar git — lihat .gitignore).
export const UPLOAD_ROOT = join(process.cwd(), 'uploads')

// MIME yang diperbolehkan untuk lampiran pengajuan cuti/izin → ekstensi file.
export const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf'
}

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5 MB

interface UploadedPart {
  filename?: string
  type?: string
  data: Buffer
}

/**
 * Simpan lampiran pengajuan ke folder uploads/leaves dan kembalikan
 * metadata yang akan disimpan di kolom DB.
 */
export async function saveLeaveAttachment(file: UploadedPart) {
  const mime = (file.type || '').toLowerCase()
  const ext = ALLOWED_ATTACHMENT_TYPES[mime]
  if (!ext) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Lampiran harus berupa PDF atau gambar (png/jpg/gif/webp)'
    })
  }
  if (!file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'File lampiran kosong' })
  }
  if (file.data.length > MAX_ATTACHMENT_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Ukuran lampiran maksimal 5 MB' })
  }

  const dir = join(UPLOAD_ROOT, 'leaves')
  await mkdir(dir, { recursive: true })
  const stored = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`
  await writeFile(join(dir, stored), file.data)

  return {
    path: `leaves/${stored}`,
    name: (file.filename || `lampiran${ext}`).slice(0, 255),
    type: mime
  }
}
