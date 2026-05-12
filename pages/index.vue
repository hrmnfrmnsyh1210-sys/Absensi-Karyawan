<script setup lang="ts">
interface TodayRecord {
  id: number
  type: 'check_in' | 'check_out'
  recorded_at: string
  distance_m: number
}
interface Office {
  id: number
  name: string
  latitude: number
  longitude: number
  radius_m: number
}
interface AttendanceRecord {
  id: number
  type: 'check_in' | 'check_out'
  status: 'valid' | 'out_of_range'
  recorded_at: string
}
interface Leave {
  id: number
  type: 'izin' | 'sakit' | 'cuti'
  date_from: string
  date_to: string
  status: 'pending' | 'approved' | 'rejected'
}
interface Holiday {
  id: number
  name: string
  date_from: string
  date_to: string
  description: string | null
}

const api = useApi()
const { user } = useAuth()
const { settings, load: loadSettings } = useSettings()

const today = ref<{ check_in: TodayRecord | null; check_out: TodayRecord | null }>({
  check_in: null,
  check_out: null
})
const office = ref<Office | null>(null)
const history = ref<AttendanceRecord[]>([])
const leaves = ref<Leave[]>([])
const holidays = ref<Holiday[]>([])
const unreadNotif = ref(0)

async function load() {
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const monthAhead = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
  const [t, o, h, l, hd, n] = await Promise.all([
    api<typeof today.value>('/api/attendance/today'),
    api<Office>('/api/office').catch(() => null),
    api<AttendanceRecord[]>('/api/attendance/history?limit=30').catch(() => []),
    api<Leave[]>('/api/leaves/mine').catch(() => []),
    api<Holiday[]>('/api/holidays', { query: { from: monthAgo, to: monthAhead } }).catch(() => []),
    api<{ count: number }>('/api/notifications/unread-count').catch(() => ({ count: 0 })),
    loadSettings()
  ])
  today.value = t
  office.value = o
  history.value = h
  leaves.value = l
  holidays.value = hd
  unreadNotif.value = n.count
}
await load()

onMounted(() => {
  if (!import.meta.client) return
  const onFocus = () => {
    api<{ count: number }>('/api/notifications/unread-count')
      .then(r => { unreadNotif.value = r.count })
      .catch(() => {})
  }
  window.addEventListener('focus', onFocus)
  onUnmounted(() => window.removeEventListener('focus', onFocus))
})

function useNow(opts: { interval: number }) {
  const r = ref(new Date())
  if (import.meta.client) {
    const id = setInterval(() => { r.value = new Date() }, opts.interval)
    onUnmounted(() => clearInterval(id))
  }
  return r
}
const now = useNow({ interval: 1000 })

const dateLabel = computed(() => now.value.toLocaleDateString('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long'
}))
const timeLabel = computed(() => now.value.toLocaleTimeString('id-ID', {
  hour: '2-digit', minute: '2-digit'
}))

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
})

const initials = computed(() => {
  const n = user.value?.name?.trim() || 'U'
  return n.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
})

const status = computed(() => {
  if (today.value.check_out) return { label: 'Sudah pulang', dot: 'bg-hadir-ink-50' }
  if (today.value.check_in) return { label: 'Sedang bekerja', dot: 'bg-hadir-teal' }
  return { label: 'Belum absen', dot: 'bg-hadir-amber' }
})

function fmtTime(iso?: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'
}

function durationDays(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.round(ms / 86400000) + 1
}

const currentYear = computed(() => now.value.getFullYear())

const cutiUsed = computed(() =>
  leaves.value
    .filter(l => l.type === 'cuti' && l.status === 'approved'
      && new Date(l.date_from).getFullYear() === currentYear.value)
    .reduce((s, l) => s + durationDays(l.date_from, l.date_to), 0)
)
const cutiRemaining = computed(() => Math.max(0, settings.value.annual_leave_quota - cutiUsed.value))

const sakitYTD = computed(() =>
  leaves.value.filter(l => l.type === 'sakit' && l.status === 'approved'
    && new Date(l.date_from).getFullYear() === currentYear.value).length
)

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isHolidayDate(dateStr: string) {
  return holidays.value.some(h =>
    dateStr >= h.date_from.slice(0, 10) && dateStr <= h.date_to.slice(0, 10)
  )
}
function holidayName(dateStr: string) {
  const h = holidays.value.find(x =>
    dateStr >= x.date_from.slice(0, 10) && dateStr <= x.date_to.slice(0, 10)
  )
  return h?.name || null
}

const upcomingHolidays = computed(() => {
  const todayStr = ymd(new Date(now.value))
  return holidays.value
    .filter(h => h.date_to.slice(0, 10) >= todayStr)
    .sort((a, b) => a.date_from.localeCompare(b.date_from))
    .slice(0, 3)
})

function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}
function holidayRangeLabel(h: Holiday) {
  const from = h.date_from.slice(0, 10)
  const to = h.date_to.slice(0, 10)
  return from === to ? fmtDateShort(from) : `${fmtDateShort(from)} – ${fmtDateShort(to)}`
}

