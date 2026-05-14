<script setup lang="ts">
interface Office {
  id: number
  name: string
  latitude: number
  longitude: number
  radius_m: number
}
interface TodayRecord {
  id: number
  type: 'check_in' | 'check_out'
  recorded_at: string
  distance_m: number
}

const api = useApi()
const router = useRouter()
const { user } = useAuth()
const { settings, load: loadSettings } = useSettings()

const office = ref<Office | null>(null)
const today = ref<{ check_in: TodayRecord | null; check_out: TodayRecord | null }>({
  check_in: null,
  check_out: null
})
const position = ref<{ lat: number; lng: number; accuracy: number } | null>(null)
const distance = ref<number | null>(null)
const status = ref<'idle' | 'locating' | 'submitting'>('idle')
const error = ref<string | null>(null)
const successResult = ref<{ type: 'check_in' | 'check_out'; recorded_at: string; distance_m: number } | null>(null)

const inRange = computed(
  () => office.value !== null && distance.value !== null && distance.value <= office.value.radius_m
)
// Mode WFH global — admin mematikan cek titik lokasi di menu Pengaturan.
// Saat aktif, pegawai bisa absen tanpa harus berada di radius kantor.
const isWfh = computed(() => settings.value.location_check_enabled === false)
const canSubmit = computed(() => isWfh.value || (!!position.value && inRange.value))

async function loadOffice() {
  office.value = await api<Office>('/api/office')
}
async function loadToday() {
  today.value = await api<typeof today.value>('/api/attendance/today')
}
await Promise.all([loadOffice(), loadToday(), loadSettings()])

const action = computed<'check_in' | 'check_out'>(() => today.value.check_in ? 'check_out' : 'check_in')
const actionLabel = computed(() => action.value === 'check_in' ? 'Clock In' : 'Clock Out')

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

function locate() {
  error.value = null
  if (!('geolocation' in navigator)) {
    error.value = 'Perangkat tidak mendukung GPS'
    return
  }
  status.value = 'locating'
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      position.value = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }
      if (office.value) {
        distance.value = haversineMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          Number(office.value.latitude),
          Number(office.value.longitude)
        )
      }
      status.value = 'idle'
    },
    (err) => {
      const msgs: Record<number, string> = {
        1: 'Izin lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi.',
        2: 'Lokasi tidak tersedia. Pastikan GPS aktif.',
        3: 'Timeout mengambil lokasi. Coba lagi.'
      }
      error.value = msgs[err.code] || `Gagal mendapatkan lokasi: ${err.message}`
      status.value = 'idle'
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  )
}

async function submit() {
  if (!isWfh.value && !position.value) { error.value = 'Ambil lokasi GPS dulu'; return }
  error.value = null
  status.value = 'submitting'
  try {
    const res = await api<{ recorded_at: string; distance_m: number }>('/api/attendance', {
      method: 'POST',
      body: {
        type: action.value,
        ...(position.value
          ? { latitude: position.value.lat, longitude: position.value.lng }
          : {})
      }
    })
    successResult.value = { type: action.value, recorded_at: res.recorded_at, distance_m: res.distance_m }
    await loadToday()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Gagal menyimpan absensi'
  } finally {
    status.value = 'idle'
  }
}

