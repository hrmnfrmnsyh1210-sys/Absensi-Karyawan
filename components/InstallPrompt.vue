<script setup lang="ts">
const { installable, installed, promptInstall, setup } = useInstallPrompt()
const dismissed = useState<boolean>('install_dismissed', () => false)

onMounted(() => setup())

async function install() {
  await promptInstall()
}
</script>

<template>
  <div
    v-if="installable && !installed && !dismissed"
    class="bg-hadir-teal-sft border border-hadir-teal/15 rounded-xl p-3 flex items-center gap-3"
  >
    <div class="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center flex-shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C66" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="3" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-hadir-teal-dk">Pasang sebagai Aplikasi</p>
      <p class="text-xs text-hadir-teal-dk/80">Akses lebih cepat dari layar utama.</p>
    </div>
    <div class="flex gap-1 flex-shrink-0">
      <button
        class="text-xs text-hadir-ink-70 hover:text-hadir-ink px-2"
        @click="dismissed = true"
      >
        Nanti
      </button>
      <button
        class="bg-hadir-teal hover:bg-hadir-teal-dk text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-hadir-cta"
        @click="install"
      >
        Pasang
      </button>
    </div>
  </div>
</template>
