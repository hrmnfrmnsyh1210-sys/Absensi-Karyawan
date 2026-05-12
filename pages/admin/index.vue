<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Stats {
  total_pegawai: number
  masuk_hari_ini: number
  pulang_hari_ini: number
  total_records: number
  recent: Array<{
    id: number
    type: 'check_in' | 'check_out'
    distance_m: number
    recorded_at: string
    name: string
    nip: string
  }>
}

const api = useApi()
const { user } = useAuth()
const stats = ref<Stats | null>(null)
stats.value = await api<Stats>('/api/admin/stats')

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

const todayLabel = new Date().toLocaleDateString('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long'
})
const nowLabel = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

const total = computed(() => stats.value?.total_pegawai ?? 0)
const hadir = computed(() => stats.value?.masuk_hari_ini ?? 0)
const pulang = computed(() => stats.value?.pulang_hari_ini ?? 0)
const belum = computed(() => Math.max(0, total.value - hadir.value))

const attendanceRate = computed(() => {
  if (!total.value) return 0
  return Math.min(100, Math.round((hadir.value / total.value) * 100))
})

// Hourly clock-in pattern from recent records (rough buckets 7:30-9:30+)
const hourlyBuckets = computed(() => {
  const labels = ['7:30', '7:45', '8:00', '8:15', '8:30', '8:45', '9:00', '9:15', '9:30+']
  const buckets = new Array(9).fill(0)
  const recent = stats.value?.recent || []
  for (const r of recent) {
    if (r.type !== 'check_in') continue
    const d = new Date(r.recorded_at)
    const mins = d.getHours() * 60 + d.getMinutes()
    if (mins < 7 * 60 + 30) buckets[0]++
    else if (mins < 7 * 60 + 45) buckets[1]++
    else if (mins < 8 * 60) buckets[2]++
    else if (mins < 8 * 60 + 15) buckets[3]++
    else if (mins < 8 * 60 + 30) buckets[4]++
    else if (mins < 8 * 60 + 45) buckets[5]++
    else if (mins < 9 * 60) buckets[6]++
    else if (mins < 9 * 60 + 15) buckets[7]++
    else buckets[8]++
  }
  const max = Math.max(1, ...buckets)
  return labels.map((l, i) => ({ label: l, value: buckets[i], pct: buckets[i] / max, ontime: i < 4 }))
})
</script>

