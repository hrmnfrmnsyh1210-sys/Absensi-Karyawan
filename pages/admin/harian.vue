<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AttRec {
  type: 'check_in' | 'check_out'
  recorded_at: string
  latitude: number
  longitude: number
  distance_m: number
  status: 'valid' | 'out_of_range'
}
interface UserRow {
  user_id: number
  nip: string
  name: string
  email: string
  status: 'hadir' | 'belum' | 'cuti' | 'sakit' | 'izin' | 'libur'
  check_in: AttRec | null
  check_out: AttRec | null
  duration_min: number | null
  leave: { type: string; status: string } | null
}
interface DailyResponse {
  date: string
  is_holiday: boolean
  holidays: Array<{ id: number; name: string; date_from: string; date_to: string }>
  users: UserRow[]
  summary: { total: number; hadir: number; belum: number; cuti: number; libur: number }
}

const api = useApi()
const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)
const data = ref<DailyResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const filter = ref<'all' | 'hadir' | 'belum' | 'cuti' | 'libur'>('all')
const search = ref('')

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await api<DailyResponse>('/api/admin/daily', { query: { date: selectedDate.value } })
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}
await load()
watch(selectedDate, () => load())

function shiftDate(days: number) {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + days)
  selectedDate.value = d.toISOString().slice(0, 10)
}