const week = computed(() => {
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const todayD = new Date(now.value)
  const todayKey = todayD.toDateString()
  const dow = todayD.getDay()
  // workDays uses 1..5 = Mon..Fri (ISO-ish, where 0=Sun, 1=Mon)
  const workDays = settings.value.work_days
  // anchor on Monday of this week
  const monday = new Date(todayD)
  const offset = dow === 0 ? -6 : 1 - dow
  monday.setDate(todayD.getDate() + offset)

  const checkInsByDate = new Map<string, AttendanceRecord>()
  for (const r of history.value) {
    if (r.type !== 'check_in') continue
    const k = new Date(r.recorded_at).toDateString()
    if (!checkInsByDate.has(k)) checkInsByDate.set(k, r)
  }

  // build a list of work-day cells for this week (Mon..Sat covers 1..6)
  const cells: Array<{ d: string; n: string; status: 'on' | 'late' | 'today' | 'absent' | 'pending' | 'holiday'; title?: string }> = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const wd = d.getDay()
    if (!workDays.includes(wd)) continue
    const key = d.toDateString()
    const dateStr = ymd(d)
    const isToday = key === todayKey
    const isPast = d.getTime() < new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate()).getTime()
    const rec = checkInsByDate.get(key)
    const isHoliday = isHolidayDate(dateStr)
    let status: 'on' | 'late' | 'today' | 'absent' | 'pending' | 'holiday'
    if (rec) {
      // Show attendance even if it's a holiday (person came anyway)
      status = isLate(rec.recorded_at, settings.value.work_start_time) ? 'late' : 'on'
    } else if (isHoliday) {
      status = 'holiday'
    } else if (isToday) {
      status = 'today'
    } else {
      status = isPast ? 'absent' : 'pending'
    }
    cells.push({ d: dayNames[wd], n: String(d.getDate()), status, title: holidayName(dateStr) || undefined })
  }
  return cells
})
</script>

