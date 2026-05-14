<script setup lang="ts">
interface Leave {
  id: number
  type: 'izin' | 'sakit' | 'cuti'
  date_from: string
  date_to: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  reviewed_at: string | null
  reviewer_name: string | null
  created_at: string
  attachment_name: string | null
  attachment_type: string | null
}

const api = useApi()
const { settings, load: loadSettings } = useSettings()
const list = ref<Leave[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

const today = new Date().toISOString().slice(0, 10)
const form = ref({
  type: 'cuti' as 'izin' | 'sakit' | 'cuti',
  date_from: today,
  date_to: today,
  reason: ''
})

const MAX_ATTACHMENT_MB = 5
const file = ref<File | null>(null)
const attachmentBusy = ref<number | null>(null)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] || null
  if (f && f.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    error.value = `Ukuran lampiran maksimal ${MAX_ATTACHMENT_MB} MB`
    input.value = ''
    file.value = null
    return
  }
  error.value = null
  file.value = f
}

function clearFile() {
  file.value = null
}

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

async function load() {
  loading.value = true
  try {
    const [items] = await Promise.all([
      api<Leave[]>('/api/leaves/mine'),
      loadSettings()
    ])
    list.value = items
  } finally {
    loading.value = false
  }
}
await load()

function openDialog() {
  form.value = { type: 'cuti', date_from: today, date_to: today, reason: '' }
  file.value = null
  error.value = null
  dialogOpen.value = true
}

