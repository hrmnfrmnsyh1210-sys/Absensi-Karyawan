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

const api = useApi()
const records = ref<AttendanceRecord[]>([])
records.value = await api<AttendanceRecord[]>('/api/attendance/history')

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const grouped = computed(() => {
  const map = new Map<string, AttendanceRecord[]>()
  for (const r of records.value) {
    const day = new Date(r.recorded_at).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r)
  }
  return Array.from(map.entries())
})

const stats = computed(() => {
  const valid = records.value.filter(r => r.status === 'valid').length
  const checkIns = records.value.filter(r => r.type === 'check_in').length
  const outOfRange = records.value.filter(r => r.status !== 'valid').length
  return { total: records.value.length, valid, checkIns, outOfRange }
})
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

    <!-- list grouped by day -->
    <div class="px-5 pt-5 space-y-5">
      <div v-for="[day, items] in grouped" :key="day">
        <div class="flex items-center gap-2 px-1 mb-2">
          <h2 class="text-[11px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px]">{{ day }}</h2>
          <div class="flex-1 h-px bg-hadir-line" />
        </div>
        <div class="space-y-2">
          <div
            v-for="r in items"
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
