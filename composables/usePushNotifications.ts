// Pengelolaan Web Push (notifikasi HP) — minta izin, subscribe, unsubscribe.
// SW di-register otomatis oleh @vite-pwa/nuxt (registerType: autoUpdate).

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function usePushNotifications() {
  const api = useApi()
  const cfg = useRuntimeConfig()
  const vapidPublicKey = (cfg.public.vapidPublicKey as string) || ''

  const supported = useState<boolean>('push_supported', () => false)
  const permission = useState<NotificationPermission | 'unsupported'>('push_permission', () => 'unsupported')
  const subscribed = useState<boolean>('push_subscribed', () => false)
  const busy = useState<boolean>('push_busy', () => false)
  const error = useState<string | null>('push_error', () => null)

  function detect() {
    if (!import.meta.client) return
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    supported.value = ok
    permission.value = ok ? Notification.permission : 'unsupported'
  }

  async function refresh() {
    detect()
    if (!supported.value) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      subscribed.value = !!sub
    } catch {
      subscribed.value = false
    }
  }

  async function enable() {
    error.value = null
    if (!import.meta.client) return false
    detect()
    if (!supported.value) {
      error.value = 'Browser ini belum mendukung notifikasi push.'
      return false
    }
    if (!vapidPublicKey) {
      error.value = 'VAPID public key belum dikonfigurasi di server.'
      return false
    }
    busy.value = true
    try {
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') {
        error.value = 'Izin notifikasi belum diberikan.'
        return false
      }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        })
      }
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await api('/api/push/subscribe', { method: 'POST', body: json })
      subscribed.value = true
      return true
    } catch (e: any) {
      error.value = e?.message || 'Gagal mengaktifkan notifikasi.'
      return false
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    error.value = null
    if (!import.meta.client || !supported.value) return
    busy.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe().catch(() => {})
        await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint } }).catch(() => {})
      }
      subscribed.value = false
    } catch (e: any) {
      error.value = e?.message || 'Gagal menonaktifkan notifikasi.'
    } finally {
      busy.value = false
    }
  }

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    detect,
    refresh,
    enable,
    disable
  }
}
