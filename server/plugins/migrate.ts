import type { Pool } from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2'

// Tabel baru — CREATE TABLE IF NOT EXISTS aman dijalankan berulang kali.
const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    description TEXT NULL,
    source ENUM('manual', 'national') NOT NULL DEFAULT 'manual',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date_range (date_from, date_to),
    CONSTRAINT fk_holidays_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Web push subscriptions — disimpan per device per user.
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint VARCHAR(512) NOT NULL UNIQUE,
    p256dh VARCHAR(255) NOT NULL,
    auth_key VARCHAR(255) NOT NULL,
    user_agent VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL,
    INDEX idx_push_user (user_id),
    CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Activity log — super admin memantau aksi yang dilakukan admin.
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entity_id INT NULL,
    summary VARCHAR(512) NOT NULL,
    ip_address VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created (created_at),
    INDEX idx_actor (actor_id),
    CONSTRAINT fk_log_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
]

// Penambahan kolom / index sederhana untuk tabel yang mungkin masih versi lama.
// Re-run aman: error "kolom/index sudah ada" diabaikan.
const ALTERS: string[] = [
  `ALTER TABLE holidays ADD COLUMN source ENUM('manual', 'national') NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE holidays ADD INDEX idx_source (source)`,
  `ALTER TABLE users ADD COLUMN jabatan VARCHAR(128) NULL`,
  `ALTER TABLE users ADD COLUMN tanggal_lahir DATE NULL`,
  // Lampiran pengajuan cuti/izin (pdf / gambar).
  `ALTER TABLE leaves ADD COLUMN attachment_path VARCHAR(512) NULL`,
  `ALTER TABLE leaves ADD COLUMN attachment_name VARCHAR(255) NULL`,
  `ALTER TABLE leaves ADD COLUMN attachment_type VARCHAR(128) NULL`
]

// MySQL/TiDB error codes / errnos yang berarti "migrasi ini sudah pernah diterapkan".
//  1060 ER_DUP_FIELDNAME       — ADD COLUMN tapi kolom sudah ada
//  1061 ER_DUP_KEYNAME         — ADD INDEX tapi index sudah ada
//  1091 ER_CANT_DROP_FIELD_OR_KEY — DROP COLUMN tapi kolom sudah tidak ada
const IGNORABLE_CODES = new Set([
  'ER_DUP_FIELDNAME',
  'ER_DUP_KEYNAME',
  'ER_CANT_DROP_FIELD_OR_KEY'
])
const IGNORABLE_ERRNOS = new Set([1060, 1061, 1091])

function isAlreadyApplied(e: any): boolean {
  return IGNORABLE_CODES.has(e?.code) || IGNORABLE_ERRNOS.has(e?.errno)
}

// COLUMN_TYPE sebuah kolom, mis. "enum('valid','out_of_range')".
// null kalau tabel/kolom tidak ada.
async function getColumnType(db: Pool, table: string, column: string): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  )
  return (rows[0]?.t as string | undefined) ?? null
}

let migrationPromise: Promise<void> | null = null

async function runMigrations() {
  const db = useDb()

  for (const sql of MIGRATIONS) {
    await db.query(sql)
  }
  for (const sql of ALTERS) {
    try {
      await db.query(sql)
    } catch (e: any) {
      if (!isAlreadyApplied(e)) throw e
    }
  }

  // --- Perubahan ENUM (idempoten via cek information_schema, aman untuk TiDB) ---
  // Catatan TiDB: nilai enum baru HARUS ditambahkan di akhir daftar — TiDB tidak
  // mendukung menyisipkan / menyusun ulang elemen enum yang sudah ada.

  // attendance.status: tambahkan nilai 'wfh' (dipakai saat mode WFH global aktif).
  const statusType = await getColumnType(db, 'attendance', 'status')
  if (statusType && !statusType.includes("'wfh'")) {
    await db.query(
      `ALTER TABLE attendance
       MODIFY COLUMN status ENUM('valid', 'out_of_range', 'wfh') NOT NULL DEFAULT 'valid'`
    )
  }

  // users.role: tambahkan 'super_admin' di akhir daftar enum.
  const roleType = await getColumnType(db, 'users', 'role')
  if (roleType && !roleType.includes("'super_admin'")) {
    await db.query(
      `ALTER TABLE users
       MODIFY COLUMN role ENUM('admin', 'pegawai', 'super_admin') NOT NULL DEFAULT 'pegawai'`
    )
  }

  // users.wfh: kolom ini sempat dipakai (WFH per-pegawai) lalu diganti setting
  // global location_check_enabled. Hapus kalau masih tersisa di DB lama.
  const wfhType = await getColumnType(db, 'users', 'wfh')
  if (wfhType) {
    try {
      await db.query('ALTER TABLE users DROP COLUMN wfh')
    } catch (e: any) {
      if (!isAlreadyApplied(e)) throw e
    }
  }

  // Bootstrap super admin: kalau belum ada satu pun super admin (mis. DB lama),
  // naikkan akun admin tertua menjadi super admin supaya role ini tetap terpakai.
  const [supers] = await db.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE role = 'super_admin' LIMIT 1"
  )
  if (!supers.length) {
    await db.query(
      "UPDATE users SET role = 'super_admin' WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    )
  }
}

function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = runMigrations()
      .then(() => { console.log('[migrate] schema synced') })
      .catch((e) => {
        console.error('[migrate] failed:', e)
        migrationPromise = null // allow retry on next request
        throw e
      })
  }
  return migrationPromise
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async () => {
    await ensureMigrated().catch(() => {
      // swallow — endpoints will surface real error if their queries fail
    })
    // Fire-and-forget: make sure the current year's national holidays exist.
    // Self-guarded so it runs at most once per cold start.
    ensureCurrentYearSynced().catch(() => {})
  })
})
