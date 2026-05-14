import type { ResultSetHeader } from 'mysql2'
import type { UserRole } from '../../../utils/auth'

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  pegawai: 'Pegawai'
}

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const body = await readBody<{
    nip?: string
    email?: string
    name?: string
    password?: string
    role?: UserRole
    jabatan?: string
    tanggal_lahir?: string
    wfh?: boolean
  }>(event)

  const nip = body?.nip?.trim()
  const email = body?.email?.trim().toLowerCase()
  const name = body?.name?.trim()
  const password = body?.password
  const role: UserRole =
    body?.role === 'admin' || body?.role === 'super_admin' ? body.role : 'pegawai'
  const jabatan = body?.jabatan?.trim() || null
  const tanggal_lahir = body?.tanggal_lahir?.trim() || null
  const wfh = body?.wfh ? 1 : 0

  // Admin biasa hanya boleh menambahkan pegawai — bukan admin/super admin.
  if (role !== 'pegawai' && auth.role !== 'super_admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Hanya super admin yang dapat menambahkan akun admin'
    })
  }

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
      'INSERT INTO users (nip, email, name, password_hash, role, jabatan, tanggal_lahir, wfh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nip, email, name, hash, role, jabatan, tanggal_lahir, wfh]
    )
    await recordActivity(event, auth, {
      action: 'create',
      entity: 'pegawai',
      entityId: result.insertId,
      summary: `Menambahkan ${ROLE_LABEL[role]} "${name}" (NIP ${nip})`
    })
    return { id: result.insertId, nip, email, name, role, jabatan, tanggal_lahir, wfh }
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, statusMessage: 'NIP atau email sudah terdaftar' })
    }
    throw e
  }
})
