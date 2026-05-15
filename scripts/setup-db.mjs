import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import 'dotenv/config'

const dbName = process.env.DB_NAME || 'absensi_karyawan'
const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true'

const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
  ...(useSsl && {
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  })
}

const conn = await mysql.createConnection(useSsl ? { ...baseConfig, database: 'test' } : baseConfig)

if (useSsl) {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
  await conn.query(`USE \`${dbName}\``)
  console.log(`[ok] Database "${dbName}" siap dipakai`)
} else {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await conn.query(`USE \`${dbName}\``)
}

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf-8')
await conn.query(schema)
console.log('[ok] Schema dibuat / diverifikasi')

const [officeRows] = await conn.query('SELECT id FROM offices LIMIT 1')
if (officeRows.length === 0) {
  await conn.query(
    'INSERT INTO offices (name, latitude, longitude, radius_m) VALUES (?, ?, ?, ?)',
    ['Kantor Pusat', -0.0263, 109.3425, 50]
  )
  console.log('[ok] Office default ditambahkan (Pontianak, radius 50 m)')
}

const defaultSettings = [
  ['work_start_time', '08:00'],
  ['work_end_time', '17:00'],
  ['work_days', '1,2,3,4,5'],
  ['annual_leave_quota', '12']
]
for (const [k, v] of defaultSettings) {
  await conn.query(
    'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_key = setting_key',
    [k, v]
  )
}
console.log('[ok] App settings default diverifikasi')

const seeds = [
  { nip: 'SADM001', email: 'superadmin@example.com', name: 'Super Admin', password: 'superadmin123', role: 'super_admin' },
  { nip: 'ADM001', email: 'admin@example.com', name: 'Admin Utama', password: 'admin123', role: 'admin' },
  { nip: 'P001', email: 'pegawai@example.com', name: 'Budi Pegawai', password: 'pegawai123', role: 'pegawai' }
]

for (const u of seeds) {
  const [exist] = await conn.query('SELECT id FROM users WHERE nip = ? OR email = ?', [u.nip, u.email])
  if (exist.length) {
    console.log(`[skip] User ${u.nip} sudah ada`)
    continue
  }
  const hash = await bcrypt.hash(u.password, 10)
  await conn.query(
    'INSERT INTO users (nip, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [u.nip, u.email, u.name, hash, u.role]
  )
  console.log(`[ok] User ${u.nip} (${u.role}) - login pakai password "${u.password}"`)
}

await conn.end()
console.log('\nSetup selesai. Jalankan: npm run dev')
