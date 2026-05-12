<script setup lang="ts">
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

const api = useApi()
const { user, logout } = useAuth()
const { settings, load: loadSettings } = useSettings()

const office = ref<Office | null>(null)
const records = ref<AttendanceRecord[]>([])
const leaves = ref<Leave[]>([])

await Promise.all([
  api<Office>('/api/office').catch(() => null).then(v => office.value = v),
  api<AttendanceRecord[]>('/api/attendance/history').catch(() => []).then(v => records.value = v),
  api<Leave[]>('/api/leaves/mine').catch(() => []).then(v => leaves.value = v),
  loadSettings()
])

const scheduleLabel = computed(() => workDaysLabel(settings.value.work_days))
const scheduleHours = computed(() => `${settings.value.work_start_time}–${settings.value.work_end_time}`)

const initials = computed(() => {
  const n = user.value?.name?.trim() || 'U'
  return n.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
})

const monthLabel = computed(() => new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))

const monthStats = computed(() => {
  const now = new Date()
  const m = now.getMonth(), y = now.getFullYear()
  const monthRecords = records.value.filter(r => {
    const d = new Date(r.recorded_at)
    return d.getMonth() === m && d.getFullYear() === y
  })
  const checkInDays = new Set(
    monthRecords.filter(r => r.type === 'check_in').map(r => new Date(r.recorded_at).toDateString())
  )
  const late = monthRecords.filter(r => r.type === 'check_in' && isLate(r.recorded_at, settings.value.work_start_time)).length
  const cuti = leaves.value.filter(l => {
    if (l.status !== 'approved') return false
    const d = new Date(l.date_from)
    return d.getMonth() === m && d.getFullYear() === y
  }).length

  // Alpa: workdays that have already passed this month with no check-in and no approved leave
  const today = new Date(y, m, now.getDate())
  const leaveDays = new Set<string>()
  for (const l of leaves.value) {
    if (l.status !== 'approved') continue
    const from = new Date(l.date_from)
    const to = new Date(l.date_to)
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() === m && d.getFullYear() === y) leaveDays.add(d.toDateString())
    }
  }
  let alpa = 0
  for (let day = 1; day <= today.getDate(); day++) {
    const d = new Date(y, m, day)
    if (!settings.value.work_days.includes(d.getDay())) continue
    const key = d.toDateString()
    if (checkInDays.has(key) || leaveDays.has(key)) continue
    alpa++
  }
  return { hadir: checkInDays.size, telat: late, cuti, alpa }
})
</script>

