<script setup lang="ts">
const route = useRoute()

type IconName = 'home' | 'clock' | 'cal' | 'user'
const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Beranda', icon: 'home' },
  { path: '/riwayat', label: 'Riwayat', icon: 'clock' },
  { path: '/izin', label: 'Cuti', icon: 'cal' },
  { path: '/saya', label: 'Saya', icon: 'user' }
]
</script>

<template>
  <div class="min-h-screen bg-hadir-bg flex flex-col">
    <main
      class="flex-1 max-w-md mx-auto w-full pb-[100px]"
      style="padding-top: env(safe-area-inset-top);"
    >
      <slot />
    </main>

    <nav
      class="fixed bottom-0 inset-x-0 bg-white border-t border-hadir-line z-20"
      style="padding-bottom: env(safe-area-inset-bottom);"
    >
      <div class="max-w-md mx-auto grid grid-cols-4 pt-2.5 pb-3">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex flex-col items-center justify-start gap-1 text-[11px] tracking-[0.1px] transition"
          :class="route.path === item.path
            ? 'text-hadir-teal font-semibold'
            : 'text-hadir-ink-50 font-medium'"
        >
          <span class="w-[22px] h-[22px] flex items-center justify-center">
            <svg v-if="item.icon === 'home'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" class="w-[22px] h-[22px]">
              <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" />
            </svg>
            <svg v-else-if="item.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="w-[22px] h-[22px]">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <svg v-else-if="item.icon === 'cal'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="w-[22px] h-[22px]">
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <svg v-else-if="item.icon === 'user'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="w-[22px] h-[22px]">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
            </svg>
          </span>
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
