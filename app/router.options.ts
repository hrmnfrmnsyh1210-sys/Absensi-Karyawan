import { createMemoryHistory, createWebHashHistory, createWebHistory } from 'vue-router'
import type { RouterConfig } from '@nuxt/schema'

declare const __IS_CAPACITOR__: boolean

export default <RouterConfig>{
  history: (base) => {
    // `__IS_CAPACITOR__` di-inject via vite.define hanya untuk bundle client.
    // `typeof` aman: tidak throw kalau global ini tak ada di bundle server.
    const isCapacitor = typeof __IS_CAPACITOR__ !== 'undefined' && __IS_CAPACITOR__
    // Capacitor (ssr:false, SPA) → hash router, hanya jalan di client.
    if (isCapacitor) return createWebHashHistory(base)
    // Web SSR: di server tidak ada window/document. `createWebHistory`
    // mengaksesnya saat dibuat → "window is not defined" → 500.
    // Pakai memory history di server (sama seperti default Nuxt).
    if (import.meta.server) return createMemoryHistory(base)
    return createWebHistory(base)
  }
}
