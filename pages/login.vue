<script setup lang="ts">
definePageMeta({ layout: false })

const { login, token } = useAuth()
const identifier = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)
const showPassword = ref(false)
const showForm = ref(false)

if (token.value) {
  await navigateTo('/', { replace: true })
}

async function onSubmit() {
  error.value = null
  loading.value = true
  try {
    const u = await login(identifier.value, password.value)
    await navigateTo(u.role !== 'pegawai' ? '/admin' : '/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Gagal login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-hadir-teal text-white">
    <div class="pointer-events-none absolute -top-[180px] -right-[160px] w-[460px] h-[460px] rounded-full border-[1.5px] border-white/10" />
    <div class="pointer-events-none absolute -top-[60px] -right-[80px] w-[320px] h-[320px] rounded-full border-[1.5px] border-white/[0.13]" />
    <div class="pointer-events-none absolute bottom-[280px] -left-[50px] w-[180px] h-[180px] rounded-full bg-hadir-amber/95" />

    <div
      class="relative min-h-screen flex flex-col px-6"
      style="padding-top: calc(env(safe-area-inset-top) + 1.25rem); padding-bottom: calc(env(safe-area-inset-bottom) + 1.5rem);"
    >
      <div class="flex items-center gap-3 pt-4">
        <svg class="w-10 h-10" viewBox="0 0 40 40" fill="none">
          <rect x="6" y="6" width="28" height="28" rx="9" stroke="#fff" stroke-width="2.4" />
          <path d="M14 21l4 4 8-9" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div>
          <div class="text-[22px] font-bold tracking-[-0.3px] leading-tight">Hadir</div>
          <div class="text-xs text-white/70 tracking-[0.4px]">by PT Nusantara</div>
        </div>
      </div>

      <div v-if="!showForm" class="relative z-10 flex-1 flex flex-col justify-end pb-12">
        <div>
          <p class="text-[13px] font-semibold text-white uppercase tracking-[1.4px] mb-3.5">
            Absensi Karyawan
          </p>
          <h1 class="text-[38px] font-bold leading-[1.1] tracking-[-0.8px]">
            Catat hadir<br>tanpa <span class="text-hadir-amber">antri.</span>
          </h1>
          <p class="text-[15px] text-white/[0.78] mt-3.5 leading-[1.5]">
            Clock-in dari mana saja dalam radius kantor. Ajukan cuti &amp; izin langsung dari ponsel.
          </p>
        </div>

        <div class="mt-10">
          <button
            type="button"
            class="w-full h-[54px] rounded-[14px] bg-white text-hadir-teal font-bold text-base flex items-center justify-center active:scale-[0.98] transition"
            @click="showForm = true"
          >
            Masuk dengan email kantor
          </button>
          <p class="text-center mt-4 text-sm text-white/[0.78]">
            Belum punya akun? <span class="text-white font-semibold">Hubungi HR</span>
          </p>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col justify-end pb-6">
        <form
          class="bg-white rounded-3xl p-6 space-y-4 text-hadir-ink shadow-hadir-card"
          @submit.prevent="onSubmit"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold">Masuk akun Anda</h2>
            <button
              type="button"
              class="w-8 h-8 rounded-full text-hadir-ink-50 hover:bg-hadir-bg flex items-center justify-center"
              aria-label="Tutup"
              @click="showForm = false"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-2">
              Email atau NIP
            </label>
            <input
              v-model="identifier"
              type="text"
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
              required
              placeholder="nama@perusahaan.com"
              class="w-full h-12 rounded-xl bg-hadir-bg border border-hadir-line px-3 text-base text-hadir-ink placeholder-hadir-ink-50/70 focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
            >
          </div>

          <div>
            <label class="block text-[11px] font-bold text-hadir-ink-50 uppercase tracking-[1.2px] mb-2">
              Password
            </label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                placeholder="Masukkan password"
                class="w-full h-12 rounded-xl bg-hadir-bg border border-hadir-line pl-3 pr-11 text-base text-hadir-ink placeholder-hadir-ink-50/70 focus:bg-white focus:border-hadir-teal focus:ring-2 focus:ring-hadir-teal/20 outline-none transition"
              >
              <button
                type="button"
                tabindex="-1"
                aria-label="Tampilkan password"
                class="absolute inset-y-0 right-0 flex items-center px-3 text-hadir-ink-50"
                @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 4.22-5.06" />
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-3.17 4.19" />
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
          </div>

          <div
            v-if="error"
            class="flex items-start gap-2 text-sm text-hadir-red bg-hadir-red-sft border border-hadir-red/20 rounded-xl px-3 py-2.5"
          >
            <svg class="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{{ error }}</span>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full h-[54px] rounded-[14px] bg-hadir-teal text-white font-semibold text-base flex items-center justify-center gap-2 shadow-hadir-cta active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition"
          >
            <svg v-if="loading" class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
            </svg>
            <span>{{ loading ? 'Memproses...' : 'Masuk' }}</span>
          </button>

          <p class="text-[11px] text-hadir-ink-50 text-center pt-2 border-t border-hadir-line leading-relaxed">
            Demo akun
            <span class="block mt-0.5 font-mono text-hadir-ink">superadmin@telkomakses.co.id / superadmin123</span>
            <span class="block font-mono text-hadir-ink">admin@telkomakses.co.id / admin123</span>
          </p>
        </form>
      </div>
    </div>
  </div>
</template>
