<script setup lang="ts">
const { user, logout } = useAuth();
const route = useRoute();

type IconName = "chart" | "users" | "list" | "inbox" | "cog" | "cal" | "today";
interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

const primaryNav: NavItem[] = [
  { path: "/admin", label: "Ringkasan", icon: "chart" },
  { path: "/admin/harian", label: "Harian", icon: "today" },
  { path: "/admin/izin", label: "Approval", icon: "inbox" },
  { path: "/admin/rekap", label: "Rekap", icon: "list" },
];

const profileMenu: NavItem[] = [
  { path: "/admin/pegawai", label: "Pegawai", icon: "users" },
  { path: "/admin/libur", label: "Hari Libur", icon: "cal" },
  { path: "/admin/pengaturan", label: "Pengaturan", icon: "cog" },
];

const navItems = [...primaryNav, ...profileMenu];

const profileOpen = ref(false);

watch(() => route.path, () => { profileOpen.value = false });

const currentTitle = computed(
  () => navItems.find((i) => i.path === route.path)?.label || "Admin",
);
const initials = computed(() => {
  const n = user.value?.name?.trim() || "A";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
});

function doLogout() {
  profileOpen.value = false;
  logout();
}
</script>

<template>
  <div class="min-h-screen bg-hadir-bg md:flex font-sans">
    <aside
      class="hidden md:flex md:flex-col md:w-64 bg-white border-r border-hadir-line"
    >
      <div class="p-5 border-b border-hadir-line">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-hadir-teal text-white flex items-center justify-center shadow-hadir-cta"
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="font-bold text-hadir-ink leading-tight">
              Hadir Admin
            </div>
            <div class="text-xs text-hadir-ink-70 truncate max-w-[160px]">
              {{ user?.name }}
            </div>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-3 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition relative"
          :class="
            route.path === item.path
              ? 'bg-hadir-teal-sft text-hadir-teal-dk font-semibold'
              : 'text-hadir-ink-70 hover:bg-hadir-bg'
          "
        >
          <span
            v-if="route.path === item.path"
            class="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-hadir-teal"
          />
          <span class="w-5 h-5 flex-shrink-0">
            <svg
              v-if="item.icon === 'chart'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
            <svg
              v-else-if="item.icon === 'users'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <circle cx="9" cy="8" r="3.5" />
              <circle cx="17" cy="9" r="2.5" />
              <path d="M3 19c1-3 3-5 6-5s5 2 6 5M15 18c.5-2 2-3 4-3s3 1 3 3" />
            </svg>
            <svg
              v-else-if="item.icon === 'list'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <svg
              v-else-if="item.icon === 'inbox'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <path d="M3 13l2-7h14l2 7v6H3v-6z" />
              <path d="M3 13h6l1 2h4l1-2h6" />
            </svg>
            <svg
              v-else-if="item.icon === 'cal'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <svg
              v-else-if="item.icon === 'today'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M3 10h18M8 3v4M16 3v4" />
              <circle cx="12" cy="15" r="2" fill="currentColor" />
            </svg>
            <svg
              v-else-if="item.icon === 'cog'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-5 h-5"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </span>
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="p-3 border-t border-hadir-line space-y-1">
        <NuxtLink
          to="/"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-hadir-ink-70 hover:bg-hadir-bg"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" />
          </svg>
          Mode Pegawai
        </NuxtLink>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-hadir-red hover:bg-hadir-red-sft"
          @click="logout"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Keluar
        </button>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="md:hidden bg-white border-b border-hadir-line sticky top-0 z-20 px-4 flex items-center justify-between"
        style="
          padding-top: calc(env(safe-area-inset-top) + 0.65rem);
          padding-bottom: 0.65rem;
        "
      >
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-9 h-9 rounded-xl bg-hadir-teal text-white flex items-center justify-center shadow-hadir-cta flex-shrink-0"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <div class="min-w-0">
            <div
              class="text-[11px] uppercase tracking-wide text-hadir-ink-50 leading-none font-semibold"
            >
              Hadir Admin
            </div>
            <div class="font-bold text-hadir-ink truncate">
              {{ currentTitle }}
            </div>
          </div>
        </div>
        <button
          class="relative w-9 h-9 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-sm font-semibold shadow-hadir-soft active:scale-95 transition"
          aria-label="Menu profil"
          @click="profileOpen = true"
        >
          {{ initials }}
          <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center border border-hadir-line">
            <svg class="w-2 h-2 text-hadir-ink-70" viewBox="0 0 8 8" fill="none">
              <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </header>

      <main
        class="flex-1 px-3 pt-3 pb-24 md:p-8 md:pb-8 max-w-6xl w-full mx-auto"
      >
        <slot />
      </main>

      <nav
        class="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-hadir-line z-20"
        style="padding-bottom: env(safe-area-inset-bottom)"
      >
        <div class="grid grid-cols-4">
          <NuxtLink
            v-for="item in primaryNav"
            :key="item.path"
            :to="item.path"
            class="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] relative transition"
            :class="
              route.path === item.path
                ? 'text-hadir-teal font-semibold'
                : 'text-hadir-ink-50'
            "
          >
            <span
              v-if="route.path === item.path"
              class="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-b-full bg-hadir-teal"
            />
            <span class="w-6 h-6 flex items-center justify-center">
              <svg
                v-if="item.icon === 'chart'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-5 h-5"
              >
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
              <svg
                v-else-if="item.icon === 'today'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-5 h-5"
              >
                <rect x="3" y="5" width="18" height="16" rx="2.5" />
                <path d="M3 10h18M8 3v4M16 3v4" />
                <circle cx="12" cy="15" r="2" fill="currentColor" />
              </svg>
              <svg
                v-else-if="item.icon === 'inbox'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
                class="w-5 h-5"
              >
                <path d="M3 13l2-7h14l2 7v6H3v-6z" />
                <path d="M3 13h6l1 2h4l1-2h6" />
              </svg>
              <svg
                v-else-if="item.icon === 'list'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-5 h-5"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </span>
            {{ item.label }}
          </NuxtLink>
        </div>
      </nav>

      <!-- Mobile profile sheet -->
      <Teleport to="body">
        <div
          v-if="profileOpen"
          class="md:hidden fixed inset-0 bg-hadir-ink/40 backdrop-blur-sm flex items-end z-30"
          @click.self="profileOpen = false"
        >
          <div
            class="bg-white w-full rounded-t-3xl"
            style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)"
          >
            <div class="w-12 h-1.5 rounded-full bg-hadir-line mx-auto mt-2.5" />

            <!-- Profile header -->
            <div class="px-5 pt-4 pb-3 flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-hadir-teal to-hadir-teal-dk text-white flex items-center justify-center text-base font-bold shadow-hadir-soft flex-shrink-0">
                {{ initials }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-hadir-ink truncate">{{ user?.name }}</div>
                <div class="text-[12px] text-hadir-ink-70 truncate">Admin · {{ user?.email }}</div>
              </div>
              <button
                class="w-9 h-9 rounded-full hover:bg-hadir-bg flex items-center justify-center flex-shrink-0"
                aria-label="Tutup"
                @click="profileOpen = false"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div class="h-px bg-hadir-line mx-5" />

            <div class="px-3 py-2">
              <!-- Admin config items -->
              <NuxtLink
                v-for="item in profileMenu"
                :key="item.path"
                :to="item.path"
                class="flex items-center gap-3 px-3 py-3 rounded-xl"
                :class="
                  route.path === item.path
                    ? 'bg-hadir-teal-sft text-hadir-teal-dk font-semibold'
                    : 'text-hadir-ink hover:bg-hadir-bg'
                "
              >
                <span
                  class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  :class="
                    route.path === item.path
                      ? 'bg-hadir-teal text-white'
                      : 'bg-hadir-bg text-hadir-ink-70'
                  "
                >
                  <svg
                    v-if="item.icon === 'users'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="w-5 h-5"
                  >
                    <circle cx="9" cy="8" r="3.5" />
                    <circle cx="17" cy="9" r="2.5" />
                    <path d="M3 19c1-3 3-5 6-5s5 2 6 5M15 18c.5-2 2-3 4-3s3 1 3 3" />
                  </svg>
                  <svg
                    v-else-if="item.icon === 'cal'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="w-5 h-5"
                  >
                    <rect x="3" y="5" width="18" height="16" rx="2.5" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                  <svg
                    v-else-if="item.icon === 'cog'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="w-5 h-5"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    />
                  </svg>
                </span>
                <span class="text-sm flex-1">{{ item.label }}</span>
                <svg class="w-3.5 h-3.5 text-hadir-ink-50" viewBox="0 0 7 12" fill="none">
                  <path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
              </NuxtLink>

              <div class="my-2 h-px bg-hadir-line" />

              <!-- Account actions -->
              <NuxtLink
                to="/"
                class="flex items-center gap-3 px-3 py-3 rounded-xl text-hadir-ink hover:bg-hadir-bg"
              >
                <span class="w-9 h-9 rounded-lg bg-hadir-bg text-hadir-ink-70 flex items-center justify-center flex-shrink-0">
                  <svg
                    class="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="12" y1="18" x2="12" y2="18" />
                  </svg>
                </span>
                <span class="text-sm flex-1">Mode Pegawai</span>
                <svg class="w-3.5 h-3.5 text-hadir-ink-50" viewBox="0 0 7 12" fill="none">
                  <path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
              </NuxtLink>

              <button
                type="button"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-hadir-red hover:bg-hadir-red-sft"
                @click="doLogout"
              >
                <span class="w-9 h-9 rounded-lg bg-hadir-red-sft text-hadir-red flex items-center justify-center flex-shrink-0">
                  <svg
                    class="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span class="text-sm font-semibold flex-1 text-left">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