async function submit() {
  error.value = null
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('type', form.value.type)
    fd.append('date_from', form.value.date_from)
    fd.append('date_to', form.value.date_to)
    fd.append('reason', form.value.reason)
    if (file.value) fd.append('file', file.value)
    await api('/api/leaves', { method: 'POST', body: fd })
    dialogOpen.value = false
    await load()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Gagal mengirim'
  } finally {
    submitting.value = false
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

const tab = ref<'pending' | 'approved' | 'rejected'>('pending')
const filtered = computed(() => list.value.filter(l => l.status === tab.value))
const counts = computed(() => ({
  pending: list.value.filter(l => l.status === 'pending').length,
  approved: list.value.filter(l => l.status === 'approved').length,
  rejected: list.value.filter(l => l.status === 'rejected').length
}))

const quotas = computed(() => ({
  cuti: { used: list.value.filter(l => l.type === 'cuti' && l.status === 'approved').reduce((s, l) => s + durationDays(l), 0) },
  sakit: { used: list.value.filter(l => l.type === 'sakit' && l.status === 'approved').reduce((s, l) => s + durationDays(l), 0) },
  izin: { used: list.value.filter(l => l.type === 'izin' && l.status === 'approved').reduce((s, l) => s + durationDays(l), 0) }
}))

const typeMap: Record<Leave['type'], { label: string; color: string; bg: string }> = {
  cuti: { label: 'Cuti Tahunan', color: '#0E7C66', bg: '#E3F4EF' },
  sakit: { label: 'Izin Sakit', color: '#F59E0B', bg: '#FEF3C7' },
  izin: { label: 'Izin Pribadi', color: '#0F1B20', bg: '#E6EAEC' }
}

const statusMap: Record<Leave['status'], { label: string; bg: string; fg: string }> = {
  pending: { label: 'Menunggu', bg: 'bg-hadir-amber-sft', fg: 'text-amber-800' },
  approved: { label: 'Disetujui', bg: 'bg-hadir-teal-sft', fg: 'text-hadir-teal-dk' },
  rejected: { label: 'Ditolak', bg: 'bg-hadir-red-sft', fg: 'text-red-800' }
}
</script>

<template>
  <div class="flex flex-col">
    <!-- header -->
    <div class="px-5 pt-5 flex items-center justify-between">
      <h1 class="text-[26px] font-bold text-hadir-ink tracking-[-0.4px]">Cuti &amp; Izin</h1>
      <button
        class="w-10 h-10 rounded-full bg-hadir-teal flex items-center justify-center shadow-hadir-fab active:scale-95"
        aria-label="Ajukan baru"
        @click="openDialog"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M2 8h12" stroke="#fff" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- quotas -->
    <div class="px-5 pt-4 grid grid-cols-3 gap-2.5">
      <div class="bg-white rounded-[14px] p-3 border border-hadir-line">
        <p class="text-[11px] text-hadir-ink-50 font-semibold tracking-[0.6px] uppercase">Cuti</p>
        <p class="text-[26px] font-bold text-hadir-teal tracking-[-0.6px] mt-0.5">{{ Math.max(0, settings.annual_leave_quota - quotas.cuti.used) }}</p>
        <p class="text-[11px] text-hadir-ink-50">dari {{ settings.annual_leave_quota }}</p>
      </div>
      <div class="bg-white rounded-[14px] p-3 border border-hadir-line">
        <p class="text-[11px] text-hadir-ink-50 font-semibold tracking-[0.6px] uppercase">Sakit</p>
        <p class="text-[26px] font-bold text-hadir-amber tracking-[-0.6px] mt-0.5">{{ quotas.sakit.used }}</p>
        <p class="text-[11px] text-hadir-ink-50">terpakai</p>
      </div>
      <div class="bg-white rounded-[14px] p-3 border border-hadir-line">
        <p class="text-[11px] text-hadir-ink-50 font-semibold tracking-[0.6px] uppercase">Izin</p>
        <p class="text-[26px] font-bold text-hadir-ink tracking-[-0.6px] mt-0.5">{{ quotas.izin.used }}</p>
        <p class="text-[11px] text-hadir-ink-50">terpakai</p>
      </div>
    </div>

    <!-- tabs -->
    <div class="px-5 mt-5 flex border-b border-hadir-line">
      <button
        v-for="t in (['pending','approved','rejected'] as const)"
        :key="t"
        class="flex-1 py-2.5 text-center text-sm flex items-center justify-center gap-1.5 -mb-px transition"
        :class="tab === t
          ? 'border-b-2 border-hadir-teal text-hadir-teal font-semibold'
          : 'border-b-2 border-transparent text-hadir-ink-50 font-medium'"
        @click="tab = t"
      >
        {{ statusMap[t].label }}
        <span
          class="text-[11px] px-1.5 py-px rounded-[9px] font-bold"
          :class="tab === t ? 'bg-hadir-teal-sft text-hadir-teal' : 'bg-hadir-bg text-hadir-ink-50'"
        >{{ counts[t] }}</span>
      </button>
    </div>

    <!-- list -->
    <div class="px-5 pt-4 space-y-2.5">
      <div
        v-if="!loading && filtered.length === 0"
        class="bg-white rounded-2xl p-10 text-center border border-hadir-line"
      >
        <div class="w-12 h-12 rounded-full bg-hadir-bg flex items-center justify-center mx-auto mb-3">
          <svg class="w-6 h-6 text-hadir-ink-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <rect x="3" y="5" width="18" height="16" rx="2.5" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </div>
        <p class="text-sm text-hadir-ink-50">Belum ada pengajuan {{ statusMap[tab].label.toLowerCase() }}.</p>
        <button
          v-if="tab === 'pending'"
          class="mt-3 text-sm font-semibold text-hadir-teal"
          @click="openDialog"
        >Ajukan sekarang →</button>
      </div>

      <div
        v-for="l in filtered"
        :key="l.id"
        class="bg-white rounded-2xl p-4 border border-hadir-line"
      >
        <div class="flex items-start gap-3">
          <div
            class="w-[42px] h-[42px] rounded-xl flex items-center justify-center flex-shrink-0"
            :style="{ background: typeMap[l.type].color + '1A' }"
          >
            <svg v-if="l.type === 'cuti'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" :stroke="typeMap[l.type].color" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <svg v-else-if="l.type === 'sakit'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" :stroke="typeMap[l.type].color" stroke-width="1.8" stroke-linecap="round">
              <rect x="4" y="6" width="16" height="14" rx="2" />
              <path d="M9 13h6M12 10v6" />
            </svg>
            <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" :stroke="typeMap[l.type].color" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start gap-2">
              <p class="text-[15px] font-semibold text-hadir-ink">{{ typeMap[l.type].label }}</p>
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0"
                :class="[statusMap[l.status].bg, statusMap[l.status].fg]"
              >{{ statusMap[l.status].label }}</span>
            </div>
            <p class="text-[13px] text-hadir-ink-70 mt-1">
              {{ rangeLabel(l) }} · <b class="text-hadir-ink">{{ durationDays(l) }} hari</b>
            </p>
            <div
              v-if="l.reason"
              class="mt-2.5 px-2.5 py-2 bg-hadir-bg rounded-lg text-[12px] text-hadir-ink-70 leading-[1.5]"
            >
              "{{ l.reason }}"
            </div>
            <div
              v-if="l.review_note"
              class="mt-2 px-2.5 py-2 border-l-2 border-hadir-line bg-hadir-bg/60 rounded-r-lg"
            >
              <p class="text-[11px] text-hadir-ink-50 font-semibold">Catatan {{ l.reviewer_name || 'admin' }}</p>
              <p class="text-xs text-hadir-ink-70 italic">{{ l.review_note }}</p>
            </div>
            <button
              v-if="l.attachment_name"
              type="button"
              :disabled="attachmentBusy === l.id"
              class="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-hadir-teal disabled:opacity-50"
              @click="openAttachment(l)"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {{ attachmentBusy === l.id ? 'Membuka…' : 'Lihat lampiran' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- LEAVE FORM modal -->
    <Teleport to="body">
      <div
        v-if="dialogOpen"
        class="fixed inset-0 bg-hadir-ink/40 backdrop-blur-sm flex items-end z-50"
        @click.self="dialogOpen = false"
      >
        <form
          class="bg-hadir-bg w-full rounded-t-3xl max-h-[92vh] overflow-y-auto flex flex-col"
          style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);"
          @submit.prevent="submit"
        >
          <div class="w-12 h-1.5 rounded-full bg-hadir-line mx-auto mt-2.5" />
          <div class="flex items-center px-5 pt-2 pb-1.5">
            <button
              type="button"
              class="w-[38px] h-[38px] rounded-full bg-white shadow-sm flex items-center justify-center"
              aria-label="Tutup"
              @click="dialogOpen = false"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F1B20" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div class="flex-1 text-center text-[17px] font-semibold text-hadir-ink mr-[38px]">Ajukan Cuti / Izin</div>
          </div>

          <div class="px-5 pt-2 space-y-3.5">
            <!-- type pills -->
            <div>
              <p class="text-[12px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-2.5">Jenis Permohonan</p>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="opt in (['cuti','sakit','izin'] as const)"
                  :key="opt"
                  type="button"
                  class="px-3.5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition"
                  :class="form.type === opt
                    ? 'bg-hadir-teal text-white border-none'
                    : 'bg-white text-hadir-ink-70 border-[1.5px] border-hadir-line'"
                  @click="form.type = opt"
                >
                  <span
                    class="w-2 h-2 rounded-full"
                    :style="{ background: form.type === opt ? '#fff' : typeMap[opt].color }"
                  />
                  {{ typeMap[opt].label }}
                </button>
              </div>
            </div>

            <!-- dates -->
            <div class="bg-white rounded-2xl border border-hadir-line p-4">
              <p class="text-[12px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-3">Tanggal</p>
              <div class="flex items-center gap-2.5">
                <label class="flex-1 px-3 py-2.5 bg-hadir-bg rounded-[10px] cursor-pointer">
                  <span class="block text-[11px] text-hadir-ink-50">Mulai</span>
                  <input
                    v-model="form.date_from"
                    type="date"
                    required
                    class="bg-transparent outline-none w-full text-[15px] font-semibold text-hadir-ink"
                  >
                </label>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="#7C8893" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <label class="flex-1 px-3 py-2.5 bg-hadir-bg rounded-[10px] cursor-pointer">
                  <span class="block text-[11px] text-hadir-ink-50">Selesai</span>
                  <input
                    v-model="form.date_to"
                    type="date"
                    required
                    class="bg-transparent outline-none w-full text-[15px] font-semibold text-hadir-ink"
                  >
                </label>
              </div>
              <div class="mt-2.5 px-2.5 py-2 bg-hadir-teal-sft rounded-lg flex justify-between">
                <span class="text-xs text-hadir-teal-dk">Total</span>
                <span class="text-xs font-bold text-hadir-teal-dk">
                  {{ Math.max(1, durationDays({ date_from: form.date_from, date_to: form.date_to } as Leave)) }} hari
                  <template v-if="form.type === 'cuti'">· sisa kuota {{ Math.max(0, settings.annual_leave_quota - quotas.cuti.used) }} hari</template>
                </span>
              </div>
            </div>

            <!-- reason -->
            <div class="bg-white rounded-2xl border border-hadir-line p-4">
              <p class="text-[12px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-2.5">Alasan</p>
              <textarea
                v-model="form.reason"
                rows="3"
                required
                minlength="5"
                maxlength="280"
                placeholder="Tuliskan alasan pengajuan…"
                class="w-full bg-transparent outline-none text-[15px] text-hadir-ink leading-[1.5] resize-none placeholder-hadir-ink-50/60"
              />
              <p class="text-[11px] text-hadir-ink-50 mt-2 text-right">{{ form.reason.length }} / 280</p>
            </div>

            <!-- attachment -->
            <label
              v-if="!file"
              class="bg-white rounded-2xl border-[1.5px] border-dashed border-hadir-line p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition"
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/heic,application/pdf"
                class="hidden"
                @change="onFileChange"
              >
              <div class="w-10 h-10 rounded-[10px] bg-hadir-amber-sft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M11 2H4v14h10V5l-3-3z M11 2v3h3" stroke="#F59E0B" stroke-width="1.6" stroke-linejoin="round" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-hadir-ink">Tambah lampiran</p>
                <p class="text-xs text-hadir-ink-50 mt-0.5">PDF / gambar (jpg, png) · maks {{ MAX_ATTACHMENT_MB }} MB</p>
              </div>
            </label>
            <div
              v-else
              class="bg-white rounded-2xl border-[1.5px] border-hadir-teal/40 p-4 flex items-center gap-3"
            >
              <div class="w-10 h-10 rounded-[10px] bg-hadir-teal-sft flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-hadir-ink truncate">{{ file.name }}</p>
                <p class="text-xs text-hadir-ink-50 mt-0.5">{{ (file.size / 1024).toFixed(0) }} KB · siap diunggah</p>
              </div>
              <button
                type="button"
                class="w-8 h-8 rounded-full bg-hadir-bg text-hadir-ink-70 flex items-center justify-center flex-shrink-0 active:scale-95"
                aria-label="Hapus lampiran"
                @click="clearFile"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
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

          <div class="px-5 pt-3 mt-auto">
            <button
              type="submit"
              :disabled="submitting"
              class="w-full h-[54px] rounded-[14px] bg-hadir-teal text-white font-semibold text-base shadow-hadir-cta active:scale-[0.98] disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              <svg v-if="submitting" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
              {{ submitting ? 'Mengirim…' : 'Kirim Permohonan' }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>
