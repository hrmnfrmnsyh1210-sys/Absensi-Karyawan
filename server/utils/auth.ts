import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { H3Event } from 'h3'

export interface JwtPayload {
  sub: number
  nip: string
  role: 'admin' | 'pegawai'
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash)
}

export function signToken(payload: JwtPayload) {
  const secret = useRuntimeConfig().jwtSecret
  return jwt.sign(payload, secret, { expiresIn: '12h' })
}

export function requireAuth(event: H3Event): JwtPayload {
  const auth = getHeader(event, 'authorization')
  if (!auth?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  try {
    const secret = useRuntimeConfig().jwtSecret
    return jwt.verify(auth.slice(7), secret) as JwtPayload
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Token tidak valid atau kedaluwarsa' })
  }
}

export function requireAdmin(event: H3Event): JwtPayload {
  const payload = requireAuth(event)
  if (payload.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Hanya admin yang boleh mengakses' })
  }
  return payload
}
