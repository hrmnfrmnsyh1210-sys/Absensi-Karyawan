import { createWebHashHistory, createWebHistory } from 'vue-router'
import type { RouterConfig } from '@nuxt/schema'

declare const __IS_CAPACITOR__: boolean

export default <RouterConfig>{
  history: (base) => (__IS_CAPACITOR__ ? createWebHashHistory(base) : createWebHistory(base))
}
