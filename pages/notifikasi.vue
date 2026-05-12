<script setup lang="ts">
interface Notification {
  id: number
  type: 'leave_approved' | 'leave_rejected' | 'info'
  title: string
  body: string | null
  ref_type: string | null
  ref_id: number | null
  is_read: 0 | 1
  created_at: string
  read_at: string | null
}

const api = useApi()
const router = useRouter()
const list = ref<Notification[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    list.value = await api<Notification[]>('/api/notifications')
  } finally {
    loading.value = false
  }
}
await load()

const unreadCount = computed(() => list.value.filter(n => !n.is_read).length)

async function markAllRead() {
  if (unreadCount.value === 0) return
  await api('/api/notifications/read-all', { method: 'PUT' })
  list.value = list.value.map(n => ({ ...n, is_read: 1 as const, read_at: new Date().toISOString() }))
}

async function openNotif(n: Notification) {
  if (!n.is_read) {
    await api(`/api/notifications/${n.id}/read`, { method: 'PUT' }).catch(() => {})
    const idx = list.value.findIndex(x => x.id === n.id)
    if (idx >= 0) list.value[idx] = { ...list.value[idx], is_read: 1, read_at: new Date().toISOString() }
  }
  if (n.ref_type === 'leave') router.push('/izin')
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface TypeMeta {
  bg: string
  color: string
  icon: 'check' | 'x' | 'info'
}
const typeMap: Record<Notification['type'], TypeMeta> = {
  leave_approved: { bg: '#E3F4EF', color: '#0E7C66', icon: 'check' },
  leave_rejected: { bg: '#FEE2E2', color: '#DC2626', icon: 'x' },
  info: { bg: '#E6EAEC', color: '#0F1B20', icon: 'info' }
}
</script>

<template>
  <div class="flex flex-col">
    <!-- header -->
    <div class="px-5 pt-5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          class="w-10 h-10 rounded-full bg-white border border-hadir-line flex items-center justify-center active:scale-95"
          aria-label="Kembali"
          @click="router.back()"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F1B20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 class="text-[22px] font-bold text-hadir-ink tracking-[-0.4px]">Notifikasi</h1>
      </div>
      <button
        v-if="unreadCount > 0"
        class="text-[13px] font-semibold text-hadir-teal active:opacity-70"
        @click="markAllRead"
      >Tandai dibaca</button>
    </div>

    <p class="px-5 mt-1 text-[13px] text-hadir-ink-50">
      {{ unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca' }}
    </p>

    <!-- list -->
    <div class="px-5 pt-4 space-y-2.5">
      <div
        v-if="!loading && list.length === 0"
        class="bg-white rounded-2xl p-10 text-center border border-hadir-line"
      >
        <div class="w-12 h-12 rounded-full bg-hadir-bg flex items-center justify-center mx-auto mb-3">
          <svg class="w-6 h-6 text-hadir-ink-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
            <path d="M6 8a6 6 0 1112 0v4l2 4H4l2-4V8z" />
            <path d="M10 19a2 2 0 004 0" />
          </svg>
        </div>
        <p class="text-sm text-hadir-ink-50">Belum ada notifikasi.</p>
      </div>

      <button
        v-for="n in list"
        :key="n.id"
        class="w-full text-left bg-white rounded-2xl p-4 border transition active:scale-[0.99]"
        :class="n.is_read ? 'border-hadir-line' : 'border-hadir-teal/30 bg-hadir-teal-sft/40'"
        @click="openNotif(n)"
      >
        <div class="flex items-start gap-3">
          <div
            class="w-[42px] h-[42px] rounded-xl flex items-center justify-center flex-shrink-0"
            :style="{ background: typeMap[n.type].bg }"
          >
            <svg v-if="typeMap[n.type].icon === 'check'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" :stroke="typeMap[n.type].color" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <svg v-else-if="typeMap[n.type].icon === 'x'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" :stroke="typeMap[n.type].color" stroke-width="2.2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" :stroke="typeMap[n.type].color" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <p class="text-[15px] font-semibold text-hadir-ink">{{ n.title }}</p>
              <span
                v-if="!n.is_read"
                class="w-2 h-2 rounded-full bg-hadir-teal mt-2 flex-shrink-0"
                aria-label="Belum dibaca"
              />
            </div>
            <p v-if="n.body" class="text-[13px] text-hadir-ink-70 mt-1 leading-[1.5]">{{ n.body }}</p>
            <p class="text-[11px] text-hadir-ink-50 mt-2">{{ fmtRelative(n.created_at) }}</p>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
