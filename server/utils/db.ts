import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function useDb() {
  if (!pool) {
    const config = useRuntimeConfig()
    const useSsl = String(config.dbSsl || '').toLowerCase() === 'true'
    pool = mysql.createPool({
      host: config.dbHost,
      port: Number(config.dbPort),
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      waitForConnections: true,
      connectionLimit: useSsl ? 3 : 10,
      decimalNumbers: true,
      ...(useSsl && {
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true
        }
      })
    })
  }
  return pool
}