function fmtTime(iso: string | undefined | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(min: number | null) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}j ${m}m` : `${m}m`
}
function fmtDateLong(d: string) {
  return new Date(d).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}
function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

const isToday = computed(() => selectedDate.value === today)

const filtered = computed(() => {
  if (!data.value) return []
  const q = search.value.trim().toLowerCase()
  return data.value.users.filter(u => {
    if (filter.value !== 'all') {
      if (filter.value === 'cuti') {
        if (!(u.status === 'cuti' || u.status === 'sakit' || u.status === 'izin')) return false
      } else if (u.status !== filter.value) return false
    }
    if (q && !(u.name.toLowerCase().includes(q) || u.nip.toLowerCase().includes(q))) return false
    return true
  })
})

const statusMeta: Record<UserRow['status'], { label: string; bg: string; fg: string; dot: string }> = {
  hadir: { label: 'Hadir', bg: 'bg-hadir-teal-sft', fg: 'text-hadir-teal-dk', dot: 'bg-hadir-teal' },
  belum: { label: 'Belum', bg: 'bg-hadir-red-sft', fg: 'text-hadir-red', dot: 'bg-hadir-red' },
  cuti: { label: 'Cuti', bg: 'bg-hadir-amber-sft', fg: 'text-amber-700', dot: 'bg-hadir-amber' },
  sakit: { label: 'Sakit', bg: 'bg-hadir-amber-sft', fg: 'text-amber-700', dot: 'bg-hadir-amber' },
  izin: { label: 'Izin', bg: 'bg-hadir-amber-sft', fg: 'text-amber-700', dot: 'bg-hadir-amber' },
  libur: { label: 'Libur', bg: 'bg-[#EEF2F4]', fg: 'text-hadir-ink-70', dot: 'bg-hadir-ink-50' }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-[26px] font-bold text-hadir-ink tracking-tight">Detail Harian</h1>
        <p class="text-sm text-hadir-ink-70 mt-0.5 capitalize">{{ fmtDateLong(selectedDate) }}</p>
      </div>
    </div>

    <!-- Date picker bar -->
    <div class="bg-white rounded-2xl border border-hadir-line p-3 flex items-center gap-2">
      <button
        class="w-10 h-10 rounded-lg bg-hadir-bg hover:bg-hadir-line/50 flex items-center justify-center flex-shrink-0"
        aria-label="Hari sebelumnya"
        @click="shiftDate(-1)"
      >
        <svg class="w-4 h-4 text-hadir-ink-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <input
        v-model="selectedDate"
        type="date"
        :max="today"
        class="flex-1 h-10 rounded-lg bg-hadir-bg border border-hadir-line px-3 text-sm text-center font-semibold focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition tabular-nums"
      >
      <button
        class="w-10 h-10 rounded-lg bg-hadir-bg hover:bg-hadir-line/50 flex items-center justify-center flex-shrink-0 disabled:opacity-40"
        :disabled="isToday"
        aria-label="Hari berikutnya"
        @click="shiftDate(1)"
      >
        <svg class="w-4 h-4 text-hadir-ink-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <button
        v-if="!isToday"
        class="h-10 rounded-lg bg-hadir-teal text-white px-3 text-xs font-semibold flex-shrink-0"
        @click="selectedDate = today"
      >Hari ini</button>
    </div>

    <!-- Holiday banner -->
    <div
      v-if="data?.is_holiday"
      class="bg-hadir-amber-sft border border-hadir-amber/30 rounded-2xl p-3.5 flex items-center gap-3"
    >
      <div class="w-10 h-10 rounded-xl bg-hadir-amber text-white flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-amber-800">Hari Libur</div>
        <div class="text-[12px] text-amber-700">{{ data.holidays.map(h => h.name).join(', ') }}</div>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="data" class="grid grid-cols-4 gap-2">
      <button
        class="rounded-xl p-3 text-left transition"
        :class="filter === 'all' ? 'bg-hadir-teal text-white' : 'bg-white border border-hadir-line hover:bg-hadir-bg'"
        @click="filter = 'all'"
      >
        <div class="text-[10px] font-bold uppercase tracking-wider opacity-80">Total</div>
        <div class="text-xl font-bold mt-0.5 tabular-nums">{{ data.summary.total }}</div>
      </button>
      <button
        class="rounded-xl p-3 text-left transition"
        :class="filter === 'hadir' ? 'bg-hadir-teal text-white' : 'bg-hadir-teal-sft hover:bg-hadir-teal/20'"
        @click="filter = filter === 'hadir' ? 'all' : 'hadir'"
      >
        <div class="text-[10px] font-bold uppercase tracking-wider" :class="filter === 'hadir' ? 'opacity-80' : 'text-hadir-teal-dk'">Hadir</div>
        <div class="text-xl font-bold mt-0.5 tabular-nums" :class="filter === 'hadir' ? '' : 'text-hadir-teal-dk'">{{ data.summary.hadir }}</div>
      </button>
      <button
        class="rounded-xl p-3 text-left transition"
        :class="filter === 'belum' ? 'bg-hadir-red text-white' : 'bg-hadir-red-sft hover:bg-hadir-red/20'"
        @click="filter = filter === 'belum' ? 'all' : 'belum'"
      >
        <div class="text-[10px] font-bold uppercase tracking-wider" :class="filter === 'belum' ? 'opacity-80' : 'text-hadir-red'">Belum</div>
        <div class="text-xl font-bold mt-0.5 tabular-nums" :class="filter === 'belum' ? '' : 'text-hadir-red'">{{ data.summary.belum }}</div>
      </button>
      <button
        class="rounded-xl p-3 text-left transition"
        :class="filter === 'cuti' ? 'bg-hadir-amber text-white' : 'bg-hadir-amber-sft hover:bg-hadir-amber/20'"
        @click="filter = filter === 'cuti' ? 'all' : 'cuti'"
      >
        <div class="text-[10px] font-bold uppercase tracking-wider" :class="filter === 'cuti' ? 'opacity-80' : 'text-amber-700'">Izin</div>
        <div class="text-xl font-bold mt-0.5 tabular-nums" :class="filter === 'cuti' ? '' : 'text-amber-700'">{{ data.summary.cuti }}</div>
      </button>
    </div>

    <!-- Search -->
    <div class="relative">
      <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-hadir-ink-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        v-model="search"
        type="text"
        placeholder="Cari nama atau NIP…"
        class="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-hadir-line text-sm focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none"
      >
    </div>

    <p v-if="error" class="bg-hadir-red-sft border border-hadir-red/20 text-hadir-red rounded-xl p-3 text-sm">{{ error }}</p>

    <!-- Mobile cards -->
    <div class="md:hidden space-y-2">
      <div
        v-if="!filtered.length && !loading"
        class="bg-white rounded-2xl p-10 text-center text-sm text-hadir-ink-70 border border-hadir-line"
      >Tidak ada data.</div>
      <div
        v-for="u in filtered"
        :key="u.user_id"
        class="bg-white rounded-2xl border border-hadir-line p-3.5"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 ring-2 ring-white">
            {{ initials(u.name) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-hadir-ink truncate">{{ u.name }}</div>
            <div class="text-[11px] text-hadir-ink-50 font-mono">{{ u.nip }}</div>
          </div>
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0"
            :class="[statusMeta[u.status].bg, statusMeta[u.status].fg]"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="statusMeta[u.status].dot" />
            {{ statusMeta[u.status].label }}
          </span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-hadir-line">
          <div>
            <div class="text-[10px] font-bold text-hadir-ink-50 uppercase tracking-wider">Masuk</div>
            <div class="text-sm font-semibold mt-0.5 tabular-nums" :class="u.check_in ? 'text-hadir-teal-dk' : 'text-hadir-ink-50'">
              {{ fmtTime(u.check_in?.recorded_at) }}
            </div>
            <div v-if="u.check_in" class="text-[10px] text-hadir-ink-50 mt-0.5">
              <span :class="u.check_in.status === 'valid' ? '' : 'text-hadir-red font-semibold'">
                {{ u.check_in.distance_m }}m
              </span>
            </div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-hadir-ink-50 uppercase tracking-wider">Pulang</div>
            <div class="text-sm font-semibold mt-0.5 tabular-nums" :class="u.check_out ? 'text-amber-700' : 'text-hadir-ink-50'">
              {{ fmtTime(u.check_out?.recorded_at) }}
            </div>
            <div v-if="u.check_out" class="text-[10px] text-hadir-ink-50 mt-0.5">
              <span :class="u.check_out.status === 'valid' ? '' : 'text-hadir-red font-semibold'">
                {{ u.check_out.distance_m }}m
              </span>
            </div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-hadir-ink-50 uppercase tracking-wider">Durasi</div>
            <div class="text-sm font-semibold mt-0.5 tabular-nums text-hadir-ink">{{ fmtDuration(u.duration_min) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop table -->
    <div class="hidden md:block bg-white rounded-2xl border border-hadir-line overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-hadir-bg text-left text-[11px] uppercase tracking-wider text-hadir-ink-50">
            <tr>
              <th class="px-4 py-3 font-bold">Pegawai</th>
              <th class="px-4 py-3 font-bold">Status</th>
              <th class="px-4 py-3 font-bold">Masuk</th>
              <th class="px-4 py-3 font-bold">Pulang</th>
              <th class="px-4 py-3 font-bold">Durasi</th>
              <th class="px-4 py-3 font-bold">Lokasi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hadir-line">
            <tr v-if="!filtered.length">
              <td colspan="6" class="px-4 py-10 text-center text-hadir-ink-70">Tidak ada data.</td>
            </tr>
            <tr v-for="u in filtered" :key="u.user_id" class="hover:bg-hadir-bg">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-[11px] font-bold ring-2 ring-white flex-shrink-0">
                    {{ initials(u.name) }}
                  </div>
                  <div>
                    <div class="font-semibold text-hadir-ink">{{ u.name }}</div>
                    <div class="text-xs text-hadir-ink-70 font-mono">{{ u.nip }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase"
                  :class="[statusMeta[u.status].bg, statusMeta[u.status].fg]"
                >
                  <span class="w-1 h-1 rounded-full" :class="statusMeta[u.status].dot" />
                  {{ statusMeta[u.status].label }}
                </span>
              </td>
              <td class="px-4 py-3 tabular-nums" :class="u.check_in ? 'text-hadir-teal-dk font-semibold' : 'text-hadir-ink-50'">
                {{ fmtTime(u.check_in?.recorded_at) }}
                <span v-if="u.check_in && u.check_in.status !== 'valid'" class="ml-1 text-[10px] text-hadir-red font-bold uppercase">Luar</span>
              </td>
              <td class="px-4 py-3 tabular-nums" :class="u.check_out ? 'text-amber-700 font-semibold' : 'text-hadir-ink-50'">
                {{ fmtTime(u.check_out?.recorded_at) }}
                <span v-if="u.check_out && u.check_out.status !== 'valid'" class="ml-1 text-[10px] text-hadir-red font-bold uppercase">Luar</span>
              </td>
              <td class="px-4 py-3 tabular-nums text-hadir-ink-70">{{ fmtDuration(u.duration_min) }}</td>
              <td class="px-4 py-3">
                <a
                  v-if="u.check_in"
                  :href="mapsUrl(u.check_in.latitude, u.check_in.longitude)"
                  target="_blank"
                  rel="noopener"
                  class="text-hadir-teal hover:text-hadir-teal-dk hover:underline text-xs inline-flex items-center gap-1 font-medium"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" /><circle cx="12" cy="9" r="2.6" />
                  </svg>
                  Peta
                </a>
                <span v-else class="text-hadir-ink-50 text-xs">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
