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
  if (id === auth.sub) {
    throw createError({ statusCode: 400, statusMessage: 'Tidak bisa menghapus akun sendiri' })
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

  // Admin biasa hanya boleh menghapus pegawai.
  if (auth.role !== 'super_admin' && target.role !== 'pegawai') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Hanya super admin yang dapat menghapus akun admin'
    })
  }

  const [result] = await db.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id])
  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })
  }

  await recordActivity(event, auth, {
    action: 'delete',
    entity: 'pegawai',
    entityId: id,
    summary: `Menghapus ${ROLE_LABEL[target.role]} "${target.name}" (NIP ${target.nip})`
  })
  return { ok: true }
})
