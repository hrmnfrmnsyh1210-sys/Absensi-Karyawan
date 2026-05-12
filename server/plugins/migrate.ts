const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    description TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date_range (date_from, date_to),
    CONSTRAINT fk_holidays_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
]

let migrationPromise: Promise<void> | null = null

async function runMigrations() {
  const db = useDb()
  for (const sql of MIGRATIONS) {
    await db.query(sql)
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
  })
})