const now = ref(new Date())
if (import.meta.client) {
  const id = setInterval(() => { now.value = new Date() }, 1000)
  onUnmounted(() => clearInterval(id))
}
const clockLabel = computed(() => now.value.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const firstName = computed(() => user.value?.name?.split(/\s+/)[0] || 'Anda')

onMounted(() => { if (!isWfh.value) locate() })
</script>

<template>
  <!-- SUCCESS STATE -->
  <div v-if="successResult" class="relative min-h-[calc(100vh-6rem)] bg-gradient-to-b from-hadir-teal-sft to-hadir-bg overflow-hidden">
    <!-- back -->
    <div class="flex items-center px-5 pt-4 pb-2">
      <button class="w-[38px] h-[38px] rounded-full bg-white shadow-sm flex items-center justify-center" @click="router.push('/')">
        <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
          <path d="M8 1L1 8l7 7" stroke="#0F1B20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="flex-1 text-center text-[17px] font-semibold text-hadir-ink mr-[38px]">
        {{ successResult.type === 'check_in' ? 'Clock In' : 'Clock Out' }}
      </div>
    </div>

    <div class="relative flex justify-center mt-16">
      <div class="absolute w-[280px] h-[280px] rounded-full border-[1.5px] border-dashed border-hadir-teal/25 -top-5" />
      <div class="absolute w-[200px] h-[200px] rounded-full border-[1.5px] border-dashed border-hadir-amber/35 top-5" />
      <div class="w-[130px] h-[130px] rounded-full bg-hadir-teal flex items-center justify-center relative" style="box-shadow: 0 18px 36px rgba(14,124,102,0.35)">
        <svg width="62" height="62" viewBox="0 0 62 62" fill="none">
          <path d="M14 32l11 11 24-26" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>

    <div class="px-7 pt-9 text-center">
      <p class="text-[13px] font-semibold text-hadir-amber uppercase tracking-[1.4px] mb-2.5">Berhasil tercatat</p>
      <h1 class="text-[30px] font-bold text-hadir-ink leading-[1.15] tracking-[-0.6px]">
        Selamat {{ successResult.type === 'check_in' ? 'bekerja' : 'beristirahat' }},<br>
        <span class="text-hadir-teal">{{ firstName }}!</span>
      </h1>
      <p class="text-[15px] text-hadir-ink-70 mt-3 leading-[1.5]">
        {{ successResult.type === 'check_in' ? 'Clock-in' : 'Clock-out' }} tercatat pukul
        <b class="text-hadir-ink">{{ fmtTime(successResult.recorded_at) }} WIB</b>
        <span v-if="office"> di {{ office.name }}</span>.
      </p>
    </div>

    <div class="mx-5 mt-7 bg-white rounded-[18px] p-[18px] border border-hadir-line shadow-hadir-soft">
      <div class="flex justify-between py-2.5 border-b border-dashed border-hadir-line">
        <span class="text-[13px] text-hadir-ink-70">Tipe</span>
        <span class="text-sm font-semibold text-hadir-ink">
          {{ successResult.type === 'check_in' ? 'Clock In' : 'Clock Out' }} · {{ isWfh ? 'WFH' : 'WFO' }}
        </span>
      </div>
      <div v-if="office && !isWfh" class="flex justify-between py-2.5 border-b border-dashed border-hadir-line">
        <span class="text-[13px] text-hadir-ink-70">Lokasi</span>
        <span class="text-sm font-semibold text-hadir-ink truncate ml-3">{{ office.name }}</span>
      </div>
      <div v-if="!isWfh" class="flex justify-between py-2.5 border-b border-dashed border-hadir-line">
        <span class="text-[13px] text-hadir-ink-70">Jarak</span>
        <span class="text-sm font-semibold text-hadir-ink">{{ successResult.distance_m }} m dari titik kantor</span>
      </div>
      <div class="flex justify-between py-2.5">
        <span class="text-[13px] text-hadir-ink-70">Status</span>
        <span class="text-sm font-semibold text-hadir-teal">Tervalidasi</span>
      </div>
    </div>

    <div class="px-5 mt-8 pb-10">
      <button
        class="w-full h-[54px] rounded-[14px] bg-hadir-teal text-white font-semibold text-base shadow-hadir-cta active:scale-[0.98] transition"
        @click="router.push('/')"
      >
        Kembali ke Beranda
      </button>
    </div>
  </div>

  <!-- CLOCK-IN STATE -->
  <div v-else class="flex flex-col">
    <!-- header -->
    <div class="flex items-center px-5 pt-4 pb-2">
      <button class="w-[38px] h-[38px] rounded-full bg-white shadow-sm flex items-center justify-center" @click="router.push('/')">
        <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
          <path d="M8 1L1 8l7 7" stroke="#0F1B20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="flex-1 text-center text-[17px] font-semibold text-hadir-ink mr-[38px]">{{ actionLabel }}</div>
    </div>

    <!-- WFH banner — titik lokasi dimatikan admin -->
    <div v-if="isWfh" class="mx-5 mt-2 rounded-[22px] border border-hadir-teal/30 bg-hadir-teal-sft p-5 flex items-start gap-3.5">
      <div class="w-12 h-12 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-hadir-soft">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" />
        </svg>
      </div>
      <div class="min-w-0">
        <p class="text-[15px] font-bold text-hadir-teal-dk">Mode WFH aktif</p>
        <p class="text-[13px] text-hadir-ink-70 mt-1 leading-[1.5]">
          Admin sedang mematikan pengecekan titik lokasi. Anda bisa langsung
          {{ actionLabel.toLowerCase() }} tanpa perlu berada di radius kantor.
        </p>
      </div>
    </div>

    <!-- map mockup -->
    <div v-else class="mx-5 mt-2 rounded-[22px] overflow-hidden border border-hadir-line h-[280px] relative" style="background:linear-gradient(180deg,#E8F1EE 0%,#D6E7E0 100%)">
      <svg width="100%" height="100%" viewBox="0 0 360 280" preserveAspectRatio="none" class="absolute inset-0">
        <path d="M-10 90 Q 90 70, 180 110 T 380 100" stroke="#fff" stroke-width="14" fill="none" stroke-linecap="round" />
        <path d="M50 -10 Q 60 90, 130 140 T 230 290" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round" />
        <path d="M260 -10 L 280 290" stroke="#fff" stroke-width="9" fill="none" />
        <rect x="200" y="20" width="60" height="40" rx="4" fill="#C8DAD3" />
        <rect x="20" y="180" width="80" height="50" rx="4" fill="#C8DAD3" />
        <rect x="290" y="160" width="50" height="60" rx="4" fill="#C8DAD3" />
        <rect x="120" y="180" width="80" height="50" rx="4" fill="#C8DAD3" />
      </svg>

      <!-- geofence -->
      <div class="absolute" style="left:162px;top:92px;width:150px;height:150px;border-radius:50%;background:rgba(14,124,102,0.12);border:2px dashed #0E7C66" />
      <!-- office marker -->
      <div class="absolute" style="left:224px;top:154px;width:26px;height:26px;border-radius:6px;background:#0E7C66;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.15)" />
      <!-- user (with pulse) -->
      <div v-if="position" class="absolute" style="left:200px;top:142px;width:22px;height:22px">
        <div class="absolute inset-0 rounded-full bg-hadir-amber animate-pulseRing" />
        <div class="absolute inset-0 rounded-full bg-hadir-amber border-[3px] border-white" />
      </div>

      <div class="absolute top-3 left-3 px-2.5 py-1.5 bg-white/95 rounded-full flex items-center gap-1.5">
        <span class="w-[7px] h-[7px] rounded-full bg-hadir-teal" />
        <span class="text-[11px] font-semibold text-hadir-ink">Radius {{ office?.radius_m ?? 100 }}m kantor</span>
      </div>
      <button
        class="absolute top-3 right-3 px-2.5 py-1.5 bg-white/95 rounded-full flex items-center gap-1.5 active:scale-95"
        :disabled="status === 'locating'"
        @click="locate"
      >
        <svg class="w-3.5 h-3.5" :class="status === 'locating' ? 'animate-spin' : ''" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        <span class="text-[11px] font-semibold text-hadir-teal">{{ status === 'locating' ? 'Memuat' : 'Refresh' }}</span>
      </button>
    </div>

    <!-- status card -->
    <div class="px-5 pt-5">
      <div class="bg-white rounded-2xl p-4 border border-hadir-line">
        <div class="flex items-center gap-2.5">
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center"
            :class="(isWfh || (position && inRange)) ? 'bg-hadir-teal-sft' : position ? 'bg-hadir-red-sft' : 'bg-hadir-bg'"
          >
            <svg v-if="isWfh || (position && inRange)" width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3.5 3.5L12 3" stroke="#0E7C66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="position" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <svg v-else class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="#7C8893" stroke-width="3">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke-linecap="round" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[15px] font-semibold text-hadir-ink">
              {{ isWfh ? 'Siap absen — Mode WFH' : !position ? 'Mengambil lokasi…' : inRange ? 'Lokasi terverifikasi' : 'Di luar radius kantor' }}
            </p>
            <p v-if="isWfh" class="text-xs text-hadir-ink-70 mt-0.5 truncate">Tanpa pengecekan titik lokasi</p>
            <p v-else-if="office" class="text-xs text-hadir-ink-70 mt-0.5 truncate">{{ office.name }}</p>
          </div>
          <div v-if="!isWfh && distance !== null" class="text-xs font-bold flex-shrink-0" :class="inRange ? 'text-hadir-teal' : 'text-hadir-red'">
            {{ distance }} m
          </div>
        </div>

        <div class="h-px bg-hadir-line my-3.5" />

        <div class="flex justify-between">
          <div>
            <p class="text-[11px] text-hadir-ink-50 uppercase tracking-[0.4px]">Waktu</p>
            <p class="text-[22px] font-bold text-hadir-ink tabular-nums">{{ clockLabel }}</p>
          </div>
          <div class="text-right">
            <p class="text-[11px] text-hadir-ink-50 uppercase tracking-[0.4px]">Jadwal</p>
            <p class="text-[22px] font-bold text-hadir-ink">
              {{ action === 'check_in' ? settings.work_start_time : settings.work_end_time }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <p v-if="error" class="mx-5 mt-3 flex items-start gap-2 text-sm text-hadir-red bg-hadir-red-sft border border-hadir-red/20 rounded-xl px-3 py-2.5">
      <svg class="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ error }}</span>
    </p>

    <div class="flex-1" />

    <!-- CTA -->
    <div class="px-5 pt-5 pb-2">
      <button
        :disabled="!canSubmit || status === 'submitting' || (action === 'check_in' && !!today.check_in) || (action === 'check_out' && !!today.check_out)"
        class="relative h-16 w-full rounded-2xl bg-hadir-teal overflow-hidden shadow-hadir-cta active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-white font-semibold text-base"
        @click="submit"
      >
        <svg v-if="status === 'submitting'" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <span>{{ status === 'submitting' ? 'Menyimpan…' : (today.check_out ? 'Sudah selesai hari ini' : `Konfirmasi ${actionLabel}`) }}</span>
        <svg v-if="status !== 'submitting' && !today.check_out" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <p class="text-center mt-3 text-[13px] text-hadir-ink-70">
        {{ isWfh ? 'Mode WFH — absen tanpa perlu titik lokasi' : 'Pastikan GPS aktif & berada di radius kantor' }}
      </p>
    </div>
  </div>
</template>
