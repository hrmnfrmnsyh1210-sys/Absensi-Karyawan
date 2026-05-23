import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'id.absensi.karyawan',
  appName: 'Absensi Karyawan',
  // Folder hasil `nuxi generate` (static SPA). Akan di-bundle ke dalam APK.
  webDir: '.output/public',
  android: {
    // Wajib true kalau API Anda di HTTP (LAN dev). Production wajib HTTPS.
    allowMixedContent: true
  },
  plugins: {
    // Bypass CORS WebView: fetch() & XHR di-route lewat native HTTP layer.
    // Wajib aktif untuk APK karena origin https://localhost ditolak preflight Vercel.
    CapacitorHttp: {
      enabled: true
    }
  }
  // Untuk dev cepat dengan live-reload langsung dari Nuxt dev server, uncomment ini:
  // server: {
  //   url: 'http://192.168.1.10:3000',
  //   cleartext: true
  // }
}

export default config
