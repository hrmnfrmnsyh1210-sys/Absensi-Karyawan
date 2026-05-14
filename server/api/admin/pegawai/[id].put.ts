import type { ResultSetHeader } from 'mysql2'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }
  const body = await readBody<{
    nip?: string
    email?: string
    name?: string
    role?: 'admin' | 'pegawai'
    password?: string
    jabatan?: string
    tanggal_lahir?: string
  }>(event)

  const nip = body?.nip?.trim()
  const email = body?.email?.trim().toLowerCase()
  const name = body?.name?.trim()
  const role = body?.role === 'admin' ? 'admin' : 'pegawai'
  const password = body?.password
  const jabatan = body?.jabatan?.trim() || null
  const tanggal_lahir = body?.tanggal_lahir?.trim() || null

  if (!nip || !email || !name) {
    throw createError({ statusCode: 400, statusMessage: 'NIP, email, dan nama wajib diisi' })
  }

  const db = useDb()
  try {
    if (password && password.length > 0) {
      if (password.length < 6) {
        throw createError({ statusCode: 400, statusMessage: 'Password minimal 6 karakter' })
      }
      const hash = await hashPassword(password)
      await db.query<ResultSetHeader>(
        'UPDATE users SET nip = ?, email = ?, name = ?, role = ?, jabatan = ?, tanggal_lahir = ?, password_hash = ? WHERE id = ?',
        [nip, email, name, role, jabatan, tanggal_lahir, hash, id]
      )
    } else {
      await db.query<ResultSetHeader>(
        'UPDATE users SET nip = ?, email = ?, name = ?, role = ?, jabatan = ?, tanggal_lahir = ? WHERE id = ?',
        [nip, email, name, role, jabatan, tanggal_lahir, id]
      )
    }
    return { id, nip, email, name, role, jabatan, tanggal_lahir }
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, statusMessage: 'NIP atau email sudah dipakai user lain' })
    }
    throw e
  }
})
