const isCapacitor = process.env.CAPACITOR === 'true'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  // Capacitor: SPA only (no per-route prerender → hash router handles everything client-side)
  ssr: !isCapacitor,
  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || '3306',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'absensi_karyawan',
    dbSsl: process.env.DB_SSL || 'false',
    // Web Push (server side only — private key rahasia)
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    public: {
      // Base URL untuk fetch API. Kosong = relative (web mode).
      // Untuk Capacitor APK, isi via NUXT_PUBLIC_API_BASE saat build:
      //   NUXT_PUBLIC_API_BASE=http://192.168.1.10:3000 npm run build:capacitor
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      // Public key VAPID — dibaca browser saat subscribe push.
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || ''
    }
  },
  vite: {
    define: {
      __IS_CAPACITOR__: JSON.stringify(isCapacitor)
    }
  },
  app: {
    head: {
      title: 'Absensi Karyawan',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0E7C66' },
        { name: 'description', content: 'Aplikasi absensi karyawan berbasis GPS' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Absensi' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/icon.png' },
        { rel: 'apple-touch-icon', href: '/icon.png' }
      ]
    }
  },
  pwa: {
    disable: isCapacitor,
    registerType: 'autoUpdate',
    manifest: {
      name: 'Hadir — Absensi Karyawan',
      short_name: 'Hadir',
      description: 'Aplikasi absensi karyawan berbasis GPS',
      theme_color: '#0E7C66',
      background_color: '#0E7C66',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      lang: 'id',
      icons: [
        { src: '/icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,ico,woff2}'],
      // Tambahkan handler push & notificationclick ke service worker bawaan.
      importScripts: ['/push-sw.js'],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkOnly'
        },
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }
          }
        }
      ]
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: true,
      type: 'module',
      navigateFallback: '/'
    }
  }
})
