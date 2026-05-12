# Absensi Karyawan

Aplikasi absensi karyawan berbasis GPS. **MVP**: login (JWT), absen masuk/pulang dengan validasi radius kantor, riwayat absensi.

Stack: **Nuxt 3** (frontend + Nitro server API) + **MySQL** + **Tailwind CSS**. Web-first/PWA, siap di-wrap dengan Capacitor untuk APK Android nanti.

## Persyaratan

- Node.js 18+ (saat ini terpasang: v22)
- MySQL 5.7 / 8+ (XAMPP, Laragon, atau MySQL standalone)

## Setup

### 1. Install dependensi

```bash
npm install
```

### 2. Konfigurasi environment

Salin `.env.example` jadi `.env`, lalu sesuaikan:

```bash
copy .env.example .env
```

Isi minimal yang perlu disesuaikan:
- `DB_PASSWORD` — kosongkan kalau pakai XAMPP default, atau isi password MySQL Anda
- `JWT_SECRET` — wajib ganti dengan string acak (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### 3. Pastikan MySQL jalan

Kalau pakai XAMPP/Laragon, start service MySQL dari panelnya.

### 4. Buat database + seed data

```bash
npm run db:setup
```

Script ini akan:
- Membuat database `absensi_karyawan` (kalau belum ada)
- Membuat tabel `users`, `offices`, `attendance`
- Insert 1 office default (Pontianak, radius 50 m)
- Insert 2 user demo

**Akun demo:**
| Role    | Email / NIP            | Password    |
|---------|------------------------|-------------|
| Admin   | `admin@example.com` / `ADM001` | `admin123` |
| Pegawai | `pegawai@example.com` / `P001` | `pegawai123` |

### 5. Jalankan dev server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

> **Catatan GPS:** Browser hanya mengizinkan Geolocation API di `localhost` atau HTTPS. Untuk test dari HP lain, pakai `npm run dev -- --host` lalu akses via IP — atau gunakan tunneling (ngrok, cloudflared) untuk dapat HTTPS.

## Struktur Project

```
.
├── app.vue                       # Root component
├── assets/css/main.css           # Tailwind entry
├── composables/
│   ├── useAuth.ts                # Login, logout, token cookie
│   └── useApi.ts                 # $fetch wrapper dengan auth header
├── db/schema.sql                 # DDL MySQL
├── layouts/default.vue           # Layout dengan bottom nav
├── middleware/auth.global.ts     # Redirect ke /login kalau belum auth
├── pages/
│   ├── login.vue                 # Halaman login
│   ├── index.vue                 # Dashboard (status absen hari ini)
│   ├── absen.vue                 # Absen masuk/pulang (GPS)
│   └── riwayat.vue               # Riwayat absensi
├── public/
│   ├── manifest.webmanifest      # PWA manifest
│   └── icon.svg
├── scripts/setup-db.mjs          # Migrasi + seed
└── server/
    ├── api/
    │   ├── auth/login.post.ts
    │   ├── me.get.ts
    │   ├── office.get.ts
    │   └── attendance/
    │       ├── index.post.ts     # POST /api/attendance (check_in / check_out)
    │       ├── history.get.ts
    │       └── today.get.ts
    └── utils/
        ├── auth.ts               # JWT, bcrypt, requireAuth
        ├── db.ts                 # mysql2 pool
        └── distance.ts           # Haversine
```

## Cara Kerja Validasi GPS

1. Frontend (`pages/absen.vue`) memanggil `navigator.geolocation.getCurrentPosition` dengan `enableHighAccuracy: true`.
2. Koordinat dikirim ke `POST /api/attendance` bersama `type` (check_in / check_out).
3. Server mengambil koordinat kantor dari tabel `offices`, hitung jarak dengan rumus Haversine.
4. Kalau jarak > `radius_m`, server tolak dengan error 422.
5. Kalau valid, insert ke tabel `attendance` lengkap dengan jarak, IP, dan user-agent.

**Penting**: validasi radius dilakukan di server, bukan di client. Client tidak bisa "memaksa" absensi diterima dengan memodifikasi JS.

## Pasang sebagai PWA di HP Android (tanpa APK)

App ini sudah PWA-ready dengan service worker (auto-cache + offline shell). User bisa install di HP **tanpa Google Play, tanpa APK file**:

### Cara user install dari HP

1. Pastikan dev/prod server bisa diakses dari HP (LAN IP, ngrok, atau deploy production).
2. Buka link di **Chrome Android**.
3. Tombol "📲 Pasang sebagai Aplikasi" akan muncul di bawah login form / di atas dashboard.
4. Klik tombol itu, atau dari menu Chrome titik tiga → **"Tambahkan ke layar utama"**.
5. Icon "Absensi" muncul di home screen HP. Tap → terbuka **fullscreen tanpa address bar**, persis seperti native app.

> **Catatan**: Browser akan menampilkan opsi install hanya kalau (a) site di-serve via HTTPS atau localhost, (b) ada `manifest.webmanifest` valid (sudah ada), (c) service worker terdaftar (sudah ada di production build).

### Test PWA secara lokal

Service worker **tidak aktif di mode `npm run dev`** (sengaja, biar tidak ganggu development). Untuk test PWA penuh:

```powershell
npm run build
node .output/server/index.mjs
```
Atau:
```powershell
npm run preview
```
Lalu akses dari HP via LAN IP komputer (`http://192.168.x.x:3000`). HP harus di WiFi sama.

### Test dari HP yang berbeda WiFi

Pakai **ngrok** untuk dapat URL HTTPS public:
```powershell
npm run build
node .output/server/index.mjs   # di terminal 1, pastikan jalan port 3000
ngrok http 3000                 # di terminal 2, dapat URL https://xxxx.ngrok.io
```
Buka URL ngrok dari HP. Karena HTTPS, install prompt akan muncul.

### Anti-cheat di mode PWA (terbatas)

Ya, PWA punya keterbatasan dibanding native APK:

| Anti-cheat | PWA | Native APK |
|---|---|---|
| GPS akurat | ✅ Geolocation API + `enableHighAccuracy: true` | ✅ + lebih akurat |
| Selfie kamera | ✅ via `getUserMedia` | ✅ |
| Cegah double absen | ✅ (server-side validation) | ✅ |
| **Mock GPS detection** | ❌ Browser tidak expose | ⚠️ Bisa, tapi banyak Fake GPS bypass |
| **Device binding** | ⚠️ Soft via fingerprint browser | ✅ via Android ID |
| **Anti-rooted device** | ❌ | ⚠️ Butuh paid SDK |

Untuk mengompensasi:
- Wajibkan **selfie** saat absen (sulit dipalsukan)
- Log **IP address** + user agent (deteksi pola mencurigakan, misal 5 user absen dari IP sama)
- Tambah **akurasi GPS minimum** (tolak absen kalau accuracy > 50 m)
- Server-side **rate-limit** absen per akun

## Build APK Android (Capacitor)

Project sudah disiapkan struktur Capacitor-nya. Untuk benar-benar build APK, Anda butuh **Android Studio** + **JDK 17**. Tahap-tahapnya:

### 1. Install prerequisite (sekali saja)

- **Android Studio** — download dari [developer.android.com/studio](https://developer.android.com/studio). Saat install, pastikan SDK Platform & SDK Build-Tools ikut ter-install.
- **Java JDK 17+** — biasanya sudah dibundel Android Studio. Cek: `java --version`.
- Set environment variable `ANDROID_HOME` ke folder SDK (biasanya `C:\Users\<nama>\AppData\Local\Android\Sdk`).

### 2. Cari LAN IP komputer Anda

```powershell
ipconfig | findstr "IPv4"
```
Ambil IP yang formatnya `192.168.x.x` atau `10.x.x.x` — misal `192.168.1.10`. **HP & komputer harus di WiFi sama**.

### 3. Generate static SPA + tambah platform Android (sekali saja)

```powershell
# Build static SPA dengan API base ke LAN IP Anda
$env:NUXT_PUBLIC_API_BASE = "http://192.168.1.10:3000"
npm run build:capacitor

# Tambah folder android/ (perlu Android Studio terpasang)
npm run cap:add-android
```

Folder `android/` akan tergenerate berisi project Android Studio.

### 4. Sync & buka di Android Studio

```powershell
npm run cap:sync
npm run cap:open
```

Android Studio akan terbuka dengan project. Tunggu Gradle sync selesai.

### 5. Build APK

Di Android Studio:
- Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK keluar di `android/app/build/outputs/apk/debug/app-debug.apk`
- Install ke HP via USB atau kirim file ke HP & install manual.

### 6. Pastikan dev server jalan saat APK dipakai

```powershell
npm run dev -- --host
```
Flag `--host` membuat dev server di-bind ke semua interface (bukan cuma localhost), sehingga HP bisa akses via `192.168.x.x:3000`.

### Setiap kali ada perubahan kode

```powershell
$env:NUXT_PUBLIC_API_BASE = "http://192.168.1.10:3000"
npm run build:capacitor
npm run cap:sync
# Lalu rebuild APK di Android Studio
```

### Troubleshooting

- **APK terbuka tapi blank putih**: kemungkinan `webDir` kosong. Pastikan `npm run build:capacitor` jalan dulu.
- **"Network error" di APK saat login**: cek HP & komputer di WiFi sama, firewall Windows tidak block port 3000, dan `NUXT_PUBLIC_API_BASE` sesuai LAN IP.
- **GPS tidak akurat di APK**: di tahap ini APK masih pakai `navigator.geolocation`. Untuk akurasi native, install `@capacitor/geolocation` (tahap berikutnya).

### Yang belum di tahap ini

- Plugin native: `@capacitor/geolocation`, `@capacitor/device`, `@capacitor/camera`
- Device binding (1 akun = 1 HP via Device UUID)
- Mock GPS detection (perlu custom Kotlin plugin)
- App icon & splash screen custom
- Keystore & signed release APK

## Roadmap Berikutnya

Tahap selanjutnya (tidak termasuk MVP ini):

- [ ] **Selfie** saat absen (Capacitor Camera plugin saat di APK)
- [ ] **Mock GPS detection** (Capacitor — hanya bisa di native Android, tidak di browser)
- [ ] **Device binding** (1 akun = 1 Android ID)
- [ ] **Dashboard admin** — daftar pegawai, rekap kehadiran, peta lokasi absen, export Excel/PDF
- [ ] **Maps** — tampilkan titik absen di Leaflet
- [ ] **Notifikasi** FCM (telat, reminder pulang)
- [ ] **Multi-office** — tiap user di-assign ke office tertentu
- [ ] **Pengaturan jam kerja** — kategori "tepat waktu" / "telat"
- [ ] **Wrap APK** dengan Capacitor

## Tips Debug

- **GPS error "Izin lokasi ditolak"**: cek site settings di browser, izinkan akses lokasi.
- **Login gagal "Email/NIP atau password salah"**: pastikan `npm run db:setup` sudah dijalankan.
- **DB error "Access denied"**: cek `DB_USER` / `DB_PASSWORD` di `.env`.
- **`@nuxtjs/tailwindcss` tidak load**: hapus `.nuxt/` dan jalankan ulang `npm run dev`.
