export interface AppSettings {
  work_start_time: string
  work_end_time: string
  work_days: number[]
  annual_leave_quota: number
}

const FALLBACK: AppSettings = {
  work_start_time: '08:00',
  work_end_time: '17:00',
  work_days: [1, 2, 3, 4, 5],
  annual_leave_quota: 12
}

export function useSettings() {
  const api = useApi()
  const settings = useState<AppSettings>('app_settings', () => FALLBACK)
  const loaded = useState<boolean>('app_settings_loaded', () => false)

  async function load(force = false) {
    if (loaded.value && !force) return settings.value
    try {
      settings.value = await api<AppSettings>('/api/settings')
      loaded.value = true
    } catch {
      // keep fallback
    }
    return settings.value
  }

  return { settings, load }
}

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function workDaysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 0) return '—'
  // contiguous range like Mon-Fri → "Sen–Jum"
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (isContiguous && sorted.length >= 2) {
    return `${DAY_NAMES[sorted[0]]}–${DAY_NAMES[sorted[sorted.length - 1]]}`
  }
  return sorted.map((d) => DAY_NAMES[d]).join(', ')
}

export function isLate(checkInIso: string, workStartTime: string): boolean {
  const d = new Date(checkInIso)
  const [h, m] = workStartTime.split(':').map(Number)
  const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0).getTime()
  return d.getTime() > startMs
}
