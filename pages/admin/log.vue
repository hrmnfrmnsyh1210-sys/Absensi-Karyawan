<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface ActivityLog {
  id: number
  actor_id: number | null
  actor_name: string
  actor_role: 'super_admin' | 'admin' | 'pegawai'
  action: string
  entity: string
  entity_id: number | null
  summary: string
  ip_address: string | null
  created_at: string
}

const api = useApi()
const { user } = useAuth()
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

const list = ref<ActivityLog[]>([])
const loading = ref(false)
const search = ref('')
const entity = ref<'all' | 'pegawai' | 'leave' | 'holiday' | 'settings' | 'office'>('all')

const entityTabs = [
  { v: 'all', label: 'Semua' },
  { v: 'pegawai', label: 'Pegawai' },
  { v: 'leave', label: 'Cuti/Izin' },
  { v: 'holiday', label: 'Hari Libur' },
  { v: 'settings', label: 'Pengaturan' },
  { v: 'office', label: 'Kantor' }
] as const

async function load() {
  // Middleware sudah menjaga akses; guard ini hanya jaring pengaman.
  if (!isSuperAdmin.value) return
  loading.value = true
  try {
    const q = search.value.trim()
    list.value = await api<ActivityLog[]>('/api/admin/logs', {
      query: {
        ...(q ? { q } : {}),
        ...(entity.value !== 'all' ? { entity: entity.value } : {})
      }
    })
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
watch(entity, load)

const actionMeta: Record<string, { label: string; bg: string; fg: string }> = {
  create: { label: 'Tambah', bg: 'bg-hadir-teal-sft', fg: 'text-hadir-teal-dk' },
  update: { label: 'Ubah', bg: 'bg-hadir-amber-sft', fg: 'text-amber-700' },
  delete: { label: 'Hapus', bg: 'bg-hadir-red-sft', fg: 'text-hadir-red' },
  approve: { label: 'Setujui', bg: 'bg-hadir-teal-sft', fg: 'text-hadir-teal-dk' },
  reject: { label: 'Tolak', bg: 'bg-hadir-red-sft', fg: 'text-hadir-red' },
  sync: { label: 'Sinkron', bg: 'bg-[#EEF2F4]', fg: 'text-hadir-ink-70' }
}
function actionOf(a: string) {
  return actionMeta[a] || { label: a, bg: 'bg-[#EEF2F4]', fg: 'text-hadir-ink-70' }
}

const roleLabel: Record<ActivityLog['actor_role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  pegawai: 'Pegawai'
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(today.getTime() - 86400000)
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Hari ini'
  if (dayKey(iso) === dayKey(yest.toISOString())) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const grouped = computed(() => {
  const map = new Map<string, { label: string; items: ActivityLog[] }>()
  for (const l of list.value) {
    const k = dayKey(l.created_at)
    if (!map.has(k)) map.set(k, { label: dayLabel(l.created_at), items: [] })
    map.get(k)!.items.push(l)
  }
  return Array.from(map.values())
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-[26px] font-bold text-hadir-ink tracking-tight">Log Aktivitas</h1>
      <p class="text-sm text-hadir-ink-70 mt-0.5">
        Riwayat tindakan admin &amp; super admin · {{ list.length }} catatan
      </p>
    </div>

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
        placeholder="Cari ringkasan atau nama admin…"
        class="w-full md:max-w-md h-10 rounded-xl bg-white border border-hadir-line pl-9 pr-3 text-[13px] placeholder:text-hadir-ink-50 focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
      >
    </div>

    <!-- Entity filter -->
    <div class="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
      <button
        v-for="t in entityTabs"
        :key="t.v"
        class="px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition border"
        :class="entity === t.v
          ? 'bg-hadir-teal text-white border-hadir-teal'
          : 'bg-white text-hadir-ink-70 border-hadir-line'"
        @click="entity = t.v"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl p-10 text-center text-sm text-hadir-ink-70 border border-hadir-line">
      Memuat...
    </div>

    <div v-else-if="list.length === 0" class="bg-white rounded-2xl p-12 text-center border border-hadir-line">
      <div class="w-12 h-12 rounded-full bg-hadir-bg flex items-center justify-center mx-auto mb-3">
        <svg class="w-6 h-6 text-hadir-ink-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" />
        </svg>
      </div>
      <p class="text-sm text-hadir-ink-70">Belum ada aktivitas tercatat.</p>
    </div>

    <div v-else class="space-y-5">
      <div v-for="g in grouped" :key="g.label">
        <p class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-2 px-1">{{ g.label }}</p>
        <div class="bg-white rounded-2xl border border-hadir-line overflow-hidden">
          <div
            v-for="(l, i) in g.items"
            :key="l.id"
            class="flex gap-3 p-3.5"
            :class="i < g.items.length - 1 ? 'border-b border-hadir-line' : ''"
          >
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ring-2 ring-white"
              :class="l.actor_role === 'super_admin'
                ? 'bg-gradient-to-br from-hadir-amber to-amber-600'
                : 'bg-gradient-to-br from-hadir-teal to-hadir-teal-dk'"
            >
              {{ initials(l.actor_name) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <span class="text-[13px] font-bold text-hadir-ink">{{ l.actor_name }}</span>
                  <span class="text-[11px] text-hadir-ink-50 ml-1.5">{{ roleLabel[l.actor_role] }}</span>
                </div>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 uppercase tracking-wide"
                  :class="[actionOf(l.action).bg, actionOf(l.action).fg]"
                >{{ actionOf(l.action).label }}</span>
              </div>
              <p class="text-[13px] text-hadir-ink mt-0.5 leading-snug">{{ l.summary }}</p>
              <div class="flex items-center gap-2 mt-1 text-[11px] text-hadir-ink-50">
                <span>{{ fmtTime(l.created_at) }}</span>
                <span v-if="l.ip_address" class="inline-flex items-center gap-1">
                  <span class="w-0.5 h-0.5 rounded-full bg-hadir-ink-50" />
                  <span class="font-mono">{{ l.ip_address }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