<template>
  <div class="space-y-3">
    <!-- Hero + stat grid combined into one card -->
    <section class="rounded-2xl bg-white border border-hadir-line overflow-hidden">
      <!-- Top: teal hero -->
      <div class="bg-hadir-teal text-white p-3.5 relative overflow-hidden">
        <div class="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-hadir-amber/10 pointer-events-none" />
        <div class="relative">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-hadir-amber to-amber-600 text-white flex items-center justify-center text-[11px] font-bold ring-2 ring-white/20">
              {{ initials(user?.name || 'A') }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[10px] text-white/70 leading-tight">Admin · HR Manager</div>
              <div class="text-[13px] font-semibold truncate leading-tight">{{ user?.name }}</div>
            </div>
            <div class="px-2 py-0.5 rounded-full bg-white/15 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-hadir-amber" />
              <span class="text-[10px] font-semibold">Live</span>
            </div>
          </div>
          <div class="mt-2.5 flex items-end justify-between gap-2">
            <div>
              <div class="text-[10px] text-white/70 capitalize leading-tight">{{ todayLabel }} · {{ nowLabel }}</div>
              <div class="text-[22px] font-bold tracking-tight leading-none mt-1">
                <span class="text-hadir-amber">{{ hadir }}</span><span class="text-white/95">/{{ total }}</span>
                <span class="text-[12px] text-white/80 font-medium ml-1">hadir</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-[22px] font-bold leading-none tabular-nums">{{ attendanceRate }}%</div>
              <div class="text-[10px] text-white/70 leading-tight mt-0.5">kehadiran</div>
            </div>
          </div>
        </div>
      </div>
      <!-- Bottom: stat grid -->
      <div class="p-2.5">
        <div class="grid grid-cols-4 gap-1.5">
          <div class="bg-hadir-teal-sft rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-hadir-teal tracking-tight tabular-nums leading-none">{{ hadir }}</div>
            <div class="text-[10px] font-semibold text-hadir-ink-70 mt-1">Hadir</div>
          </div>
          <div class="bg-hadir-amber-sft rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-hadir-amber tracking-tight tabular-nums leading-none">{{ pulang }}</div>
            <div class="text-[10px] font-semibold text-hadir-ink-70 mt-1">Pulang</div>
          </div>
          <div class="bg-[#EEF2F4] rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-hadir-ink tracking-tight tabular-nums leading-none">{{ stats?.total_records ?? 0 }}</div>
            <div class="text-[10px] font-semibold text-hadir-ink-70 mt-1">Record</div>
          </div>
          <div class="bg-hadir-red-sft rounded-lg p-2 text-center">
            <div class="text-lg font-bold text-hadir-red tracking-tight tabular-nums leading-none">{{ belum }}</div>
            <div class="text-[10px] font-semibold text-hadir-ink-70 mt-1">Belum</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Action inbox -->
    <section class="bg-white rounded-2xl border border-hadir-line overflow-hidden">
      <div class="px-3.5 pt-3 pb-1.5 flex items-end justify-between">
        <div class="text-[10px] font-bold text-hadir-ink-50 uppercase tracking-wider">Perlu Tindakan</div>
        <NuxtLink to="/admin/izin" class="text-[11px] font-semibold text-hadir-teal">Lihat semua</NuxtLink>
      </div>
      <NuxtLink
        to="/admin/izin"
        class="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-hadir-line hover:bg-hadir-bg transition"
      >
        <div class="w-8 h-8 rounded-lg bg-hadir-amber/10 text-hadir-amber flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" stroke-linecap="round" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-semibold text-hadir-ink leading-tight">Permohonan izin / cuti</div>
          <div class="text-[11px] text-hadir-ink-70 leading-tight mt-0.5">Menunggu persetujuan</div>
        </div>
        <svg class="w-3 h-3 text-hadir-ink-50 flex-shrink-0" viewBox="0 0 7 12" fill="none">
          <path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </NuxtLink>
      <NuxtLink
        to="/admin/rekap"
        class="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-hadir-line hover:bg-hadir-bg transition"
      >
        <div class="w-8 h-8 rounded-lg bg-hadir-red/10 text-hadir-red flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" />
            <circle cx="12" cy="9" r="2.6" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-semibold text-hadir-ink leading-tight">Clock-in di luar radius</div>
          <div class="text-[11px] text-hadir-ink-70 leading-tight mt-0.5">Perlu peninjauan lokasi</div>
        </div>
        <svg class="w-3 h-3 text-hadir-ink-50 flex-shrink-0" viewBox="0 0 7 12" fill="none">
          <path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </NuxtLink>
      <div class="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-hadir-line">
        <div class="w-8 h-8 rounded-lg bg-hadir-ink-50/10 text-hadir-ink-50 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" stroke-linecap="round" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-semibold text-hadir-ink leading-tight">{{ belum }} belum clock-in</div>
          <div class="text-[11px] text-hadir-ink-70 leading-tight mt-0.5">Per pukul {{ nowLabel }}</div>
        </div>
      </div>
    </section>

    <!-- Hourly chart -->
    <section class="bg-white rounded-2xl border border-hadir-line p-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[10px] font-bold text-hadir-ink-50 uppercase tracking-wider">Pola Clock-In</div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-hadir-teal" />
            <span class="text-[10px] text-hadir-ink-70">Tepat</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-hadir-amber" />
            <span class="text-[10px] text-hadir-ink-70">Telat</span>
          </div>
        </div>
      </div>
      <div class="flex items-end gap-1 h-12">
        <div
          v-for="(b, i) in hourlyBuckets"
          :key="i"
          class="flex-1 rounded-t-sm"
          :class="b.ontime ? 'bg-hadir-teal' : 'bg-hadir-amber'"
          :style="{ height: Math.max(3, Math.round(b.pct * 48)) + 'px' }"
        />
      </div>
      <div class="flex gap-1 mt-1">
        <div
          v-for="b in hourlyBuckets"
          :key="b.label"
          class="flex-1 text-center text-[8px] text-hadir-ink-50 font-medium"
        >{{ b.label }}</div>
      </div>
    </section>

    <!-- Recent activity -->
    <section v-if="stats?.recent?.length" class="bg-white rounded-2xl border border-hadir-line overflow-hidden">
      <div class="px-3.5 pt-3 pb-1.5 flex items-end justify-between">
        <div class="text-[10px] font-bold text-hadir-ink-50 uppercase tracking-wider">Aktivitas Terbaru</div>
        <NuxtLink to="/admin/rekap" class="text-[11px] font-semibold text-hadir-teal">Lihat semua</NuxtLink>
      </div>
      <ul class="divide-y divide-hadir-line">
        <li
          v-for="r in stats.recent.slice(0, 4)"
          :key="r.id"
          class="px-3.5 py-2.5 flex items-center gap-2.5 border-t border-hadir-line first:border-t"
        >
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 ring-2 ring-white">
            {{ initials(r.name) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-[13px] text-hadir-ink truncate leading-tight">{{ r.name }}</div>
            <div class="text-[10px] text-hadir-ink-70 flex items-center gap-1.5 mt-0.5">
              <span
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                :class="r.type === 'check_in' ? 'bg-hadir-teal-sft text-hadir-teal-dk' : 'bg-hadir-amber-sft text-amber-700'"
              >
                {{ r.type === 'check_in' ? 'Masuk' : 'Pulang' }}
              </span>
              <span class="font-mono">{{ r.nip }}</span>
            </div>
          </div>
          <div class="text-right text-[10px] text-hadir-ink-50 shrink-0 leading-tight tabular-nums">
            <div class="font-medium text-hadir-ink-70">{{ fmtTime(r.recorded_at) }}</div>
            <div>{{ r.distance_m }}m</div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
