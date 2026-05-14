<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Holiday {
  id: number
  name: string
  date_from: string
  date_to: string
  description: string | null
  source: 'manual' | 'national'
  created_at: string
  updated_at: string
  created_by_name: string | null
}

const api = useApi()
const list = ref<Holiday[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const message = ref<string | null>(null)
const dialogOpen = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)
const confirmDelete = ref<Holiday | null>(null)

const today = new Date().toISOString().slice(0, 10)
const form = ref({
  name: '',
  date_from: today,
  date_to: today,
  description: ''
})

async function load() {
  loading.value = true
  try {
    list.value = await api<Holiday[]>('/api/admin/holidays')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Gagal memuat hari libur'
  } finally {
    loading.value = false
  }
}
await load()

// --- Sinkronisasi kalender nasional Indonesia ---
const currentYear = new Date().getFullYear()
const yearOptions = [currentYear - 1, currentYear, currentYear + 1]
const syncYear = ref(currentYear)
const syncing = ref(false)

const nationalCount = computed(() => list.value.filter((h) => h.source === 'national').length)

async function syncNational() {
  syncing.value = true
  error.value = null
  message.value = null
  try {
    const res = await api<{ count: number; year: number; message: string }>(
      '/api/admin/holidays/sync',
      { method: 'POST', body: { year: syncYear.value } }
    )
    message.value = res.message
    await load()
    setTimeout(() => { message.value = null }, 5000)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Gagal sinkronisasi kalender nasional'
  } finally {
    syncing.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', date_from: today, date_to: today, description: '' }
  error.value = null
  dialogOpen.value = true
}

function openEdit(h: Holiday) {
  editingId.value = h.id
  form.value = {
    name: h.name,
    date_from: h.date_from.slice(0, 10),
    date_to: h.date_to.slice(0, 10),
    description: h.description || ''
  }
  error.value = null
  dialogOpen.value = true
}

async function submit() {
  error.value = null
  submitting.value = true
  try {
    if (editingId.value) {
      await api(`/api/admin/holidays/${editingId.value}`, { method: 'PUT', body: form.value })
      message.value = 'Hari libur diperbarui'
    } else {
      await api('/api/admin/holidays', { method: 'POST', body: form.value })
      message.value = 'Hari libur ditambahkan'
    }
    dialogOpen.value = false
    await load()
    setTimeout(() => { message.value = null }, 3000)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Gagal menyimpan'
  } finally {
    submitting.value = false
  }
}

async function doDelete() {
  if (!confirmDelete.value) return
  const id = confirmDelete.value.id
  try {
    await api(`/api/admin/holidays/${id}`, { method: 'DELETE' })
    confirmDelete.value = null
    message.value = 'Hari libur dihapus'
    await load()
    setTimeout(() => { message.value = null }, 3000)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Gagal menghapus'
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function rangeLabel(h: Holiday) {
  const from = h.date_from.slice(0, 10)
  const to = h.date_to.slice(0, 10)
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`
}
function durationDays(h: Holiday) {
  const ms = new Date(h.date_to).getTime() - new Date(h.date_from).getTime()
  return Math.round(ms / 86400000) + 1
}
function isUpcoming(h: Holiday) {
  return new Date(h.date_to).getTime() >= new Date(today).getTime()
}
function isOngoing(h: Holiday) {
  return new Date(h.date_from).getTime() <= new Date(today).getTime()
    && new Date(h.date_to).getTime() >= new Date(today).getTime()
}

const upcoming = computed(() => list.value.filter(h => isUpcoming(h)))
const past = computed(() => list.value.filter(h => !isUpcoming(h)))

const formDuration = computed(() => {
  if (!form.value.date_from || !form.value.date_to) return 0
  const ms = new Date(form.value.date_to).getTime() - new Date(form.value.date_from).getTime()
  return Math.max(1, Math.round(ms / 86400000) + 1)
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h1 class="text-[26px] font-bold text-hadir-ink tracking-tight">Hari Libur</h1>
        <p class="text-sm text-hadir-ink-70 mt-0.5">{{ list.length }} libur terdaftar · {{ nationalCount }} dari kalender nasional</p>
      </div>
      <button
        class="inline-flex items-center gap-1.5 bg-hadir-teal hover:bg-hadir-teal-dk text-white px-3 h-10 md:h-11 md:px-4 rounded-xl text-sm font-semibold shadow-hadir-cta transition"
        @click="openCreate"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Tambah Libur
      </button>
    </div>

    <p v-if="message" class="bg-hadir-teal-sft border border-hadir-teal/20 text-hadir-teal-dk rounded-xl px-3 py-2.5 text-sm">{{ message }}</p>
    <p v-if="error && !dialogOpen" class="bg-hadir-red-sft border border-hadir-red/20 text-hadir-red rounded-xl px-3 py-2.5 text-sm">{{ error }}</p>

    <!-- Sync kalender nasional -->
    <section class="bg-white rounded-2xl border border-hadir-line p-4">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-hadir-teal-sft text-hadir-teal flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-hadir-ink">Kalender Nasional Indonesia</div>
          <p class="text-[12px] text-hadir-ink-70 mt-0.5">
            Ambil tanggal merah &amp; cuti bersama otomatis dari kalender resmi. Hari libur nasional memblokir absensi pegawai.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 mt-3">
        <select
          v-model.number="syncYear"
          class="h-10 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
        >
          <option v-for="y in yearOptions" :key="y" :value="y">Tahun {{ y }}</option>
        </select>
        <button
          type="button"
          :disabled="syncing"
          class="inline-flex items-center gap-1.5 bg-hadir-teal hover:bg-hadir-teal-dk text-white px-4 h-10 rounded-xl text-sm font-semibold shadow-hadir-cta disabled:opacity-60 transition"
          @click="syncNational"
        >
          <svg
            class="w-4 h-4"
            :class="syncing ? 'animate-spin' : ''"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          >
            <path v-if="!syncing" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            <template v-else>
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
              <path d="M22 12a10 10 0 0 1-10 10" />
            </template>
          </svg>
          {{ syncing ? 'Menyinkronkan…' : 'Sinkronkan' }}
        </button>
      </div>
      <p class="text-[11px] text-hadir-ink-50 mt-2">
        Sinkronisasi akan menimpa seluruh libur nasional tahun terpilih. Libur yang Anda tambah manual tidak terpengaruh.
      </p>
    </section>

    <!-- Upcoming -->
    <section>
      <h2 class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-2">Mendatang &amp; Berlangsung</h2>
      <div v-if="!upcoming.length" class="bg-white rounded-2xl p-8 text-center text-sm text-hadir-ink-70 border border-hadir-line">
        Belum ada libur yang akan datang.
      </div>
      <div v-else class="grid sm:grid-cols-2 gap-2.5">
        <div
          v-for="h in upcoming"
          :key="h.id"
          class="bg-white rounded-2xl border border-hadir-line p-4 flex flex-col gap-2"
          :class="isOngoing(h) ? 'ring-2 ring-hadir-teal/30' : ''"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-hadir-amber-sft text-hadir-amber flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <rect x="3" y="5" width="18" height="16" rx="2.5" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-hadir-ink truncate">{{ h.name }}</div>
                  <span
                    v-if="h.source === 'national'"
                    class="text-[9px] font-bold uppercase tracking-wide bg-hadir-teal-sft text-hadir-teal-dk px-1.5 py-0.5 rounded flex-shrink-0"
                  >Nasional</span>
                </div>
                <div class="text-[12px] text-hadir-ink-70">{{ rangeLabel(h) }}</div>
              </div>
            </div>
            <span
              v-if="isOngoing(h)"
              class="text-[10px] font-bold uppercase bg-hadir-teal text-white px-1.5 py-0.5 rounded flex-shrink-0"
            >Aktif</span>
          </div>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="bg-hadir-bg text-hadir-ink-70 px-2 py-0.5 rounded font-semibold">{{ durationDays(h) }} hari</span>
            <span v-if="h.source === 'national'" class="text-hadir-ink-50">dari kalender nasional</span>
            <span v-else-if="h.created_by_name" class="text-hadir-ink-50">oleh {{ h.created_by_name }}</span>
          </div>
          <p v-if="h.description" class="text-[12px] text-hadir-ink-70 line-clamp-2">{{ h.description }}</p>
          <div class="flex gap-2 mt-1">
            <button
              v-if="h.source !== 'national'"
              class="flex-1 h-8 rounded-lg bg-hadir-bg border border-hadir-line text-hadir-ink-70 hover:bg-white text-xs font-semibold"
              @click="openEdit(h)"
            >Ubah</button>
            <button
              class="flex-1 h-8 rounded-lg bg-hadir-red-sft text-hadir-red hover:bg-hadir-red/20 text-xs font-semibold"
              @click="confirmDelete = h"
            >Hapus</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Past -->
    <section v-if="past.length">
      <h2 class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-2">Sudah Lewat</h2>
      <div class="bg-white rounded-2xl border border-hadir-line overflow-hidden">
        <div
          v-for="(h, i) in past"
          :key="h.id"
          class="flex items-center gap-3 px-3.5 py-3"
          :class="i < past.length - 1 ? 'border-b border-hadir-line' : ''"
        >
          <div class="w-9 h-9 rounded-lg bg-hadir-bg text-hadir-ink-50 flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <div class="text-sm font-semibold text-hadir-ink truncate">{{ h.name }}</div>
              <span
                v-if="h.source === 'national'"
                class="text-[9px] font-bold uppercase tracking-wide bg-hadir-bg text-hadir-ink-50 px-1.5 py-0.5 rounded flex-shrink-0"
              >Nasional</span>
            </div>
            <div class="text-[11px] text-hadir-ink-50">{{ rangeLabel(h) }} · {{ durationDays(h) }} hari</div>
          </div>
          <button
            v-if="h.source !== 'national'"
            class="text-xs font-semibold text-hadir-ink-70 hover:text-hadir-ink px-2 py-1"
            @click="openEdit(h)"
          >Ubah</button>
          <button
            class="text-xs font-semibold text-hadir-red hover:text-red-700 px-2 py-1"
            @click="confirmDelete = h"
          >Hapus</button>
        </div>
      </div>
    </section>

    <!-- Form modal -->
    <Teleport to="body">
      <div
        v-if="dialogOpen"
        class="fixed inset-0 bg-hadir-ink/40 backdrop-blur-sm flex items-end md:items-center md:justify-center z-50"
        @click.self="dialogOpen = false"
      >
        <form
          class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[92vh] overflow-y-auto flex flex-col"
          style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);"
          @submit.prevent="submit"
        >
          <div class="w-12 h-1.5 rounded-full bg-hadir-line mx-auto mt-2.5 md:hidden" />
          <div class="px-5 pt-4 pb-2 flex items-center justify-between border-b border-hadir-line">
            <div class="text-[17px] font-bold text-hadir-ink">{{ editingId ? 'Ubah Hari Libur' : 'Tambah Hari Libur' }}</div>
            <button
              type="button"
              class="w-9 h-9 rounded-full hover:bg-hadir-bg flex items-center justify-center"
              aria-label="Tutup"
              @click="dialogOpen = false"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="px-5 pt-4 space-y-3.5">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Nama Libur</label>
              <input
                v-model="form.name"
                type="text"
                required
                minlength="2"
                maxlength="200"
                placeholder="Misal: Hari Raya Idul Fitri"
                class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
              >
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Mulai</label>
                <input
                  v-model="form.date_from"
                  type="date"
                  required
                  class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
                >
              </div>
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Selesai</label>
                <input
                  v-model="form.date_to"
                  type="date"
                  required
                  class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
                >
              </div>
            </div>

            <div class="px-3 py-2 bg-hadir-teal-sft rounded-lg flex justify-between text-xs">
              <span class="text-hadir-teal-dk">Total</span>
              <span class="font-bold text-hadir-teal-dk">{{ formDuration }} hari</span>
            </div>

            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Keterangan (opsional)</label>
              <textarea
                v-model="form.description"
                rows="3"
                maxlength="500"
                placeholder="Catatan tambahan untuk pegawai…"
                class="w-full rounded-xl bg-hadir-bg border border-hadir-line px-3 py-2.5 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition resize-none"
              />
            </div>

            <p
              v-if="error"
              class="flex items-start gap-2 text-sm text-hadir-red bg-hadir-red-sft border border-hadir-red/20 rounded-xl px-3 py-2.5"
            >
              <svg class="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{{ error }}</span>
            </p>
          </div>

          <div class="px-5 pt-3 pb-1 mt-auto flex gap-2">
            <button
              type="button"
              class="flex-1 h-12 rounded-xl bg-hadir-bg border border-hadir-line text-hadir-ink-70 font-semibold text-sm"
              @click="dialogOpen = false"
            >Batal</button>
            <button
              type="submit"
              :disabled="submitting"
              class="flex-1 h-12 rounded-xl bg-hadir-teal text-white font-bold text-sm shadow-hadir-cta disabled:opacity-60 transition"
            >
              {{ submitting ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Tambahkan' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Delete confirm -->
      <div
        v-if="confirmDelete"
        class="fixed inset-0 bg-hadir-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        @click.self="confirmDelete = null"
      >
        <div class="bg-white rounded-2xl max-w-sm w-full p-5">
          <div class="flex items-start gap-3">
            <div class="w-11 h-11 rounded-full bg-hadir-red-sft text-hadir-red flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-hadir-ink">Hapus hari libur?</div>
              <div class="text-sm text-hadir-ink-70 mt-1">"{{ confirmDelete.name }}" akan dihapus permanen.</div>
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button
              class="flex-1 h-11 rounded-xl bg-hadir-bg border border-hadir-line text-hadir-ink-70 font-semibold text-sm"
              @click="confirmDelete = null"
            >Batal</button>
            <button
              class="flex-1 h-11 rounded-xl bg-hadir-red text-white font-bold text-sm"
              @click="doDelete"
            >Hapus</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
