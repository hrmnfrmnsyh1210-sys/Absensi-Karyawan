import type { RowDataPacket } from 'mysql2'

// Google Calendar public ICS feed for Indonesian national holidays.
// Includes "Hari libur nasional" (tanggal merah) AND "Cuti Bersama" entries —
// both carry DESCRIPTION starting with "Hari libur nasional". Pure observances
// ("Perayaan", e.g. Malam Tahun Baru, 1 Ramadan) are filtered out.
const ICS_URL =
  'https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics'

export interface NationalHoliday {
  name: string
  date_from: string
  date_to: string
}

function unescapeIcs(v: string): string {
  return v
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

function icsDateToYmd(raw: string): string {
  // raw like "20260101" (or "20260101T000000Z" — we only need the date part)
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Parse the ICS feed text and return national holidays falling in `year`. */
export function parseNationalHolidays(ics: string, year: number): NationalHoliday[] {
  // Unfold folded lines (continuation lines start with a space or tab).
  const unfolded = ics.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  const out: NationalHoliday[] = []
  let cur: Record<string, string> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (cur) {
        const startRaw = cur.DTSTART
        const endRaw = cur.DTEND
        const desc = cur.DESCRIPTION || ''
        const summary = cur.SUMMARY || ''
        if (startRaw && /^Hari libur nasional/i.test(desc)) {
          const dateFrom = icsDateToYmd(startRaw)
          // DTEND is exclusive in ICS; the real last day is DTEND - 1.
          const dateToRaw = endRaw ? addDays(icsDateToYmd(endRaw), -1) : dateFrom
          const dateTo = dateToRaw < dateFrom ? dateFrom : dateToRaw
          if (Number(dateFrom.slice(0, 4)) === year) {
            out.push({
              name: unescapeIcs(summary) || 'Hari Libur Nasional',
              date_from: dateFrom,
              date_to: dateTo
            })
          }
        }
      }
      cur = null
      continue
    }
    if (!cur) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    // key may carry params, e.g. "DTSTART;VALUE=DATE"
    const key = line.slice(0, idx).split(';')[0].toUpperCase()
    cur[key] = line.slice(idx + 1)
  }

  return out
}

/**
 * Fetch the Indonesian national holiday calendar and replace all
 * `source='national'` rows for the given year. Idempotent.
 */
export async function syncNationalHolidays(
  year?: number
): Promise<{ year: number; count: number }> {
  const targetYear = year || new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear()
  const ics = await $fetch<string>(ICS_URL, { responseType: 'text', timeout: 15000 })
  const holidays = parseNationalHolidays(ics, targetYear)

  const db = useDb()
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      'DELETE FROM holidays WHERE source = ? AND YEAR(date_from) = ?',
      ['national', targetYear]
    )
    for (const h of holidays) {
      await conn.query(
        `INSERT INTO holidays (name, date_from, date_to, description, source, created_by)
         VALUES (?, ?, ?, ?, 'national', NULL)`,
        [h.name, h.date_from, h.date_to, 'Hari libur nasional (kalender Indonesia)']
      )
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  return { year: targetYear, count: holidays.length }
}

let currentYearSyncPromise: Promise<void> | null = null

/**
 * Ensure the current year's national holidays exist in the DB.
 * Runs at most once per cold start; safe to call on every request.
 */
export function ensureCurrentYearSynced(): Promise<void> {
  if (!currentYearSyncPromise) {
    currentYearSyncPromise = (async () => {
      const year = new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear()
      const db = useDb()
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT id FROM holidays WHERE source = ? AND YEAR(date_from) = ? LIMIT 1',
        ['national', year]
      )
      if (rows.length) return
      const result = await syncNationalHolidays(year)
      console.log(`[holidaySync] ${result.count} national holidays for ${year} synced`)
    })().catch((e) => {
      console.error('[holidaySync] auto-sync failed:', e)
      currentYearSyncPromise = null // allow retry on the next cold-start request
    })
  }
  return currentYearSyncPromise
}
