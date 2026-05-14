import type { RowDataPacket } from 'mysql2'

interface UserRow extends RowDataPacket {
  id: number
  nip: string
  email: string
  name: string
  password_hash: string
  role: 'admin' | 'pegawai'
  jabatan: string | null
  tanggal_lahir: string | null
  wfh: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ identifier?: string; password?: string }>(event)
  const identifier = body?.identifier?.trim()
  const password = body?.password

  if (!identifier || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email/NIP dan password wajib diisi' })
  }

  const db = useDb()
  const [rows] = await db.query<UserRow[]>(
    `SELECT id, nip, email, name, password_hash, role, jabatan,
            DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS tanggal_lahir, wfh
     FROM users WHERE email = ? OR nip = ? LIMIT 1`,
    [identifier, identifier]
  )
  const user = rows[0]
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw createError({ statusCode: 401, statusMessage: 'Email/NIP atau password salah' })
  }

  const token = signToken({ sub: user.id, nip: user.nip, role: user.role })
  return {
    token,
    user: {
      id: user.id,
      nip: user.nip,
      email: user.email,
      name: user.name,
      role: user.role,
      jabatan: user.jabatan,
      tanggal_lahir: user.tanggal_lahir,
      wfh: user.wfh
    }
  }
})
