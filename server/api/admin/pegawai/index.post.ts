import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody<{
    nip?: string
    email?: string
    name?: string
    password?: string
    role?: 'admin' | 'pegawai'
    jabatan?: string
    tanggal_lahir?: string
  }>(event)

  const nip = body?.nip?.trim()
  const email = body?.email?.trim().toLowerCase()
  const name = body?.name?.trim()
  const password = body?.password
  const role = body?.role === 'admin' ? 'admin' : 'pegawai'
  const jabatan = body?.jabatan?.trim() || null
  const tanggal_lahir = body?.tanggal_lahir?.trim() || null

  if (!nip || !email || !name || !password) {
    throw createError({ statusCode: 400, statusMessage: 'NIP, email, nama, dan password wajib diisi' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Password minimal 6 karakter' })
  }

  const db = useDb()
  try {
    const hash = await hashPassword(password)
    const [result] = await db.query<ResultSetHeader>(
      'INSERT INTO users (nip, email, name, password_hash, role, jabatan, tanggal_lahir) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nip, email, name, hash, role, jabatan, tanggal_lahir]
    )
    return { id: result.insertId, nip, email, name, role, jabatan, tanggal_lahir }
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, statusMessage: 'NIP atau email sudah terdaftar' })
    }
    throw e
  }
})
