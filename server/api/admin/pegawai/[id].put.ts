import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { UserRole } from '../../../utils/auth'

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  pegawai: 'Pegawai'
}

interface TargetRow extends RowDataPacket {
  role: UserRole
  name: string
  nip: string
}

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid' })
  }
  const body = await readBody<{
    nip?: string
    email?: string
    name?: string
    role?: UserRole
    password?: string
    jabatan?: string
    tanggal_lahir?: string
    wfh?: boolean
  }>(event)

  const nip = body?.nip?.trim()
  const email = body?.email?.trim().toLowerCase()
  const name = body?.name?.trim()
  const role: UserRole =
    body?.role === 'admin' || body?.role === 'super_admin' ? body.role : 'pegawai'
  const password = body?.password
  const jabatan = body?.jabatan?.trim() || null
  const tanggal_lahir = body?.tanggal_lahir?.trim() || null
  const wfh = body?.wfh ? 1 : 0

  if (!nip || !email || !name) {
    throw createError({ statusCode: 400, statusMessage: 'NIP, email, dan nama wajib diisi' })
  }

  const db = useDb()
  const [targetRows] = await db.query<TargetRow[]>(
    'SELECT role, name, nip FROM users WHERE id = ? LIMIT 1',
    [id]
  )
  const target = targetRows[0]
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })
  }

  // Admin biasa hanya boleh mengelola pegawai, dan tidak boleh menaikkan peran ke admin.
  if (auth.role !== 'super_admin') {
    if (target.role !== 'pegawai') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Hanya super admin yang dapat mengubah akun admin'
      })
    }
    if (role !== 'pegawai') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Hanya super admin yang dapat menetapkan peran admin'
      })
    }
  }

  try {
    if (password && password.length > 0) {
      if (password.length < 6) {
        throw createError({ statusCode: 400, statusMessage: 'Password minimal 6 karakter' })
      }
      const hash = await hashPassword(password)
      await db.query<ResultSetHeader>(
        'UPDATE users SET nip = ?, email = ?, name = ?, role = ?, jabatan = ?, tanggal_lahir = ?, wfh = ?, password_hash = ? WHERE id = ?',
        [nip, email, name, role, jabatan, tanggal_lahir, wfh, hash, id]
      )
    } else {
      await db.query<ResultSetHeader>(
        'UPDATE users SET nip = ?, email = ?, name = ?, role = ?, jabatan = ?, tanggal_lahir = ?, wfh = ? WHERE id = ?',
        [nip, email, name, role, jabatan, tanggal_lahir, wfh, id]
      )
    }

    const roleChanged = target.role !== role
    await recordActivity(event, auth, {
      action: 'update',
      entity: 'pegawai',
      entityId: id,
      summary:
        `Memperbarui ${ROLE_LABEL[target.role]} "${name}" (NIP ${nip})` +
        (roleChanged ? ` — peran diubah ke ${ROLE_LABEL[role]}` : '') +
        (password ? ' — password direset' : '')
    })
    return { id, nip, email, name, role, jabatan, tanggal_lahir, wfh }
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, statusMessage: 'NIP atau email sudah dipakai user lain' })
    }
    throw e
  }
})
