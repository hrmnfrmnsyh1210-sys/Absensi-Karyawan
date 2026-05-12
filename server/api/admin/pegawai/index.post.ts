import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody<{
    nip?: string
    email?: string
    name?: string
    password?: string
    role?: 'admin' | 'pegawai'
  }>(event)

  const nip = body?.nip?.trim()
  const email = body?.email?.trim().toLowerCase()
  const name = body?.name?.trim()
  const password = body?.password
  const role = body?.role === 'admin' ? 'admin' : 'pegawai'

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
      'INSERT INTO users (nip, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [nip, email, name, hash, role]
    )
    return { id: result.insertId, nip, email, name, role }
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, statusMessage: 'NIP atau email sudah terdaftar' })
    }
    throw e
  }
})
