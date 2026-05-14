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
  status: 'valid' | 'out_of_range' | 'wfh'
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
}

const api = useApi()
const { user, logout } = useAuth()
const { settings, load: loadSettings } = useSettings()

const office = ref<Office | null>(null)
const records = ref<AttendanceRecord[]>([])
const leaves = ref<Leave[]>([])
const holidays = ref<Holiday[]>([])

await Promise.all([
  api<Office>('/api/office').catch(() => null).then(v => office.value = v),
  api<AttendanceRecord[]>('/api/attendance/history').catch(() => []).then(v => records.value = v),
  api<Leave[]>('/api/leaves/mine').catch(() => []).then(v => leaves.value = v),
  api<Holiday[]>('/api/holidays').catch(() => []).then(v => holidays.value = v),
  loadSettings()
])

// A holiday (tanggal merah / cuti bersama) is never counted as alpa, even if it
// falls on a configured work day — employees may absen on a holiday, but not
// doing so isn't a violation.
function isHolidayYmd(ymd: string) {
  return holidays.value.some(h => ymd >= h.date_from.slice(0, 10) && ymd <= h.date_to.slice(0, 10))
}

const scheduleLabel = computed(() => workDaysLabel(settings.value.work_days))
const scheduleHours = computed(() => `${settings.value.work_start_time}–${settings.value.work_end_time}`)

const initials = computed(() => {
  const n = user.value?.name?.trim() || 'U'
  return n.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
})

const isStaff = computed(() => user.value?.role !== 'pegawai')
const roleLabel = computed(() => {
  if (user.value?.role === 'super_admin') return 'Super Admin'
  if (user.value?.role === 'admin') return 'Administrator'
  return 'Karyawan'
})

const monthLabel = computed(() => new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))

const detailOpen = ref(false)

function formatTanggal(ymd: string | null | undefined) {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

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
    const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (isHolidayYmd(ymd)) continue
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
        <button
          type="button"
          class="relative w-16 h-16 rounded-full border-[3px] border-white/40 bg-gradient-to-br from-white to-hadir-amber-sft flex items-center justify-center font-bold text-[22px] text-hadir-teal flex-shrink-0 active:scale-95 transition"
          aria-label="Lihat detail profil"
          @click="detailOpen = true"
        >
          {{ initials }}
          <span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-hadir-soft">
            <svg class="w-3 h-3 text-hadir-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
          </span>
        </button>
        <div class="flex-1 min-w-0">
          <p class="text-[19px] font-bold text-white truncate">{{ user?.name || '...' }}</p>
          <p class="text-[13px] text-white/[0.78] truncate">
            {{ user?.jabatan || roleLabel }} · NIP {{ user?.nip || '—' }}
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

      <div class="flex items-center gap-3.5 py-3.5 border-b border-hadir-line">
        <div class="w-9 h-9 rounded-[10px] bg-hadir-teal-sft flex items-center justify-center">
          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 7h8M8 11h8M8 15h5" />
          </svg>
        </div>
        <span class="flex-1 text-[15px] text-hadir-ink font-medium">Slip Gaji</span>
        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-hadir-amber-sft text-hadir-amber">
          Segera
        </span>
      </div>

      <NuxtLink
        v-if="isStaff"
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

    <!-- Detail profil -->
    <Teleport to="body">
      <div
        v-if="detailOpen"
        class="fixed inset-0 bg-hadir-ink/50 backdrop-blur-sm flex items-end justify-center z-50"
        @click.self="detailOpen = false"
      >
        <div
          class="bg-white w-full max-w-md rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
          style="padding-bottom: env(safe-area-inset-bottom);"
        >
          <div class="w-12 h-1.5 rounded-full bg-hadir-line mx-auto mt-2.5" />

          <!-- Header -->
          <div class="px-5 pt-5 pb-4 flex items-start gap-3">
            <div class="w-14 h-14 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-base font-bold flex-shrink-0 ring-2 ring-white shadow-hadir-soft">
              {{ initials }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-hadir-ink text-[16px] leading-tight">{{ user?.name }}</div>
              <span
                class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                :class="isStaff ? 'bg-hadir-amber-sft text-amber-700' : 'bg-hadir-teal-sft text-hadir-teal-dk'"
              >
                {{ roleLabel }}
              </span>
            </div>
            <button
              type="button"
              class="w-8 h-8 rounded-full text-hadir-ink-70 hover:bg-hadir-bg flex items-center justify-center flex-shrink-0"
              aria-label="Tutup"
              @click="detailOpen = false"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="h-px bg-hadir-line mx-5" />

          <!-- Fields -->
          <dl class="px-5 py-3 divide-y divide-hadir-line">
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">NIP</dt>
              <dd class="text-[13px] text-hadir-ink font-mono text-right">{{ user?.nip || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Jabatan</dt>
              <dd class="text-[13px] text-hadir-ink text-right">{{ user?.jabatan || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Nama</dt>
              <dd class="text-[13px] text-hadir-ink text-right">{{ user?.name }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Tanggal Lahir</dt>
              <dd class="text-[13px] text-hadir-ink text-right">{{ formatTanggal(user?.tanggal_lahir) }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Email</dt>
              <dd class="text-[13px] text-hadir-ink text-right break-all">{{ user?.email }}</dd>
            </div>
          </dl>

          <div class="px-5 pb-5 pt-1">
            <button
              type="button"
              class="w-full h-11 rounded-xl bg-white border border-hadir-line text-hadir-ink font-semibold hover:bg-hadir-bg transition"
              @click="detailOpen = false"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
