<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Office {
  id: number
  name: string
  latitude: number
  longitude: number
  radius_m: number
}

const api = useApi()
const office = ref<Office>({ id: 0, name: '', latitude: 0, longitude: 0, radius_m: 50 })
const error = ref<string | null>(null)
const message = ref<string | null>(null)
const saving = ref(false)
const locating = ref(false)

async function load() {
  try {
    const o = await api<Office>('/api/office')
    office.value = {
      id: o.id,
      name: o.name,
      latitude: Number(o.latitude),
      longitude: Number(o.longitude),
      radius_m: o.radius_m
    }
  } catch {
    // No office yet — keep defaults
  }
}
await load()

async function save() {
  error.value = null
  message.value = null
  saving.value = true
  try {
    const updated = await api<Office>('/api/admin/office', {
      method: 'PUT',
      body: {
        name: office.value.name,
        latitude: Number(office.value.latitude),
        longitude: Number(office.value.longitude),
        radius_m: Number(office.value.radius_m)
      }
    })
    office.value = {
      id: updated.id,
      name: updated.name,
      latitude: Number(updated.latitude),
      longitude: Number(updated.longitude),
      radius_m: updated.radius_m
    }
    message.value = 'Pengaturan kantor tersimpan.'
    setTimeout(() => { message.value = null }, 4000)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}

function useMyLocation() {
  if (!('geolocation' in navigator)) {
    error.value = 'Browser tidak mendukung GPS'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      office.value.latitude = Number(pos.coords.latitude.toFixed(7))
      office.value.longitude = Number(pos.coords.longitude.toFixed(7))
      locating.value = false
    },
    (err) => {
      error.value = `Gagal ambil lokasi: ${err.message}`
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  )
}

const mapsUrl = computed(() =>
  office.value.latitude && office.value.longitude
    ? `https://www.google.com/maps?q=${office.value.latitude},${office.value.longitude}`
    : null
)

const hasCoords = computed(() => !!(office.value.latitude && office.value.longitude))

// Visual radius for the mini map preview: scale 5–500m to a 30–110px circle
const visualRadius = computed(() => {
  const r = Number(office.value.radius_m) || 50
  const min = 30, max = 130
  const clamped = Math.max(5, Math.min(500, r))
  return Math.round(min + ((clamped - 5) / (500 - 5)) * (max - min))
})
</script>

<template>
  <div class="space-y-4 max-w-2xl">
    <div>
      <h1 class="text-[26px] font-bold text-hadir-ink tracking-tight">Pengaturan Kantor</h1>
      <p class="text-sm text-hadir-ink-70 mt-0.5">Atur titik kantor & radius geofence untuk absensi.</p>
    </div>

    <div
      v-if="hasCoords"
      class="bg-white border border-hadir-line rounded-2xl p-3.5 flex items-center gap-3"
    >
      <div class="w-12 h-12 rounded-xl bg-hadir-teal-sft text-hadir-teal flex items-center justify-center flex-shrink-0">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 22s8-7.5 8-13a8 8 0 10-16 0c0 5.5 8 13 8 13z" />
          <circle cx="12" cy="9" r="2.6" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">Lokasi aktif</div>
        <div class="font-bold text-hadir-ink truncate mt-0.5">{{ office.name || 'Belum ada nama' }}</div>
        <div class="text-[11px] text-hadir-ink-70 font-mono break-all">
          {{ Number(office.latitude).toFixed(6) }}, {{ Number(office.longitude).toFixed(6) }}
        </div>
      </div>
    </div>

    <!-- Radius geofence mini preview -->
    <div class="bg-white border border-hadir-line rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">Radius geofence</div>
        <div class="text-base font-bold text-hadir-teal tabular-nums">{{ office.radius_m }} m</div>
      </div>
      <div class="rounded-xl overflow-hidden h-36 relative" style="background: linear-gradient(180deg,#E8F1EE 0%,#D6E7E0 100%)">
        <svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="none" class="absolute inset-0">
          <path d="M-10 50 Q 100 40, 200 70 T 340 60" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" />
          <path d="M70 -10 Q 80 60, 150 90 T 230 150" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" />
          <rect x="50" y="10" width="60" height="30" rx="3" fill="#C8DAD3" />
          <rect x="220" y="90" width="80" height="40" rx="3" fill="#C8DAD3" />
        </svg>
        <div
          class="absolute rounded-full"
          :style="{
            width: visualRadius + 'px',
            height: visualRadius + 'px',
            left: `calc(50% - ${visualRadius / 2}px)`,
            top: `calc(50% - ${visualRadius / 2}px)`,
            background: 'rgba(14,124,102,0.12)',
            border: '2px dashed #0E7C66'
          }"
        />
        <div
          class="absolute w-4 h-4 rounded-md bg-hadir-teal border-2 border-white"
          style="left: calc(50% - 8px); top: calc(50% - 8px);"
        />
      </div>

      <div class="mt-4 flex items-center gap-3">
        <span class="text-[11px] font-medium text-hadir-ink-50 tabular-nums">5m</span>
        <input
          v-model.number="office.radius_m"
          type="range"
          min="5"
          max="500"
          step="5"
          class="flex-1 h-2 rounded-full bg-hadir-bg appearance-none accent-hadir-teal"
        >
        <span class="text-[11px] font-medium text-hadir-ink-50 tabular-nums">500m</span>
      </div>
      <div class="flex flex-wrap gap-1.5 mt-3">
        <button
          v-for="r in [30, 50, 100, 200]"
          :key="r"
          type="button"
          class="px-3 py-1 rounded-full text-xs font-semibold transition"
          :class="office.radius_m === r
            ? 'bg-hadir-teal text-white'
            : 'bg-white border border-hadir-line text-hadir-ink-70 hover:border-hadir-teal'"
          @click="office.radius_m = r"
        >{{ r }} m</button>
      </div>
      <p class="text-[11px] text-hadir-ink-50 mt-2.5">Rekomendasi: 30 m kantor kecil, 100 m gedung besar.</p>
    </div>

    <form class="bg-white rounded-2xl border border-hadir-line p-4 space-y-4" @submit.prevent="save">
      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Nama Kantor</label>
        <input
          v-model="office.name"
          type="text"
          required
          placeholder="Misal: Kantor Pusat Jakarta"
          class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
        >
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">Koordinat</label>
          <button
            type="button"
            :disabled="locating"
            class="inline-flex items-center gap-1 text-xs font-semibold text-hadir-teal hover:text-hadir-teal-dk disabled:opacity-50"
            @click="useMyLocation"
          >
            <svg
              class="w-3.5 h-3.5"
              :class="locating ? 'animate-spin' : ''"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
              <circle v-if="!locating" cx="12" cy="12" r="10" />
              <circle v-if="!locating" cx="12" cy="12" r="3" />
              <line v-if="!locating" x1="12" y1="2" x2="12" y2="4" />
              <line v-if="!locating" x1="12" y1="20" x2="12" y2="22" />
              <line v-if="!locating" x1="2" y1="12" x2="4" y2="12" />
              <line v-if="!locating" x1="20" y1="12" x2="22" y2="12" />
              <circle v-else cx="12" cy="12" r="10" stroke-opacity="0.25" />
              <path v-if="locating" d="M22 12a10 10 0 0 1-10 10" />
            </svg>
            {{ locating ? 'Mengambil...' : 'Gunakan GPS' }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <input
              v-model.number="office.latitude"
              type="number"
              step="any"
              required
              placeholder="Latitude"
              class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 font-mono text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
            >
            <p class="text-[10px] text-hadir-ink-50 mt-1 ml-1">Latitude</p>
          </div>
          <div>
            <input
              v-model.number="office.longitude"
              type="number"
              step="any"
              required
              placeholder="Longitude"
              class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 font-mono text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
            >
            <p class="text-[10px] text-hadir-ink-50 mt-1 ml-1">Longitude</p>
          </div>
        </div>
        <a
          v-if="mapsUrl"
          :href="mapsUrl"
          target="_blank"
          rel="noopener"
          class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-hadir-teal hover:text-hadir-teal-dk"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Lihat di Google Maps
        </a>
      </div>

      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Radius Absensi (presisi)</label>
        <div class="relative">
          <input
            v-model.number="office.radius_m"
            type="number"
            min="5"
            max="5000"
            required
            class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line pl-3 pr-14 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition tabular-nums"
          >
          <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-hadir-ink-50 font-medium pointer-events-none">meter</span>
        </div>
      </div>

      <p v-if="error" class="flex items-start gap-2 text-sm text-hadir-red bg-hadir-red-sft border border-hadir-red/20 rounded-xl px-3 py-2.5">
        <svg class="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ error }}</span>
      </p>
      <p v-if="message" class="flex items-start gap-2 text-sm text-hadir-teal-dk bg-hadir-teal-sft border border-hadir-teal/20 rounded-xl px-3 py-2.5">
        <svg class="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>{{ message }}</span>
      </p>

      <div class="flex justify-end pt-2">
        <button
          type="submit"
          :disabled="saving"
          class="inline-flex items-center justify-center gap-2 bg-hadir-teal hover:bg-hadir-teal-dk text-white font-bold px-6 h-12 rounded-xl shadow-hadir-cta disabled:opacity-60 transition"
        >
          <svg v-if="saving" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          {{ saving ? 'Menyimpan...' : 'Simpan Pengaturan' }}
        </button>
      </div>
    </form>
  </div>
</template>
