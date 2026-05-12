<script setup lang="ts">
interface AttendanceRecord {
  id: number
  type: 'check_in' | 'check_out'
  latitude: number
  longitude: number
  distance_m: number
  status: 'valid' | 'out_of_range'
  recorded_at: string
}
interface Holiday {
  id: number
  name: string
  date_from: string
  date_to: string
  description: string | null
}

const api = useApi()
const records = ref<AttendanceRecord[]>([])
const holidays = ref<Holiday[]>([])

const [r, hd] = await Promise.all([
  api<AttendanceRecord[]>('/api/attendance/history'),
  api<Holiday[]>('/api/holidays').catch(() => [])
])
records.value = r
holidays.value = hd

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function ymdFromIso(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function holidayForDate(dateStr: string) {
  return holidays.value.find(h =>
    dateStr >= h.date_from.slice(0, 10) && dateStr <= h.date_to.slice(0, 10)
  ) || null
}

interface GroupItem {
  day: string
  dateKey: string
  items: AttendanceRecord[]
  holiday: Holiday | null
}

const grouped = computed<GroupItem[]>(() => {
  const map = new Map<string, GroupItem>()
  for (const rec of records.value) {
    const dateKey = ymdFromIso(rec.recorded_at)
    const day = new Date(rec.recorded_at).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    if (!map.has(dateKey)) {
      map.set(dateKey, { day, dateKey, items: [], holiday: holidayForDate(dateKey) })
    }
    map.get(dateKey)!.items.push(rec)
  }
  return Array.from(map.values())
})

const stats = computed(() => {
  const valid = records.value.filter(r => r.status === 'valid').length
  const checkIns = records.value.filter(r => r.type === 'check_in').length
  const outOfRange = records.value.filter(r => r.status !== 'valid').length
  return { total: records.value.length, valid, checkIns, outOfRange }
})

const upcomingHolidays = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return holidays.value
    .filter(h => h.date_to.slice(0, 10) >= today)
    .sort((a, b) => a.date_from.localeCompare(b.date_from))
    .slice(0, 5)
})
function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}
function holidayRangeLabel(h: Holiday) {
  const from = h.date_from.slice(0, 10)
  const to = h.date_to.slice(0, 10)
  return from === to ? fmtDateShort(from) : `${fmtDateShort(from)} – ${fmtDateShort(to)}`
}
</script>

<template>
  <div class="flex flex-col">
    <!-- header -->
    <div class="px-5 pt-5">
      <h1 class="text-[26px] font-bold text-hadir-ink tracking-[-0.4px]">Riwayat Absensi</h1>
      <p class="text-xs text-hadir-ink-50 mt-1">{{ stats.total }} record · {{ stats.checkIns }} hari kerja</p>
    </div>

    <!-- summary cards -->
    <div v-if="records.length" class="px-5 pt-4 grid grid-cols-3 gap-2.5">
      <div class="bg-white rounded-[14px] p-3 border border-hadir-line">
        <p class="text-[11px] text-hadir-ink-50 font-semibold tracking-[0.6px] uppercase">Total</p>
        <p class="text-[26px] font-bold text-hadir-ink tracking-[-0.6px] mt-0.5">{{ stats.total }}</p>
        <p class="text-[11px] text-hadir-ink-50">record</p>
      </div>
      <div class="bg-white rounded-[14px] p-3 border border-hadir-line">
        <p class="text-[11px] text-hadir-ink-50 font-semibold tracking-[0.6px] uppercase">Valid</p>
        <p class="text-[26px] font-bold text-hadir-teal tracking-[-0.6px] mt-0.5">{{ stats.valid }}</p>
        <p class="text-[11px] text-hadir-ink-50">terverifikasi</p>
      </div>
      <div class="bg-white rounded-[14px] p-3 border border-hadir-line">
        <p class="text-[11px] text-hadir-ink-50 font-semibold tracking-[0.6px] uppercase">Hari</p>
        <p class="text-[26px] font-bold text-hadir-amber tracking-[-0.6px] mt-0.5">{{ stats.checkIns }}</p>
        <p class="text-[11px] text-hadir-ink-50">kerja</p>
      </div>
    </div>

    <!-- empty -->
    <div
      v-if="records.length === 0"
      class="mx-5 mt-5 bg-white rounded-2xl p-10 text-center border border-hadir-line"
    >
      <div class="w-12 h-12 rounded-full bg-hadir-bg flex items-center justify-center mx-auto mb-3">
        <svg class="w-6 h-6 text-hadir-ink-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <p class="text-sm text-hadir-ink-50">Belum ada riwayat absensi.</p>
    </div>

    <!-- upcoming holidays -->
    <div v-if="upcomingHolidays.length" class="px-5 pt-5">
      <h2 class="text-[11px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-2">Libur Mendatang</h2>
      <div class="space-y-2">
        <div
          v-for="h in upcomingHolidays"
          :key="h.id"
          class="bg-white rounded-[14px] p-3 border border-hadir-line flex items-center gap-3"
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
        </div>
      </div>
    </div>

    <!-- list grouped by day -->
    <div class="px-5 pt-5 space-y-5">
      <div v-for="g in grouped" :key="g.dateKey">
        <div class="flex items-center gap-2 px-1 mb-2">
          <h2 class="text-[11px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px]">{{ g.day }}</h2>
          <span
            v-if="g.holiday"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-hadir-amber-sft text-hadir-amber"
            :title="g.holiday.description || ''"
          >
            <span class="w-1 h-1 rounded-full bg-hadir-amber" />
            Libur · {{ g.holiday.name }}
          </span>
          <div class="flex-1 h-px bg-hadir-line" />
        </div>
        <div class="space-y-2">
          <div
            v-for="r in g.items"
            :key="r.id"
            class="bg-white rounded-2xl p-3.5 border border-hadir-line flex items-center gap-3"
          >
            <div
              class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="r.type === 'check_in' ? 'bg-hadir-teal-sft' : 'bg-hadir-amber-sft'"
            >
              <svg v-if="r.type === 'check_in'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8" stroke-linecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 19l4-4 3 3 7-7" />
                <path d="M14 8h6v6" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-semibold text-hadir-ink">
                {{ r.type === 'check_in' ? 'Clock In' : 'Clock Out' }}
              </p>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-hadir-ink-70">
                <span class="font-mono tabular-nums">{{ fmtTime(r.recorded_at) }}</span>
                <span class="inline-flex items-center gap-0.5">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                  {{ r.distance_m }} m
                </span>
              </div>
            </div>
            <span
              class="px-2 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0"
              :class="r.status === 'valid' ? 'bg-hadir-teal-sft text-hadir-teal-dk' : 'bg-hadir-red-sft text-red-800'"
            >
              {{ r.status === 'valid' ? 'Valid' : 'Luar' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
