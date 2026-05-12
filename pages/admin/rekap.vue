<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface RekapItem {
  id: number
  type: 'check_in' | 'check_out'
  latitude: number
  longitude: number
  distance_m: number
  status: 'valid' | 'out_of_range'
  recorded_at: string
  user_id: number
  nip: string
  name: string
  email: string
}
interface Pegawai {
  id: number
  nip: string
  name: string
}

const api = useApi()
const { token } = useAuth()
const records = ref<RekapItem[]>([])
const pegawai = ref<Pegawai[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const filterOpen = ref(false)

const today = new Date().toISOString().slice(0, 10)
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

const filters = ref({
  from: sevenDaysAgo,
  to: today,
  user_id: '' as string | number,
  type: '' as '' | 'check_in' | 'check_out'
})

async function loadPegawai() {
  pegawai.value = await api<Pegawai[]>('/api/admin/pegawai')
}

async function loadRecords() {
  loading.value = true
  error.value = null
  try {
    const query: Record<string, string> = {}
    if (filters.value.from) query.from = filters.value.from
    if (filters.value.to) query.to = filters.value.to
    if (filters.value.user_id) query.user_id = String(filters.value.user_id)
    if (filters.value.type) query.type = filters.value.type
    records.value = await api<RekapItem[]>('/api/admin/rekap', { query })
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}

await Promise.all([loadPegawai(), loadRecords()])

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}
function fmtTimeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

async function exportFile(format: 'xlsx' | 'pdf') {
  const params = new URLSearchParams()
  if (filters.value.from) params.set('from', filters.value.from)
  if (filters.value.to) params.set('to', filters.value.to)
  if (filters.value.user_id) params.set('user_id', String(filters.value.user_id))

  const path = format === 'xlsx' ? '/api/admin/rekap/export' : '/api/admin/rekap/export-pdf'
  const apiBase = useRuntimeConfig().public.apiBase || ''
  const res = await fetch(`${apiBase}${path}?${params}`, {
    headers: { Authorization: `Bearer ${token.value}` }
  })
  if (!res.ok) {
    alert('Gagal export')
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rekap-absensi-${today}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

const activeFilterCount = computed(() => {
  let n = 0
  if (filters.value.user_id) n++
  if (filters.value.type) n++
  if (filters.value.from !== sevenDaysAgo) n++
  if (filters.value.to !== today) n++
  return n
})

async function applyFilter() {
  filterOpen.value = false
  await loadRecords()
}

const totalIn = computed(() => records.value.filter(r => r.type === 'check_in').length)
const totalOut = computed(() => records.value.filter(r => r.type === 'check_out').length)
const totalValid = computed(() => records.value.filter(r => r.status === 'valid').length)
const validRate = computed(() => {
  if (!records.value.length) return 0
  return Math.round((totalValid.value / records.value.length) * 100)
})

// Mini line chart points: count per day in current range
const dailySeries = computed(() => {
  const start = new Date(filters.value.from)
  const end = new Date(filters.value.to)
  const days: { d: string; count: number }[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10)
    days.push({ d, count: 0 })
  }
  for (const r of records.value) {
    if (r.type !== 'check_in') continue
    const d = new Date(r.recorded_at).toISOString().slice(0, 10)
    const it = days.find(x => x.d === d)
    if (it) it.count++
  }
  const max = Math.max(1, ...days.map(d => d.count))
  return { days, max }
})

const linePath = computed(() => {
  const { days, max } = dailySeries.value
  if (!days.length) return { line: '', area: '' }
  const w = 320, h = 70
  const step = days.length === 1 ? 0 : w / (days.length - 1)
  const pts = days.map((d, i) => {
    const x = i * step
    const y = h - (d.count / max) * (h - 8) - 4
    return { x, y }
  })
  const line = pts.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`)).join(' ')
  const area = `${line} L${pts[pts.length - 1].x} ${h} L0 ${h} Z`
  return { line, area, last: pts[pts.length - 1] }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h1 class="text-[26px] font-bold text-hadir-ink tracking-tight">Rekap Absensi</h1>
        <p class="text-sm text-hadir-ink-70 mt-0.5">{{ records.length }} record · max 1000</p>
      </div>
      <div class="flex gap-2">
        <button
          class="inline-flex items-center gap-1.5 bg-hadir-teal hover:bg-hadir-teal-dk text-white px-3 h-10 md:h-11 md:px-4 rounded-xl text-sm font-semibold shadow-hadir-cta transition"
          @click="exportFile('xlsx')"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Excel
        </button>
        <button
          class="inline-flex items-center gap-1.5 bg-white border border-hadir-line text-hadir-ink hover:bg-hadir-bg px-3 h-10 md:h-11 md:px-4 rounded-xl text-sm font-semibold transition"
          @click="exportFile('pdf')"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          PDF
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <div class="bg-hadir-teal-sft rounded-xl p-3">
        <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-teal-dk">Tingkat Valid</div>
        <div class="flex items-baseline gap-1.5 mt-1">
          <div class="text-[26px] font-bold text-hadir-teal-dk tracking-tight tabular-nums">{{ validRate }}%</div>
        </div>
        <div class="text-[11px] text-hadir-teal-dk/80">{{ totalValid }} dari {{ records.length }}</div>
      </div>
      <div class="bg-white border border-hadir-line rounded-xl p-3">
        <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">Masuk</div>
        <div class="text-[26px] font-bold text-hadir-teal tracking-tight mt-1 tabular-nums">{{ totalIn }}</div>
      </div>
      <div class="bg-white border border-hadir-line rounded-xl p-3">
        <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">Pulang</div>
        <div class="text-[26px] font-bold text-hadir-amber tracking-tight mt-1 tabular-nums">{{ totalOut }}</div>
      </div>
      <div class="bg-white border border-hadir-line rounded-xl p-3">
        <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">Luar Radius</div>
        <div class="text-[26px] font-bold text-hadir-red tracking-tight mt-1 tabular-nums">{{ records.length - totalValid }}</div>
      </div>
    </div>

    <!-- Mini line chart -->
    <div class="bg-white rounded-2xl border border-hadir-line p-4">
      <div class="flex items-center justify-between mb-1">
        <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">Pola Clock-In Harian</div>
        <span class="text-[11px] text-hadir-ink-50 tabular-nums">{{ filters.from }} → {{ filters.to }}</span>
      </div>
      <svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none" class="block">
        <defs>
          <linearGradient id="rekapGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0E7C66" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#0E7C66" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="linePath.area" fill="url(#rekapGrad)" />
        <path :d="linePath.line" stroke="#0E7C66" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <circle v-if="linePath.last" :cx="linePath.last.x" :cy="linePath.last.y" r="4" fill="#F59E0B" stroke="#fff" stroke-width="2" />
      </svg>
    </div>

    <button
      class="md:hidden w-full bg-white border border-hadir-line rounded-xl px-4 py-3 flex items-center justify-between text-sm"
      @click="filterOpen = !filterOpen"
    >
      <span class="flex items-center gap-2 text-hadir-ink font-semibold">
        <svg class="w-[18px] h-[18px] text-hadir-ink-70" viewBox="0 0 18 18" fill="none">
          <path d="M2 4h14M5 9h8M7 14h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        Filter
        <span v-if="activeFilterCount" class="bg-hadir-teal text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {{ activeFilterCount }}
        </span>
      </span>
      <svg
        class="w-4 h-4 text-hadir-ink-50 transition-transform"
        :class="filterOpen ? 'rotate-180' : ''"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div
      class="bg-white rounded-2xl border border-hadir-line p-4"
      :class="{ 'hidden md:block': !filterOpen }"
    >
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Dari</label>
          <input v-model="filters.from" type="date" class="w-full h-10 rounded-lg bg-hadir-bg border border-hadir-line px-2 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none">
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Sampai</label>
          <input v-model="filters.to" type="date" class="w-full h-10 rounded-lg bg-hadir-bg border border-hadir-line px-2 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none">
        </div>
        <div class="col-span-2 md:col-span-1">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Pegawai</label>
          <select v-model="filters.user_id" class="w-full h-10 rounded-lg bg-hadir-bg border border-hadir-line px-2 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none">
            <option value="">Semua</option>
            <option v-for="p in pegawai" :key="p.id" :value="p.id">{{ p.name }} ({{ p.nip }})</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Tipe</label>
          <select v-model="filters.type" class="w-full h-10 rounded-lg bg-hadir-bg border border-hadir-line px-2 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none">
            <option value="">Semua</option>
            <option value="check_in">Masuk</option>
            <option value="check_out">Pulang</option>
          </select>
        </div>
        <div class="flex items-end">
          <button
            class="w-full h-10 rounded-lg bg-hadir-teal hover:bg-hadir-teal-dk text-white text-sm font-bold shadow-hadir-cta disabled:opacity-60"
            :disabled="loading"
            @click="applyFilter"
          >
            {{ loading ? 'Memuat...' : 'Terapkan' }}
          </button>
        </div>
      </div>
    </div>

    <p v-if="error" class="bg-hadir-red-sft border border-hadir-red/20 text-hadir-red rounded-xl p-3 text-sm">{{ error }}</p>

    <div class="md:hidden">
      <div v-if="!records.length && !loading" class="bg-white rounded-2xl p-12 text-center text-sm text-hadir-ink-70 border border-hadir-line">
        Tidak ada data.
      </div>
      <div v-else class="bg-white rounded-2xl overflow-hidden border border-hadir-line">
        <div
          v-for="(r, i) in records"
          :key="r.id"
          class="flex items-center gap-3 px-3.5 py-3"
          :class="i < records.length - 1 ? 'border-b border-hadir-line' : ''"
        >
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 ring-2 ring-white">
            {{ initials(r.name) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <div class="font-semibold text-sm text-hadir-ink truncate">{{ r.name }}</div>
              <span
                v-if="r.status !== 'valid'"
                class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-hadir-red-sft text-hadir-red"
              >Luar</span>
            </div>
            <div class="text-[11px] text-hadir-ink-70 mt-0.5 flex items-center gap-1.5">
              <span
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                :class="r.type === 'check_in' ? 'bg-hadir-teal-sft text-hadir-teal-dk' : 'bg-hadir-amber-sft text-amber-700'"
              >
                <span class="w-1 h-1 rounded-full" :class="r.type === 'check_in' ? 'bg-hadir-teal' : 'bg-hadir-amber'" />
                {{ r.type === 'check_in' ? 'Masuk' : 'Pulang' }}
              </span>
              <span class="font-mono text-hadir-ink-50">{{ r.nip }}</span>
            </div>
            <div class="text-[11px] text-hadir-ink-50 mt-0.5 tabular-nums">{{ fmtDateShort(r.recorded_at) }} · {{ fmtTimeOnly(r.recorded_at) }} · {{ r.distance_m }}m</div>
          </div>
          <a
            :href="mapsUrl(Number(r.latitude), Number(r.longitude))"
            target="_blank"
            rel="noopener"
            class="w-9 h-9 rounded-lg bg-hadir-teal-sft text-hadir-teal-dk flex items-center justify-center flex-shrink-0"
            aria-label="Peta"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" />
              <circle cx="12" cy="9" r="2.6" />
            </svg>
          </a>
        </div>
      </div>
    </div>

    <div class="hidden md:block bg-white rounded-2xl border border-hadir-line overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-hadir-bg text-left text-[11px] uppercase tracking-wider text-hadir-ink-50">
            <tr>
              <th class="px-4 py-3 font-bold">Waktu</th>
              <th class="px-4 py-3 font-bold">Pegawai</th>
              <th class="px-4 py-3 font-bold">Tipe</th>
              <th class="px-4 py-3 font-bold">Jarak</th>
              <th class="px-4 py-3 font-bold">Status</th>
              <th class="px-4 py-3 font-bold">Lokasi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hadir-line">
            <tr v-if="!records.length">
              <td colspan="6" class="px-4 py-10 text-center text-hadir-ink-70">Tidak ada data.</td>
            </tr>
            <tr v-for="r in records" :key="r.id" class="hover:bg-hadir-bg">
              <td class="px-4 py-3 whitespace-nowrap text-hadir-ink-70 tabular-nums">{{ fmtDateTime(r.recorded_at) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-[11px] font-bold ring-2 ring-white flex-shrink-0">
                    {{ initials(r.name) }}
                  </div>
                  <div>
                    <div class="font-semibold text-hadir-ink">{{ r.name }}</div>
                    <div class="text-xs text-hadir-ink-70 font-mono">{{ r.nip }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase"
                  :class="r.type === 'check_in' ? 'bg-hadir-teal-sft text-hadir-teal-dk' : 'bg-hadir-amber-sft text-amber-700'"
                >
                  <span class="w-1 h-1 rounded-full" :class="r.type === 'check_in' ? 'bg-hadir-teal' : 'bg-hadir-amber'" />
                  {{ r.type === 'check_in' ? 'Masuk' : 'Pulang' }}
                </span>
              </td>
              <td class="px-4 py-3 text-hadir-ink-70 tabular-nums">{{ r.distance_m }} m</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase"
                  :class="r.status === 'valid' ? 'bg-hadir-teal-sft text-hadir-teal-dk' : 'bg-hadir-red-sft text-hadir-red'"
                >
                  <span class="w-1 h-1 rounded-full" :class="r.status === 'valid' ? 'bg-hadir-teal' : 'bg-hadir-red'" />
                  {{ r.status === 'valid' ? 'Valid' : 'Luar Area' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <a
                  :href="mapsUrl(Number(r.latitude), Number(r.longitude))"
                  target="_blank"
                  rel="noopener"
                  class="text-hadir-teal hover:text-hadir-teal-dk hover:underline text-xs inline-flex items-center gap-1 font-medium"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" /><circle cx="12" cy="9" r="2.6" />
                  </svg>
                  {{ Number(r.latitude).toFixed(5) }}, {{ Number(r.longitude).toFixed(5) }}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
