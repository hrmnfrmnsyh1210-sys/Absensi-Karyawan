<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type Role = 'super_admin' | 'admin' | 'pegawai'

interface Pegawai {
  id: number
  nip: string
  email: string
  name: string
  role: Role
  jabatan: string | null
  tanggal_lahir: string | null
  wfh: number
  created_at: string
}

const api = useApi()
const { user } = useAuth()
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  pegawai: 'Pegawai'
}
// Admin biasa hanya boleh mengelola pegawai; super admin boleh semua.
function canManage(p: Pegawai) {
  return isSuperAdmin.value || p.role === 'pegawai'
}
function roleChipClass(role: Role) {
  if (role === 'super_admin') return 'bg-hadir-amber-sft text-amber-800'
  if (role === 'admin') return 'bg-hadir-amber-sft text-amber-700'
  return 'bg-hadir-teal-sft text-hadir-teal-dk'
}

const list = ref<Pegawai[]>([])
const search = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const dialogOpen = ref(false)
const editing = ref<Pegawai | null>(null)
const form = ref({
  nip: '',
  email: '',
  name: '',
  password: '',
  role: 'pegawai' as Role,
  jabatan: '',
  tanggal_lahir: '',
  wfh: false
})

const detail = ref<Pegawai | null>(null)

function openDetail(p: Pegawai) {
  detail.value = p
}

function formatTanggal(ymd: string | null) {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function load() {
  loading.value = true
  try {
    const q = search.value.trim()
    list.value = await api<Pegawai[]>('/api/admin/pegawai', {
      query: q ? { q } : undefined
    })
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
}
await load()

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})

function openAdd() {
  editing.value = null
  form.value = { nip: '', email: '', name: '', password: '', role: 'pegawai', jabatan: '', tanggal_lahir: '', wfh: false }
  dialogOpen.value = true
  error.value = null
}

function openEdit(p: Pegawai) {
  editing.value = p
  form.value = {
    nip: p.nip,
    email: p.email,
    name: p.name,
    password: '',
    role: p.role,
    jabatan: p.jabatan || '',
    tanggal_lahir: p.tanggal_lahir || '',
    wfh: !!p.wfh
  }
  detail.value = null
  dialogOpen.value = true
  error.value = null
}

async function save() {
  error.value = null
  try {
    if (editing.value) {
      await api(`/api/admin/pegawai/${editing.value.id}`, {
        method: 'PUT',
        body: form.value
      })
    } else {
      await api('/api/admin/pegawai', {
        method: 'POST',
        body: form.value
      })
    }
    dialogOpen.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Gagal menyimpan'
  }
}

