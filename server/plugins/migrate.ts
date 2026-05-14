// Statements that are naturally idempotent (CREATE TABLE IF NOT EXISTS, etc).
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

// ALTER statements for tables that may already exist without the newer columns.
// Re-running these is harmless: duplicate-column / duplicate-key errors are ignored.
const ALTERS: string[] = [
  `ALTER TABLE holidays ADD COLUMN source ENUM('manual', 'national') NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE holidays ADD INDEX idx_source (source)`,
  `ALTER TABLE users ADD COLUMN jabatan VARCHAR(128) NULL`,
  `ALTER TABLE users ADD COLUMN tanggal_lahir DATE NULL`,
  // WFH: pegawai yang lokasinya dimatikan admin boleh absen tanpa cek titik GPS.
  `ALTER TABLE users ADD COLUMN wfh TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE attendance MODIFY COLUMN status ENUM('valid', 'out_of_range', 'wfh') NOT NULL DEFAULT 'valid'`,
  // Lampiran pengajuan cuti/izin (pdf / gambar).
  `ALTER TABLE leaves ADD COLUMN attachment_path VARCHAR(512) NULL`,
  `ALTER TABLE leaves ADD COLUMN attachment_name VARCHAR(255) NULL`,
  `ALTER TABLE leaves ADD COLUMN attachment_type VARCHAR(128) NULL`,
  // Role super admin — admin biasa tidak bisa menambah admin lagi.
  `ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'pegawai') NOT NULL DEFAULT 'pegawai'`
]

// MySQL error codes / errnos that mean "this migration was already applied".
const IGNORABLE_CODES = new Set(['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'])
const IGNORABLE_ERRNOS = new Set([1060, 1061])

function isAlreadyApplied(e: any): boolean {
  return IGNORABLE_CODES.has(e?.code) || IGNORABLE_ERRNOS.has(e?.errno)
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

  // Bootstrap super admin: kalau belum ada satu pun super admin (mis. DB lama),
  // naikkan akun admin tertua menjadi super admin supaya role ini tetap terpakai.
  const [supers] = await db.query<any[]>(
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