<template>
  <div class="flex flex-col">
    <!-- header -->
    <div class="relative overflow-hidden bg-hadir-teal px-5 pt-7 pb-7">
      <div class="absolute -top-10 -right-12 w-[220px] h-[220px] rounded-full bg-hadir-amber/[0.16]" />
      <div class="relative flex items-center gap-3.5">
        <div class="w-16 h-16 rounded-full border-[3px] border-white/40 bg-gradient-to-br from-white to-hadir-amber-sft flex items-center justify-center font-bold text-[22px] text-hadir-teal flex-shrink-0">
          {{ initials }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[19px] font-bold text-white truncate">{{ user?.name || '...' }}</p>
          <p class="text-[13px] text-white/[0.78] truncate">
            {{ user?.role === 'admin' ? 'Administrator' : 'Karyawan' }} · NIP {{ user?.nip || '—' }}
          </p>
          <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.18]">
            <span class="w-1.5 h-1.5 rounded-full bg-hadir-amber" />
            <span class="text-[11px] font-semibold text-white">Karyawan aktif</span>
          </div>
        </div>
      </div>
    </div>

    <!-- monthly summary -->
    <div class="-mt-3 mx-5 bg-white rounded-[20px] p-4 shadow-hadir-card relative z-10">
      <div class="flex justify-between items-center mb-1 px-1">
        <p class="text-[12px] font-bold text-hadir-ink-50 tracking-[1.2px] uppercase">{{ monthLabel }}</p>
        <NuxtLink to="/riwayat" class="text-[12px] text-hadir-teal font-semibold">Detail →</NuxtLink>
      </div>
      <div class="flex">
        <div class="flex-1 text-center py-3">
          <p class="text-2xl font-bold text-hadir-teal tracking-[-0.5px]">{{ monthStats.hadir }}</p>
          <p class="text-[11px] text-hadir-ink-70 font-medium mt-0.5">Hadir</p>
        </div>
        <div class="w-px bg-hadir-line my-3" />
        <div class="flex-1 text-center py-3">
          <p class="text-2xl font-bold text-hadir-amber tracking-[-0.5px]">{{ monthStats.telat }}</p>
          <p class="text-[11px] text-hadir-ink-70 font-medium mt-0.5">Telat</p>
        </div>
        <div class="w-px bg-hadir-line my-3" />
        <div class="flex-1 text-center py-3">
          <p class="text-2xl font-bold text-hadir-ink tracking-[-0.5px]">{{ monthStats.cuti }}</p>
          <p class="text-[11px] text-hadir-ink-70 font-medium mt-0.5">Cuti</p>
        </div>
        <div class="w-px bg-hadir-line my-3" />
        <div class="flex-1 text-center py-3">
          <p class="text-2xl font-bold text-hadir-red tracking-[-0.5px]">{{ monthStats.alpa }}</p>
          <p class="text-[11px] text-hadir-ink-70 font-medium mt-0.5">Alpa</p>
        </div>
      </div>
    </div>

    <!-- settings list -->
    <div class="mx-5 mt-5 bg-white rounded-2xl px-4 border border-hadir-line">
      <div class="flex items-center gap-3.5 py-3.5 border-b border-hadir-line">
        <div class="w-9 h-9 rounded-[10px] bg-hadir-teal-sft flex items-center justify-center">
          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8" stroke-linecap="round">
            <rect x="3" y="5" width="18" height="16" rx="2.5" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </div>
        <span class="flex-1 text-[15px] text-hadir-ink font-medium">Jadwal kerja</span>
        <span class="text-sm text-hadir-ink-70">{{ scheduleLabel }} · {{ scheduleHours }}</span>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
          <path d="M1 1l5 5-5 5" stroke="#7C8893" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </div>

      <div class="flex items-center gap-3.5 py-3.5 border-b border-hadir-line">
        <div class="w-9 h-9 rounded-[10px] bg-hadir-amber-sft flex items-center justify-center">
          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.8">
            <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" />
            <circle cx="12" cy="9" r="2.6" />
          </svg>
        </div>
        <span class="flex-1 text-[15px] text-hadir-ink font-medium">Lokasi kantor</span>
        <span class="text-sm text-hadir-ink-70 truncate max-w-[120px]">{{ office?.name || '—' }}</span>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
          <path d="M1 1l5 5-5 5" stroke="#7C8893" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </div>

      <NuxtLink
        v-if="user?.role === 'admin'"
        to="/admin"
        class="flex items-center gap-3.5 py-3.5 border-b border-hadir-line"
      >
        <div class="w-9 h-9 rounded-[10px] bg-hadir-teal-sft flex items-center justify-center">
          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span class="flex-1 text-[15px] text-hadir-ink font-medium">Panel Admin</span>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
          <path d="M1 1l5 5-5 5" stroke="#7C8893" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </NuxtLink>

      <button class="flex items-center gap-3.5 py-3.5 w-full text-left" @click="logout">
        <div class="w-9 h-9 rounded-[10px] bg-hadir-red-sft flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 4l6 8-6 8M20 12H4" />
          </svg>
        </div>
        <span class="flex-1 text-[15px] text-hadir-red font-semibold">Keluar</span>
      </button>
    </div>

    <p class="text-center text-[11px] text-hadir-ink-50 mt-6 mb-4">
      Hadir · v1.0 by PT Nusantara
    </p>
  </div>
</template>
