<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Leave {
  id: number
  type: 'izin' | 'sakit' | 'cuti'
  date_from: string
  date_to: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  reviewed_at: string | null
  created_at: string
  user_id: number
  nip: string
  user_name: string
  reviewer_name: string | null
  attachment_name: string | null
  attachment_type: string | null
}

const api = useApi()
const list = ref<Leave[]>([])
const loading = ref(false)
const tab = ref<'pending' | 'approved' | 'rejected'>('pending')

const reviewing = ref<Leave | null>(null)
const reviewNote = ref('')
const reviewError = ref<string | null>(null)
const deciding = ref(false)
const attachmentBusy = ref<number | null>(null)

async function openAttachment(l: Leave) {
  attachmentBusy.value = l.id
  try {
    const blob = await api<Blob>(`/api/leaves/attachment/${l.id}`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    alert('Gagal membuka lampiran')
  } finally {
    attachmentBusy.value = null
  }
}

// Counters per status (loaded once for tab badges)
const counts = ref({ pending: 0, approved: 0, rejected: 0 })

async function load() {
  loading.value = true
  try {
    list.value = await api<Leave[]>('/api/admin/leaves', {
      query: { status: tab.value }
    })
    counts.value[tab.value] = list.value.length
  } finally {
    loading.value = false
  }
}

// Initial pending load. Other counts will be filled when first viewed.
await load()
watch(tab, load)

function openReview(l: Leave) {
  reviewing.value = l
  reviewNote.value = ''
  reviewError.value = null
}

async function decide(status: 'approved' | 'rejected') {
  if (!reviewing.value) return
  reviewError.value = null
  deciding.value = true
  try {
    await api(`/api/admin/leaves/${reviewing.value.id}`, {
      method: 'PUT',
      body: { status, note: reviewNote.value }
    })
    reviewing.value = null
    await load()
  } catch (e: any) {
    reviewError.value = e?.data?.statusMessage || e?.statusMessage || 'Gagal memproses'
  } finally {
    deciding.value = false
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function rangeLabel(l: Leave) {
  return l.date_from === l.date_to ? fmtDate(l.date_from) : `${fmtDate(l.date_from)} – ${fmtDate(l.date_to)}`
}
function durationDays(l: Leave) {
  const ms = new Date(l.date_to).getTime() - new Date(l.date_from).getTime()
  return Math.round(ms / 86400000) + 1
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

// "Mulai besok" badge on items starting tomorrow
function startsTomorrow(l: Leave) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 86400000)
  const start = new Date(l.date_from)
  start.setHours(0, 0, 0, 0)
  return start.getTime() === tomorrow.getTime()
}

const typeLabels: Record<Leave['type'], string> = {
  izin: 'Izin Pribadi',
  sakit: 'Izin Sakit',
  cuti: 'Cuti Tahunan'
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-[26px] font-bold text-hadir-ink tracking-tight">Approval</h1>
        <p class="text-sm text-hadir-ink-70 mt-0.5">{{ list.length }} pengajuan</p>
      </div>
    </div>

    <div class="flex gap-2.5">
      <div class="flex-1 bg-hadir-amber-sft rounded-xl p-3">
        <div class="text-[22px] font-bold text-amber-700 tracking-tight tabular-nums">{{ counts.pending }}</div>
        <div class="text-[11px] font-semibold text-amber-700">Menunggu</div>
      </div>
      <div class="flex-1 bg-hadir-teal-sft rounded-xl p-3">
        <div class="text-[22px] font-bold text-hadir-teal-dk tracking-tight tabular-nums">{{ counts.approved }}</div>
        <div class="text-[11px] font-semibold text-hadir-teal-dk">Disetujui</div>
      </div>
      <div class="flex-1 bg-white border border-hadir-line rounded-xl p-3">
        <div class="text-[22px] font-bold text-hadir-ink tracking-tight tabular-nums">{{ counts.rejected }}</div>
        <div class="text-[11px] font-semibold text-hadir-ink-70">Ditolak</div>
      </div>
    </div>

    <div class="border-b border-hadir-line flex">
      <button
        v-for="opt in [
          { v: 'pending', label: 'Menunggu' },
          { v: 'approved', label: 'Disetujui' },
          { v: 'rejected', label: 'Ditolak' }
        ]"
        :key="opt.v"
        class="flex-1 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition flex items-center justify-center gap-1.5"
        :class="tab === opt.v
          ? 'border-hadir-teal text-hadir-teal font-semibold'
          : 'border-transparent text-hadir-ink-50 hover:text-hadir-ink'"
        @click="tab = opt.v as any"
      >
        {{ opt.label }}
        <span
          v-if="tab === opt.v && list.length"
          class="bg-hadir-teal-sft text-hadir-teal-dk text-[11px] font-bold px-1.5 py-0.5 rounded-full"
        >{{ list.length }}</span>
      </button>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl p-10 text-center text-sm text-hadir-ink-70 border border-hadir-line">
      Memuat...
    </div>

    <div v-else-if="list.length === 0" class="bg-white rounded-2xl p-12 text-center border border-hadir-line">
      <div class="w-12 h-12 rounded-full bg-hadir-bg flex items-center justify-center mx-auto mb-3">
        <svg class="w-6 h-6 text-hadir-ink-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </div>
      <p class="text-sm text-hadir-ink-70">Tidak ada pengajuan {{ tab === 'pending' ? 'menunggu' : tab === 'approved' ? 'yang disetujui' : 'yang ditolak' }}.</p>
    </div>

    <div v-else class="space-y-2.5">
      <div
        v-for="l in list"
        :key="l.id"
        class="bg-white rounded-2xl p-4 border border-hadir-line"
        :class="startsTomorrow(l) && l.status === 'pending' ? 'ring-2 ring-hadir-amber/40' : ''"
      >
        <div class="flex gap-3">
          <div class="w-11 h-11 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-white">
            {{ initials(l.user_name) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-bold text-[14px] text-hadir-ink truncate">{{ l.user_name }}</div>
                <div class="text-[12px] text-hadir-ink-70 mt-0.5 font-mono">{{ l.nip }}</div>
              </div>
              <span
                v-if="startsTomorrow(l) && l.status === 'pending'"
                class="px-2 py-0.5 rounded-full bg-hadir-amber-sft text-amber-700 text-[10px] font-bold flex-shrink-0 tracking-wide"
              >MULAI BESOK</span>
              <span
                v-else-if="l.status !== 'pending'"
                class="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 uppercase tracking-wide"
                :class="l.status === 'approved' ? 'bg-hadir-teal-sft text-hadir-teal-dk' : 'bg-hadir-red-sft text-hadir-red'"
              >{{ l.status === 'approved' ? 'Disetujui' : 'Ditolak' }}</span>
            </div>

            <div class="mt-2.5 p-2.5 bg-hadir-bg rounded-xl">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-hadir-ink">{{ typeLabels[l.type] }}</span>
                <span class="text-xs font-bold text-hadir-teal">{{ durationDays(l) }} hari</span>
              </div>
              <div class="text-[12px] text-hadir-ink-70 mt-0.5">{{ rangeLabel(l) }}</div>
            </div>

            <p class="text-[12px] text-hadir-ink-70 mt-2 leading-relaxed">"{{ l.reason }}"</p>

            <p
              v-if="l.review_note"
              class="text-[12px] text-hadir-ink-70 mt-2 bg-hadir-bg border-l-2 border-hadir-teal/40 pl-2 py-1 italic rounded-r"
            >
              <span class="font-semibold not-italic text-hadir-ink">{{ l.reviewer_name || '-' }}:</span> {{ l.review_note }}
            </p>
            <button
              v-if="l.attachment_name"
              type="button"
              :disabled="attachmentBusy === l.id"
              class="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-hadir-teal disabled:opacity-50"
              @click="openAttachment(l)"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {{ attachmentBusy === l.id ? 'Membuka…' : 'Lihat lampiran' }}
            </button>
          </div>
        </div>

        <div v-if="l.status === 'pending'" class="flex gap-2 mt-3">
          <button
            class="flex-1 h-10 rounded-xl bg-white border border-hadir-line text-hadir-ink font-semibold text-sm hover:bg-hadir-bg transition"
            @click="openReview(l); reviewNote = ''; deciding = false"
          >
            Tolak
          </button>
          <button
            class="flex-[1.4] h-10 rounded-xl bg-hadir-teal hover:bg-hadir-teal-dk text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-hadir-cta transition"
            @click="openReview(l)"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Setujui
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="reviewing"
        class="fixed inset-0 bg-hadir-ink/50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 z-50"
        @click.self="reviewing = null"
      >
        <div
          class="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl shadow-2xl p-5 md:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          style="padding-bottom: calc(env(safe-area-inset-bottom) + 1.25rem);"
        >
          <div class="md:hidden w-12 h-1.5 rounded-full bg-hadir-line mx-auto -mt-1 mb-2" />
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-hadir-ink">Permohonan #{{ reviewing.id }}</h2>
            <button class="w-8 h-8 rounded-full text-hadir-ink-70 hover:bg-hadir-bg flex items-center justify-center" @click="reviewing = null">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="bg-white rounded-2xl border border-hadir-line p-3.5 flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-sm font-bold ring-2 ring-white flex-shrink-0">
              {{ initials(reviewing.user_name) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-hadir-ink truncate">{{ reviewing.user_name }}</div>
              <div class="text-xs text-hadir-ink-70 font-mono">{{ reviewing.nip }}</div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-hadir-line p-4">
            <div class="flex items-start justify-between gap-2 mb-3">
              <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50">{{ typeLabels[reviewing.type] }}</div>
                <div class="text-lg font-bold text-hadir-ink mt-0.5">{{ rangeLabel(reviewing) }}</div>
              </div>
              <span
                v-if="startsTomorrow(reviewing)"
                class="px-2 py-0.5 rounded-full bg-hadir-amber-sft text-amber-700 text-[10px] font-bold flex-shrink-0"
              >MULAI BESOK</span>
            </div>
            <div class="grid grid-cols-2 border-y border-hadir-line py-2">
              <div class="text-center px-2 border-r border-hadir-line">
                <div class="text-base font-bold text-hadir-ink">{{ durationDays(reviewing) }} hari</div>
                <div class="text-[11px] text-hadir-ink-70">Total</div>
              </div>
              <div class="text-center px-2">
                <div class="text-base font-bold text-hadir-teal">{{ typeLabels[reviewing.type] }}</div>
                <div class="text-[11px] text-hadir-ink-70">Jenis</div>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1.5">Alasan</div>
              <p class="text-sm text-hadir-ink leading-relaxed">{{ reviewing.reason }}</p>
            </div>
            <div v-if="reviewing.attachment_name" class="mt-3 pt-3 border-t border-hadir-line">
              <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1.5">Lampiran</div>
              <button
                type="button"
                :disabled="attachmentBusy === reviewing.id"
                class="w-full flex items-center gap-2.5 rounded-xl bg-hadir-bg border border-hadir-line px-3 py-2.5 text-left active:scale-[0.99] disabled:opacity-50 transition"
                @click="openAttachment(reviewing)"
              >
                <span class="w-9 h-9 rounded-lg bg-hadir-teal-sft flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-hadir-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-hadir-ink truncate">{{ reviewing.attachment_name }}</span>
                  <span class="block text-[11px] text-hadir-teal">{{ attachmentBusy === reviewing.id ? 'Membuka…' : 'Ketuk untuk membuka' }}</span>
                </span>
              </button>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-hadir-line p-4">
            <div class="text-[11px] font-bold uppercase tracking-wider text-hadir-ink-50 mb-1.5">Catatan persetujuan (opsional)</div>
            <textarea
              v-model="reviewNote"
              rows="3"
              class="w-full rounded-xl bg-hadir-bg border border-hadir-line px-3 py-2.5 text-sm text-hadir-ink placeholder:text-hadir-ink-50 focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition resize-none"
              placeholder="Misal: Hand-over ke rekan tim sebelum berangkat ya"
            />
          </div>

          <p v-if="reviewError" class="text-sm text-hadir-red bg-hadir-red-sft border border-hadir-red/20 rounded-xl px-3 py-2.5">{{ reviewError }}</p>

          <div class="flex gap-2 pt-1">
            <button
              :disabled="deciding"
              class="flex-1 h-12 rounded-xl bg-white border border-hadir-red text-hadir-red font-bold text-sm hover:bg-hadir-red-sft disabled:opacity-60 transition"
              @click="decide('rejected')"
            >
              Tolak
            </button>
            <button
              :disabled="deciding"
              class="flex-[1.6] h-12 rounded-xl bg-hadir-teal hover:bg-hadir-teal-dk text-white font-bold text-sm shadow-hadir-cta disabled:opacity-60 transition"
              @click="decide('approved')"
            >
              Setujui Permohonan
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
