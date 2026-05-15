// Handler push & notificationclick — di-importScripts oleh service worker
// bawaan workbox (lihat nuxt.config.ts -> pwa.workbox.importScripts).

self.addEventListener('push', (event) => {
  let data = {}
  if (event.data) {
    try { data = event.data.json() }
    catch { data = { title: 'Hadir', body: event.data.text() } }
  }
  const title = data.title || 'Hadir — Absensi Karyawan'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    tag: data.tag || ('hadir-' + (data.refType || 'info') + '-' + (data.refId || Date.now())),
    data: { url: data.url || '/notifikasi' },
    requireInteraction: false,
    vibrate: [120, 60, 120]
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/notifikasi'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Reuse tab yang sudah membuka aplikasi — fokus & arahkan ke URL target.
    for (const client of all) {
      try {
        const u = new URL(client.url)
        if (u.origin === self.location.origin) {
          if ('navigate' in client) {
            try { await client.navigate(target) } catch {}
          }
          return client.focus()
        }
      } catch {}
    }
    if (self.clients.openWindow) return self.clients.openWindow(target)
  })())
})