async function remove(p: Pegawai) {
  if (!confirm(`Hapus pegawai ${p.name} (${p.nip})?`)) return
  try {
    await api(`/api/admin/pegawai/${p.id}`, { method: 'DELETE' })
    await load()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Gagal menghapus')
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

const adminCount = computed(() => list.value.filter(p => p.role !== 'pegawai').length)
const pegawaiCount = computed(() => list.value.filter(p => p.role === 'pegawai').length)
</script>

<template>
  <div class="space-y-3">
    <!-- Header card: title + stats + add button combined -->
    <section class="bg-white rounded-2xl border border-hadir-line overflow-hidden">
      <div class="p-3 flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl bg-hadir-teal-sft text-hadir-teal flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c1-3 3-5 6-5s5 2 6 5M15 18c.5-2 2-3 4-3s3 1 3 3" stroke-linecap="round" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[18px] font-bold text-hadir-ink tracking-tight leading-tight">Pegawai</div>
          <div class="text-[11px] text-hadir-ink-70 leading-tight">{{ list.length }} karyawan terdaftar</div>
        </div>
        <button
          class="inline-flex items-center gap-1 bg-hadir-teal hover:bg-hadir-teal-dk text-white px-3 h-9 rounded-lg text-[13px] font-semibold shadow-hadir-cta transition flex-shrink-0"
          @click="openAdd"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1.5 px-2.5 pb-2.5">
        <div class="bg-hadir-teal-sft rounded-lg p-2 text-center">
          <div class="text-lg font-bold text-hadir-teal-dk tracking-tight tabular-nums leading-none">{{ pegawaiCount }}</div>
          <div class="text-[10px] font-semibold text-hadir-teal-dk mt-1">Pegawai</div>
        </div>
        <div class="bg-hadir-amber-sft rounded-lg p-2 text-center">
          <div class="text-lg font-bold text-amber-700 tracking-tight tabular-nums leading-none">{{ adminCount }}</div>
          <div class="text-[10px] font-semibold text-amber-700 mt-1">Admin</div>
        </div>
        <div class="bg-[#EEF2F4] rounded-lg p-2 text-center">
          <div class="text-lg font-bold text-hadir-ink tracking-tight tabular-nums leading-none">{{ list.length }}</div>
          <div class="text-[10px] font-semibold text-hadir-ink-70 mt-1">Total</div>
        </div>
      </div>
    </section>

    <!-- Search -->
    <div class="relative">
      <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-hadir-ink-50">
        <svg class="w-4 h-4" viewBox="0 0 18 18" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.8" />
          <path d="M12.5 12.5L16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </span>
      <input
        v-model="search"
        type="search"
        placeholder="Cari nama, NIP, atau email…"
        class="w-full md:max-w-md h-10 rounded-xl bg-white border border-hadir-line pl-9 pr-3 text-[13px] placeholder:text-hadir-ink-50 focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
      >
    </div>

    <!-- Mobile list -->
    <div class="md:hidden">
      <div v-if="loading" class="bg-white rounded-2xl p-5 text-center text-[13px] text-hadir-ink-70 border border-hadir-line">
        Memuat...
      </div>
      <div v-else-if="!list.length" class="bg-white rounded-2xl p-6 text-center text-[13px] text-hadir-ink-70 border border-hadir-line">
        Tidak ada pegawai.
      </div>
      <div v-else class="bg-white rounded-2xl overflow-hidden border border-hadir-line">
        <div
          v-for="(p, i) in list"
          :key="p.id"
          class="flex items-center gap-2.5 px-3 py-2.5"
          :class="i < list.length - 1 ? 'border-b border-hadir-line' : ''"
        >
          <button
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white ring-2 ring-white active:scale-95 transition"
            :class="p.role !== 'pegawai'
              ? 'bg-gradient-to-br from-hadir-amber to-amber-600'
              : 'bg-gradient-to-br from-hadir-teal to-hadir-teal-dk'"
            aria-label="Lihat detail profil"
            @click="openDetail(p)"
          >
            {{ initials(p.name) }}
          </button>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <div class="font-semibold text-[13px] text-hadir-ink truncate leading-tight">{{ p.name }}</div>
              <span
                v-if="p.role !== 'pegawai'"
                class="inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-bold uppercase flex-shrink-0"
                :class="roleChipClass(p.role)"
              >{{ ROLE_LABEL[p.role] }}</span>
              <span
                v-if="p.wfh"
                class="inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-bold uppercase bg-hadir-teal-sft text-hadir-teal-dk flex-shrink-0"
              >WFH</span>
            </div>
            <div class="text-[10px] text-hadir-ink-70 mt-0.5 flex items-center gap-1 leading-tight">
              <span class="font-mono">{{ p.nip }}</span>
              <span class="text-hadir-ink-50">·</span>
              <span class="truncate">{{ p.email }}</span>
            </div>
          </div>
          <div v-if="canManage(p)" class="flex gap-1 flex-shrink-0">
            <button
              class="w-7 h-7 rounded-md bg-hadir-teal-sft text-hadir-teal-dk hover:bg-hadir-teal/20 flex items-center justify-center"
              aria-label="Edit"
              @click="openEdit(p)"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
            <button
              class="w-7 h-7 rounded-md bg-hadir-red-sft text-hadir-red hover:bg-hadir-red/20 flex items-center justify-center"
              aria-label="Hapus"
              @click="remove(p)"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
          <span
            v-else
            class="text-[10px] text-hadir-ink-50 flex-shrink-0 px-1"
            title="Hanya super admin yang dapat mengelola akun admin"
          >Terkunci</span>
        </div>
      </div>
    </div>

    <div class="hidden md:block bg-white rounded-2xl border border-hadir-line overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-hadir-bg text-left text-[11px] uppercase tracking-wider text-hadir-ink-50">
            <tr>
              <th class="px-4 py-3 font-bold">Pegawai</th>
              <th class="px-4 py-3 font-bold">NIP</th>
              <th class="px-4 py-3 font-bold">Email</th>
              <th class="px-4 py-3 font-bold">Role</th>
              <th class="px-4 py-3 text-right font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hadir-line">
            <tr v-if="loading">
              <td colspan="5" class="px-4 py-10 text-center text-hadir-ink-70">Memuat...</td>
            </tr>
            <tr v-else-if="list.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-hadir-ink-70">Tidak ada pegawai.</td>
            </tr>
            <tr v-for="p in list" :key="p.id" class="hover:bg-hadir-bg">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ring-2 ring-white hover:opacity-90 transition"
                    :class="p.role !== 'pegawai'
                      ? 'bg-gradient-to-br from-hadir-amber to-amber-600'
                      : 'bg-gradient-to-br from-hadir-teal to-hadir-teal-dk'"
                    aria-label="Lihat detail profil"
                    @click="openDetail(p)"
                  >
                    {{ initials(p.name) }}
                  </button>
                  <button type="button" class="font-semibold text-hadir-ink hover:text-hadir-teal transition" @click="openDetail(p)">{{ p.name }}</button>
                </div>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-hadir-ink-70">{{ p.nip }}</td>
              <td class="px-4 py-3 text-hadir-ink-70">{{ p.email }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase"
                  :class="roleChipClass(p.role)"
                >
                  <span class="w-1 h-1 rounded-full" :class="p.role !== 'pegawai' ? 'bg-hadir-amber' : 'bg-hadir-teal'" />
                  {{ ROLE_LABEL[p.role] }}
                </span>
                <span
                  v-if="p.wfh"
                  class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-hadir-teal-sft text-hadir-teal-dk"
                >WFH</span>
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <template v-if="canManage(p)">
                  <button class="text-hadir-teal hover:text-hadir-teal-dk hover:underline mr-3 font-semibold" @click="openEdit(p)">Edit</button>
                  <button class="text-hadir-red hover:underline font-semibold" @click="remove(p)">Hapus</button>
                </template>
                <span v-else class="text-xs text-hadir-ink-50">Terkunci</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="dialogOpen"
        class="fixed inset-0 bg-hadir-ink/50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 z-50"
        @click.self="dialogOpen = false"
      >
        <form
          class="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl shadow-2xl p-5 md:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          style="padding-bottom: calc(env(safe-area-inset-bottom) + 1.25rem);"
          @submit.prevent="save"
        >
          <div class="md:hidden w-12 h-1.5 rounded-full bg-hadir-line mx-auto -mt-1 mb-2" />
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-hadir-ink">
              {{ editing ? 'Edit Pegawai' : 'Tambah Pegawai' }}
            </h2>
            <button type="button" class="w-8 h-8 rounded-full text-hadir-ink-70 hover:bg-hadir-bg flex items-center justify-center" @click="dialogOpen = false">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">NIP</label>
              <input v-model="form.nip" type="text" required class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition">
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Role</label>
              <select
                v-if="isSuperAdmin"
                v-model="form.role"
                class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
              >
                <option value="pegawai">Pegawai</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <div
                v-else
                class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm flex items-center text-hadir-ink-70"
                title="Hanya super admin yang dapat menambahkan admin"
              >
                Pegawai
              </div>
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Nama Lengkap</label>
            <input v-model="form.name" type="text" required class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition">
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Email</label>
            <input v-model="form.email" type="email" required class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Jabatan</label>
              <input v-model="form.jabatan" type="text" placeholder="cth. Staff IT" class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition">
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">Tanggal Lahir</label>
              <input v-model="form.tanggal_lahir" type="date" class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition">
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1">
              Password {{ editing ? '(kosongkan kalau tidak diubah)' : '' }}
            </label>
            <input v-model="form.password" type="password" :required="!editing" minlength="6" class="w-full h-11 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-sm focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition">
          </div>
          <label
            class="flex items-start gap-3 rounded-xl border border-hadir-line bg-hadir-bg px-3 py-3 cursor-pointer"
            :class="form.wfh ? 'border-hadir-teal bg-hadir-teal-sft' : ''"
          >
            <input v-model="form.wfh" type="checkbox" class="mt-0.5 w-4 h-4 accent-hadir-teal flex-shrink-0">
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-hadir-ink">Mode WFH (matikan titik lokasi)</span>
              <span class="block text-[11px] text-hadir-ink-70 mt-0.5 leading-snug">
                Pegawai bisa absen tanpa pengecekan radius GPS kantor.
              </span>
            </span>
          </label>
          <p v-if="error" class="text-sm text-hadir-red bg-hadir-red-sft border border-hadir-red/20 rounded-xl px-3 py-2.5">{{ error }}</p>
          <div class="flex gap-2 pt-2">
            <button type="button" class="flex-1 h-11 rounded-xl bg-white border border-hadir-line text-hadir-ink font-semibold hover:bg-hadir-bg transition" @click="dialogOpen = false">
              Batal
            </button>
            <button type="submit" class="flex-[1.4] h-11 rounded-xl bg-hadir-teal hover:bg-hadir-teal-dk text-white font-bold shadow-hadir-cta transition">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <!-- Detail profil -->
    <Teleport to="body">
      <div
        v-if="detail"
        class="fixed inset-0 bg-hadir-ink/50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 z-50"
        @click.self="detail = null"
      >
        <div
          class="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
          style="padding-bottom: env(safe-area-inset-bottom);"
        >
          <div class="md:hidden w-12 h-1.5 rounded-full bg-hadir-line mx-auto mt-2.5" />

          <!-- Header -->
          <div class="px-5 pt-5 pb-4 flex items-start gap-3">
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0 ring-2 ring-white shadow-hadir-soft"
              :class="detail.role !== 'pegawai'
                ? 'bg-gradient-to-br from-hadir-amber to-amber-600'
                : 'bg-gradient-to-br from-hadir-teal to-hadir-teal-dk'"
            >
              {{ initials(detail.name) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-hadir-ink text-[16px] leading-tight">{{ detail.name }}</div>
              <span
                class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                :class="roleChipClass(detail.role)"
              >
                {{ ROLE_LABEL[detail.role] }}
              </span>
            </div>
            <button
              type="button"
              class="w-8 h-8 rounded-full text-hadir-ink-70 hover:bg-hadir-bg flex items-center justify-center flex-shrink-0"
              aria-label="Tutup"
              @click="detail = null"
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
              <dd class="text-[13px] text-hadir-ink font-mono text-right">{{ detail.nip }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Jabatan</dt>
              <dd class="text-[13px] text-hadir-ink text-right">{{ detail.jabatan || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Nama</dt>
              <dd class="text-[13px] text-hadir-ink text-right">{{ detail.name }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Tanggal Lahir</dt>
              <dd class="text-[13px] text-hadir-ink text-right">{{ formatTanggal(detail.tanggal_lahir) }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Email</dt>
              <dd class="text-[13px] text-hadir-ink text-right break-all">{{ detail.email }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5 gap-3">
              <dt class="text-[12px] font-semibold text-hadir-ink-50">Absensi</dt>
              <dd class="text-right">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                  :class="detail.wfh ? 'bg-hadir-teal-sft text-hadir-teal-dk' : 'bg-[#EEF2F4] text-hadir-ink-70'"
                >
                  {{ detail.wfh ? 'WFH · tanpa titik lokasi' : 'WFO · cek lokasi' }}
                </span>
              </dd>
            </div>
          </dl>

          <div class="px-5 pb-5 pt-1">
            <button
              v-if="canManage(detail)"
              type="button"
              class="w-full h-11 rounded-xl bg-hadir-teal hover:bg-hadir-teal-dk text-white font-bold shadow-hadir-cta transition"
              @click="openEdit(detail)"
            >
              Edit {{ ROLE_LABEL[detail.role] }}
            </button>
            <p
              v-else
              class="text-center text-[12px] text-hadir-ink-50 py-2"
            >
              Hanya super admin yang dapat mengubah akun ini.
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