<template>
  <div class="flex flex-col">
    <!-- teal hero -->
    <div class="relative overflow-hidden bg-hadir-teal px-5 pt-7 pb-7">
      <div class="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full border-[1.5px] border-white/[0.12]" />
      <div class="relative flex items-center gap-3">
        <div class="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-white to-hadir-amber-sft flex items-center justify-center font-bold text-base text-hadir-teal flex-shrink-0">
          {{ initials }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] text-white/70">{{ greeting }},</p>
          <p class="text-[17px] font-semibold text-white truncate">{{ user?.name || '...' }}</p>
        </div>
        <NuxtLink
          to="/notifikasi"
          class="relative w-[38px] h-[38px] rounded-full bg-white/[0.16] flex items-center justify-center active:scale-95"
          aria-label="Notifikasi"
        >
          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
            <path d="M6 8a6 6 0 1112 0v4l2 4H4l2-4V8z" />
            <path d="M10 19a2 2 0 004 0" />
          </svg>
          <span
            v-if="unreadNotif > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-hadir-amber text-hadir-ink text-[10px] font-bold flex items-center justify-center border-2 border-hadir-teal"
          >{{ unreadNotif > 9 ? '9+' : unreadNotif }}</span>
        </NuxtLink>
      </div>
    </div>

    <!-- clock-in card -->
    <div class="-mt-3 mx-5 bg-white rounded-[20px] p-5 shadow-hadir-card relative z-10">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[13px] text-hadir-ink-70 capitalize font-medium truncate">{{ dateLabel }}</p>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-hadir-teal-sft rounded-full flex-shrink-0">
          <span class="w-2 h-2 rounded-full" :class="status.dot" />
          <span class="text-[11px] font-semibold text-hadir-teal-dk">{{ status.label }}</span>
        </span>
      </div>
      <p class="text-[40px] font-bold text-hadir-ink tracking-[-1px] tabular-nums leading-none mt-3">
        {{ timeLabel }}<span class="text-base text-hadir-ink-50 font-medium ml-1.5 tracking-normal">WIB</span>
      </p>

      <div class="flex gap-2.5 mt-[18px]">
        <NuxtLink
          to="/absen"
          class="flex-1 h-16 rounded-[14px] bg-hadir-teal text-white flex items-center justify-center gap-2.5 shadow-hadir-cta active:scale-[0.98] transition"
          :class="{ 'opacity-60 pointer-events-none': !!today.check_in }"
        >
          <svg class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <div class="text-left">
            <div class="text-[15px] font-bold">Clock In</div>
            <div class="text-[11px] opacity-85">{{ today.check_in ? fmtTime(today.check_in.recorded_at) : 'Mulai bekerja' }}</div>
          </div>
        </NuxtLink>
        <NuxtLink
          to="/absen"
          class="flex-1 h-16 rounded-[14px] flex items-center justify-center gap-2.5 transition active:scale-[0.98]"
          :class="today.check_in && !today.check_out
            ? 'bg-hadir-amber-sft text-hadir-amber'
            : 'bg-[#F2F4F6] text-hadir-ink-50 pointer-events-none'"
        >
          <svg class="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 19l4-4 3 3 7-7" />
            <path d="M14 8h6v6" />
          </svg>
          <div class="text-left">
            <div class="text-[15px] font-semibold">Clock Out</div>
            <div class="text-[11px] opacity-70">{{ today.check_out ? fmtTime(today.check_out.recorded_at) : settings.work_end_time }}</div>
          </div>
        </NuxtLink>
      </div>

      <div v-if="office" class="mt-4 p-3 bg-hadir-bg rounded-xl flex items-center gap-2.5">
        <svg class="w-[18px] h-[18px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8">
          <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" />
          <circle cx="12" cy="9" r="2.6" />
        </svg>
        <p class="flex-1 text-[13px] text-hadir-ink-70 truncate">
          {{ office.name }} · <b class="text-hadir-teal">radius {{ office.radius_m }}m</b>
        </p>
      </div>
    </div>

    <!-- holiday banner -->
    <div v-if="upcomingHolidays.length" class="px-5 pt-5">
      <h3 class="text-[12px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-2.5">Hari Libur</h3>
      <div class="space-y-2">
        <div
          v-for="h in upcomingHolidays"
          :key="h.id"
          class="bg-white rounded-[14px] p-3 border border-hadir-line flex items-center gap-3"
          :class="isHolidayDate(ymd(new Date(now))) && h.date_from.slice(0,10) <= ymd(new Date(now)) && h.date_to.slice(0,10) >= ymd(new Date(now)) ? 'ring-2 ring-hadir-amber/40' : ''"
        >
          <div class="w-10 h-10 rounded-xl bg-hadir-amber-sft text-hadir-amber flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-hadir-ink truncate">{{ h.name }}</div>
            <div class="text-[11px] text-hadir-ink-70">{{ holidayRangeLabel(h) }}</div>
          </div>
          <span
            v-if="h.date_from.slice(0,10) <= ymd(new Date(now)) && h.date_to.slice(0,10) >= ymd(new Date(now))"
            class="text-[10px] font-bold uppercase bg-hadir-amber text-white px-1.5 py-0.5 rounded flex-shrink-0"
          >Aktif</span>
        </div>
      </div>
    </div>

    <!-- quick actions -->
    <div class="px-5 pt-6">
      <h3 class="text-[12px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-2.5">Aksi cepat</h3>
      <div class="grid grid-cols-2 gap-2.5">
        <NuxtLink to="/izin" class="bg-white rounded-[14px] p-3.5 border border-hadir-line active:scale-[0.98] transition block">
          <div class="w-9 h-9 rounded-[10px] bg-hadir-teal-sft flex items-center justify-center mb-2.5">
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-hadir-ink">Ajukan Cuti</p>
          <p class="text-xs text-hadir-ink-50 mt-0.5">{{ cutiRemaining }} hari tersisa</p>
        </NuxtLink>
        <NuxtLink to="/izin" class="bg-white rounded-[14px] p-3.5 border border-hadir-line active:scale-[0.98] transition block">
          <div class="w-9 h-9 rounded-[10px] bg-hadir-amber-sft flex items-center justify-center mb-2.5">
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round">
              <rect x="4" y="6" width="16" height="14" rx="2" />
              <path d="M9 13h6M12 10v6" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-hadir-ink">Izin Sakit</p>
          <p class="text-xs text-hadir-ink-50 mt-0.5">{{ sakitYTD }} kali tahun ini</p>
        </NuxtLink>
      </div>
    </div>

    <!-- this week -->
    <div class="px-5 pt-5">
      <div class="flex justify-between items-baseline mb-2.5">
        <h3 class="text-[12px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px]">Minggu ini</h3>
        <NuxtLink to="/riwayat" class="text-[12px] text-hadir-teal font-semibold">Lihat semua</NuxtLink>
      </div>
      <div class="bg-white rounded-[14px] py-2 px-1 border border-hadir-line flex justify-between">
        <div v-for="d in week" :key="d.n" class="flex-1 text-center py-1.5" :title="d.title">
          <p class="text-[11px] text-hadir-ink-50 mb-1.5">{{ d.d }}</p>
          <div
            class="w-7 h-7 rounded-lg mx-auto flex items-center justify-center text-[13px] font-semibold"
            :class="d.status === 'today'
              ? 'bg-hadir-teal-sft border-2 border-hadir-teal text-hadir-teal'
              : d.status === 'holiday'
                ? 'bg-hadir-amber-sft text-hadir-amber'
                : 'bg-hadir-bg text-hadir-ink'"
          >
            {{ d.n }}
          </div>
          <div
            class="w-1.5 h-1.5 rounded-full mt-1.5 mx-auto"
            :class="{
              'bg-hadir-teal': d.status === 'on',
              'bg-hadir-amber': d.status === 'late' || d.status === 'holiday',
              'bg-hadir-red': d.status === 'absent',
              'bg-transparent': d.status === 'today' || d.status === 'pending'
            }"
          />
        </div>
      </div>
    </div>

    <InstallPrompt class="mx-5 mt-5" />
  </div>
</template>
