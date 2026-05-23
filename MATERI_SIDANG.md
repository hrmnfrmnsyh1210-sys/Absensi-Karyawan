# Materi Persiapan Sidang Skripsi — Aplikasi Absensi Karyawan ("Hadir")

Dokumen ini dirancang sebagai bahan belajar lengkap untuk sidang. Semua referensi
file mengarah ke kode aktual dalam proyek. Bukalah file yang disebut sambil
membaca penjelasannya agar Anda hafal alur dan letak kodenya.

---

## 1. Gambaran Umum Aplikasi

**Nama produk**: *Hadir — Absensi Karyawan*
**Klien / pengguna**: Telkom Akses (lihat branding di footer).
**Masalah yang diselesaikan**: pencatatan kehadiran karyawan secara digital
berbasis GPS untuk mencegah praktik *titip absen* yang umum terjadi pada absen
manual (paraf di kertas / fingerprint yang bisa diakali).

**Fitur utama (yang sudah berjalan)**
1. **Login JWT** dengan email atau NIP.
2. **Absen masuk & pulang** dengan validasi radius lokasi kantor (geofencing).
3. **Mode WFH global** — admin bisa mematikan pengecekan titik lokasi.
4. **Pengajuan cuti / sakit / izin** dengan lampiran PDF atau gambar.
5. **Kalender hari libur** (manual + sinkron otomatis dari Google Calendar
   tanggal merah Indonesia).
6. **Notifikasi**: in-app + Web Push ke HP (PWA).
7. **Manajemen pegawai** oleh admin.
8. **Rekap absensi** harian / periode + ekspor Excel & PDF.
9. **3-tier role**: `super_admin` > `admin` > `pegawai`.
10. **Activity log** (yang hanya bisa dilihat super admin).
11. **PWA installable** + siap di-wrap sebagai APK via **Capacitor**.

---

## 2. Stack Teknologi & Alasan Pemilihan

| Lapisan | Teknologi | Alasan |
|---|---|---|
| Framework full-stack | **Nuxt 3** (Vue 3 + Nitro server) | Satu codebase TypeScript untuk frontend (Vue SFC) dan backend (Nitro = server API). Tidak perlu memelihara dua repo. |
| Bahasa | **TypeScript** | Type safety mengurangi bug di endpoint dan type response. |
| Styling | **Tailwind CSS** | Utility-first, cepat membangun UI mobile-first tanpa ribut soal CSS class naming. |
| Database | **MySQL** (TiDB Cloud di produksi) | TiDB *wire-compatible* dengan MySQL, gratis tier (Serverless), bisa diakses dari Vercel tanpa IP whitelisting. Lokal pakai XAMPP/MySQL standar. |
| Driver DB | `mysql2/promise` | Driver paling matang untuk Node.js, support pooling & prepared statement (`?` placeholder anti-SQL injection). |
| Auth | `jsonwebtoken` + `bcryptjs` | JWT untuk stateless auth (cocok untuk PWA & APK karena tidak perlu session server). bcrypt untuk hashing password. |
| PWA | `@vite-pwa/nuxt` (workbox) | Auto-generate service worker, manifest, offline shell, install prompt. |
| Push notif | `web-push` (VAPID) | Standar W3C Web Push, jalan di Chrome/Android tanpa Firebase. |
| File upload | `h3.readMultipartFormData` | Built-in Nitro, tidak perlu library tambahan. |
| Export Excel | `exceljs` | Streaming workbook, ringan, support styling cell. |
| Export PDF | `pdfkit` | PDF generator vector, support tabel manual. |
| Wrapper mobile | `@capacitor/android` | Membungkus build statis Nuxt menjadi APK Android tanpa rewrite. |
| Deploy | **Vercel** (serverless) | Free tier, auto-deploy dari Git, sudah punya integrasi Nuxt 3. |
| Dev tunnel | `cloudflared` | Tunnel HTTPS untuk test dari HP (PWA & Geolocation API butuh HTTPS). |

**Alasan tidak pakai Laravel / Express / Supabase?**
- *Laravel*: harus dua bahasa (PHP backend + JS frontend), dua repo, dua
  deployment.
- *Express*: harus setup template, routing, build sendiri — Nuxt 3 sudah
  satu paket.
- *Supabase*: vendor lock-in lebih kuat (Postgres-only, auth & storage
  proprietary). MySQL/TiDB lebih netral dan lebih familiar untuk lingkungan
  korporat seperti Telkom.

---

## 3. Arsitektur Sistem (High-Level)

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT  (Browser PWA / Capacitor APK Android)                   │
│  ─ Vue 3 SFC di pages/                                           │
│  ─ Composables: useAuth, useApi, usePushNotifications            │
│  ─ Service Worker: cache shell + handler push notif              │
│  ─ Geolocation API (lat, lng, accuracy)                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │  HTTPS  +  Authorization: Bearer <JWT>
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  NITRO SERVER  (server/api/**.ts)                                │
│  ─ Middleware: requireAuth / requireAdmin / requireSuperAdmin    │
│  ─ Util: db.ts (pool), distance.ts (Haversine), workday.ts       │
│  ─ Plugin: migrate.ts (auto-migrate + bootstrap super admin)     │
└────────────┬────────────────────────┬────────────────────────────┘
             │                        │
             ▼                        ▼
┌──────────────────────┐   ┌────────────────────────────────────┐
│  TiDB Cloud (MySQL)  │   │  Eksternal                         │
│  ─ users             │   │  ─ Google Calendar ICS (holiday)   │
│  ─ offices           │   │  ─ Push Service (FCM / Mozilla)    │
│  ─ attendance        │   │     via VAPID                      │
│  ─ leaves            │   └────────────────────────────────────┘
│  ─ holidays          │
│  ─ app_settings      │
│  ─ activity_logs     │
│  ─ push_subscriptions│
│  ─ notifications     │
└──────────────────────┘
```

**Pola request umum (contoh absen masuk)**
1. User tap tombol *Clock In* di [pages/absen.vue](pages/absen.vue).
2. Browser memanggil `navigator.geolocation.getCurrentPosition()`.
3. Frontend POST ke `/api/attendance` dengan body `{ type, latitude, longitude }`
   dan header `Authorization: Bearer <jwt>` (di-inject otomatis oleh
   [composables/useApi.ts](composables/useApi.ts)).
4. Nitro handler [server/api/attendance/index.post.ts](server/api/attendance/index.post.ts)
   memverifikasi JWT, cek hari kerja, cek mode WFH, hitung jarak Haversine,
   validasi radius, insert ke tabel `attendance`.
5. Response sukses dikirim balik, frontend menampilkan halaman success.

---

## 4. Struktur Folder

```
absensi-karyawan/
├── app.vue                       # Root component
├── nuxt.config.ts                # Konfigurasi Nuxt: modules, PWA, runtimeConfig
├── capacitor.config.ts           # Konfigurasi Capacitor (appId, webDir)
├── tailwind.config.ts            # Custom warna brand "hadir-teal" dll
├── package.json                  # Dependensi & script
│
├── assets/css/main.css           # Entry Tailwind
├── components/
│   └── InstallPrompt.vue         # Tombol "Pasang sebagai aplikasi"
├── composables/
│   ├── useAuth.ts                # Login, logout, token cookie
│   ├── useApi.ts                 # $fetch wrapper dgn auth header otomatis
│   ├── useSettings.ts            # Cache pengaturan global (jam kerja, dll)
│   ├── usePushNotifications.ts   # Subscribe / unsubscribe Web Push
│   └── useInstallPrompt.ts       # State install PWA
├── layouts/
│   └── default.vue               # Bottom nav untuk pegawai
├── middleware/
│   └── auth.global.ts            # Redirect ke /login & guard role
├── pages/
│   ├── login.vue                 # Form login
│   ├── index.vue                 # Dashboard hari ini
│   ├── absen.vue                 # Halaman absen (GPS)
│   ├── riwayat.vue               # Riwayat absensi pegawai
│   ├── izin.vue                  # Form pengajuan cuti/sakit/izin
│   ├── saya.vue                  # Profile + rekap pribadi
│   ├── notifikasi.vue            # Daftar notifikasi
│   └── admin/                    # Panel admin
│       ├── index.vue             # Dashboard admin
│       ├── harian.vue            # Rekap harian
│       ├── rekap.vue             # Rekap periode + export
│       ├── pegawai.vue           # CRUD pegawai
│       ├── izin.vue              # Approve/reject pengajuan
│       ├── libur.vue             # Manajemen hari libur
│       ├── pengaturan.vue        # Setting jam kerja, WFH switch
│       └── log.vue               # Activity log (super admin)
├── public/
│   ├── icon.png                  # Icon PWA
│   └── push-sw.js                # Handler push utk service worker
├── db/schema.sql                 # DDL semua tabel
├── scripts/setup-db.mjs          # Migrasi + seed (lokal)
└── server/
    ├── plugins/
    │   └── migrate.ts            # Auto-migrate setiap cold start
    ├── utils/
    │   ├── db.ts                 # Pool mysql2
    │   ├── auth.ts               # JWT, bcrypt, requireAuth/Admin/SuperAdmin
    │   ├── distance.ts           # Haversine
    │   ├── workday.ts            # Validasi hari kerja
    │   ├── settings.ts           # Reader app_settings
    │   ├── holidaySync.ts        # Parser ICS Google Calendar
    │   ├── push.ts               # Kirim Web Push via web-push
    │   ├── notify.ts             # Wrapper: insert notif + push
    │   ├── activityLog.ts        # Logger aksi admin
    │   └── uploads.ts            # Validasi & simpan lampiran
    └── api/
        ├── auth/login.post.ts
        ├── me.get.ts             # Info user dari token
        ├── office.get.ts
        ├── settings.get.ts
        ├── attendance/
        │   ├── index.post.ts     # POST absen
        │   ├── today.get.ts      # Status hari ini
        │   └── history.get.ts    # Riwayat user
        ├── leaves/
        │   ├── index.post.ts     # Submit pengajuan
        │   ├── mine.get.ts       # Daftar pengajuan saya
        │   └── attachment/[id].get.ts
        ├── holidays/index.get.ts
        ├── notifications/
        │   ├── index.get.ts
        │   ├── unread-count.get.ts
        │   ├── read-all.put.ts
        │   └── [id]/...
        ├── push/
        │   ├── subscribe.post.ts
        │   └── unsubscribe.post.ts
        └── admin/
            ├── daily.get.ts          # Rekap harian (semua pegawai)
            ├── stats.get.ts          # Statistik dashboard
            ├── office.put.ts         # Update koordinat & radius kantor
            ├── settings.put.ts       # Update jam kerja / WFH switch
            ├── pegawai/
            │   ├── index.get.ts
            │   ├── index.post.ts
            │   ├── [id].put.ts
            │   └── [id].delete.ts
            ├── leaves/
            │   ├── index.get.ts
            │   └── [id].put.ts       # Approve / reject
            ├── holidays/
            │   ├── index.get.ts
            │   ├── index.post.ts
            │   ├── [id].put.ts
            │   ├── [id].delete.ts
            │   └── sync.post.ts      # Trigger manual ICS sync
            ├── logs/index.get.ts     # Activity log
            └── rekap/
                ├── index.get.ts
                ├── export.get.ts     # Excel
                └── export-pdf.get.ts # PDF
```

---

## 5. Database Schema & Relasi

File DDL: [db/schema.sql](db/schema.sql).

### 5.1 Tabel & relasi

```
users (id) ───┬──< attendance (user_id)
              ├──< leaves (user_id)            leaves.reviewed_by ──> users.id
              ├──< notifications (user_id)
              ├──< push_subscriptions (user_id)
              ├──< activity_logs (actor_id)
              └──< holidays.created_by

offices (id) ──< attendance (office_id)
```

### 5.2 Penjelasan tiap tabel

| Tabel | Fungsi | Kolom kunci |
|---|---|---|
| `users` | Akun pegawai/admin/super admin | `nip` unik, `email` unik, `password_hash` (bcrypt), `role` enum 3 nilai, `jabatan`, `tanggal_lahir` |
| `offices` | Titik kantor & radius geofence | `latitude DECIMAL(10,7)`, `longitude DECIMAL(10,7)`, `radius_m INT` |
| `attendance` | Catatan absen | `type` (`check_in`/`check_out`), `status` (`valid`/`out_of_range`/`wfh`), `distance_m`, `latitude`, `longitude`, `user_agent`, `ip_address`, `recorded_at` |
| `app_settings` | Key-value setting global | `setting_key` PK, `setting_value` string; dipakai utk `work_start_time`, `work_end_time`, `work_days`, `annual_leave_quota`, `location_check_enabled` |
| `leaves` | Pengajuan cuti/sakit/izin | `type` enum, `date_from`/`date_to`, `reason`, `attachment_*`, `status` (`pending`/`approved`/`rejected`), `reviewed_by`, `reviewed_at`, `review_note` |
| `holidays` | Tanggal merah & cuti bersama | `date_from`/`date_to`, `source` enum (`manual`/`national`), `created_by` |
| `activity_logs` | Audit aksi admin/super admin | `actor_*`, `action`, `entity`, `entity_id`, `summary`, `ip_address` |
| `push_subscriptions` | Endpoint Web Push per device per user | `endpoint` unik, `p256dh`, `auth_key` |
| `notifications` | Notif in-app | `type`, `title`, `body`, `ref_type`/`ref_id`, `is_read` |

### 5.3 Catatan desain

- **Foreign key `ON DELETE CASCADE`** pada `attendance.user_id` &
  `leaves.user_id` → kalau user dihapus, riwayat ikut hilang (sesuai
  kebijakan privasi).
- **`ON DELETE SET NULL`** pada `leaves.reviewed_by` / `holidays.created_by`
  → data riwayat tetap, hanya kehilangan referensi reviewer.
- **Index `(user_id, recorded_at)`** di `attendance` untuk query riwayat per
  user yang umum.
- **`DECIMAL(10,7)` untuk koordinat** memberi presisi ~1 cm (cukup untuk
  geofence radius 50 m).
- **`ENUM`** untuk `role`, `type`, `status` membatasi nilai di level DB
  (defensif sebelum kode).

---

## 6. Auth: JWT + bcrypt + Role-Based Access Control

File: [server/utils/auth.ts](server/utils/auth.ts),
[server/api/auth/login.post.ts](server/api/auth/login.post.ts),
[composables/useAuth.ts](composables/useAuth.ts),
[middleware/auth.global.ts](middleware/auth.global.ts).

### 6.1 Alur login

```
[ pages/login.vue ]
     │
     │ POST /api/auth/login  { identifier, password }
     ▼
[ server/api/auth/login.post.ts ]
     │ 1. Cari user by email OR nip
     │ 2. bcrypt.compare(password, password_hash)
     │ 3. signToken({ sub, nip, role }) → JWT (12 jam)
     ▼
   Response: { token, user }
     │
     ▼
[ composables/useAuth.ts ]
     │ Simpan token ke useCookie('auth_token', maxAge 12h, sameSite lax)
     ▼
[ composables/useApi.ts ]
     │ Setiap request berikutnya: inject header Authorization: Bearer <token>
```

### 6.2 Verifikasi JWT (server-side)

[server/utils/auth.ts](server/utils/auth.ts) menyediakan 3 guard:

| Function | Boleh diakses oleh |
|---|---|
| `requireAuth(event)` | Semua role yang token-nya valid |
| `requireAdmin(event)` | `admin` + `super_admin` |
| `requireSuperAdmin(event)` | hanya `super_admin` |

Implementasinya membaca header `Authorization`, `jwt.verify` dengan
`runtimeConfig.jwtSecret`, lalu cek field `role`. Kalau gagal → throw
`createError({ statusCode: 401/403, ... })` → Nitro mengubahnya jadi response
HTTP standar.

### 6.3 Frontend guard

[middleware/auth.global.ts](middleware/auth.global.ts) — middleware Nuxt yang
jalan **sebelum setiap navigasi route**:
- Tanpa token → redirect ke `/login`.
- Belum punya `user` state → panggil `/api/me` untuk hydrate.
- Akses `/admin/*` oleh role `pegawai` → redirect ke `/`.
- Akses `/admin/log` oleh non-super-admin → redirect ke `/admin`.

### 6.4 Hashing password

[server/utils/auth.ts:13-19](server/utils/auth.ts#L13-L19):
```ts
export function hashPassword(plain: string) { return bcrypt.hash(plain, 10) }
export function verifyPassword(plain: string, hash: string) { return bcrypt.compare(plain, hash) }
```
**Cost factor 10** = 2^10 iterasi (~100 ms di laptop modern). Cukup
untuk menahan brute force tetapi tidak terlalu lambat untuk login.

### 6.5 Mengapa JWT, bukan session?

- Stateless → tidak butuh tabel session di DB; cocok untuk serverless (Vercel
  cold-start) dan APK Capacitor (tidak ada cookie cross-domain).
- 1 token = klaim sudah berisi `sub`, `nip`, `role` → tidak perlu round-trip
  ke DB untuk authorize tiap request.
- Trade-off: token tidak bisa di-revoke instan (harus tunggu expiry). Untuk
  kebutuhan absensi karyawan, expiry 12 jam dianggap cukup.

---

## 7. Fitur Inti: Validasi Absensi GPS

### 7.1 Rumus Haversine (jarak antara 2 titik koordinat)

File: [server/utils/distance.ts](server/utils/distance.ts).

```ts
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000                          // jari-jari bumi dalam meter
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
          * Math.sin(dLng/2)**2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}
```

**Mengapa Haversine, bukan Euclidean / Vincenty?**
- Euclidean salah untuk koordinat geografis karena bumi bulat — 1° latitude
  ≠ 1° longitude.
- Vincenty lebih akurat (memperhitungkan bumi sebagai ellipsoid) tapi lebih
  mahal komputasinya dan overkill untuk radius 50-200 meter.
- Haversine: akurasi sub-meter untuk jarak < 1 km, satu fungsi 5 baris.

### 7.2 Alur POST absen

File: [server/api/attendance/index.post.ts](server/api/attendance/index.post.ts).

Urutan validasi (penting untuk ditiru saat ditanya):
1. `requireAuth(event)` — JWT valid?
2. Validasi `type` ∈ {`check_in`, `check_out`}.
3. `assertWorkingDay()` — hari ini termasuk hari kerja (lihat
   [server/utils/workday.ts](server/utils/workday.ts))? Kalau bukan, 422.
4. `getAppSettings()` — cek apakah `location_check_enabled === false` (mode
   WFH global).
5. Ambil baris pertama dari `offices` (sistem ini single-office MVP).
6. Validasi koordinat kalau diperlukan: harus angka, `|lat| ≤ 90`,
   `|lng| ≤ 180`.
7. Hitung `distance = haversineMeters(...)`.
8. **Mode normal**: tolak kalau `distance > office.radius_m` → 422 dengan
   pesan jarak.
9. **Mode WFH**: skip cek radius, set `status = 'wfh'`.
10. Cek duplikat: sudah pernah `type` ini di tanggal yg sama? → 409.
11. Untuk `check_out`: harus ada `check_in` di hari sama dulu → 409.
12. INSERT ke `attendance` dengan `user_agent` & `ip_address` (untuk audit).

### 7.3 Mengapa validasi di server, bukan client?

**Ini pertanyaan klasik sidang.** Jawaban:
- JavaScript di browser bisa diutak-atik oleh user (DevTools, modifikasi
  request payload, replay request).
- Kalau validasi cuma di client, user nakal bisa kirim koordinat palsu
  langsung ke endpoint.
- Server adalah satu-satunya tempat yang trustworthy. Frontend tetap
  validasi sebagai UX (kasih tahu user kalau di luar radius **sebelum**
  klik submit), tapi server selalu re-validate.
- Sama prinsipnya dengan: "jangan pernah trust data dari client".

### 7.4 Cara dapat lat/lng di browser

[pages/absen.vue](pages/absen.vue) memakai `navigator.geolocation.getCurrentPosition`
dengan opsi:
```js
{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
```
- `enableHighAccuracy: true` — minta browser pakai GPS chip kalau ada (bukan
  cuma WiFi triangulation).
- `timeout: 15000` — beri waktu 15 detik (GPS cold-start di indoor bisa lama).
- `maximumAge: 0` — selalu minta posisi baru, jangan cache.

Catatan: Geolocation API **hanya jalan di HTTPS atau localhost** (security
requirement W3C). Itulah kenapa di README disuruh pakai `cloudflared` tunnel
saat test dari HP di LAN.

### 7.5 Mode WFH global (toggle admin)

- Setting `location_check_enabled` disimpan di `app_settings` sebagai `'1'`
  atau `'0'`.
- Admin mengubahnya di `/admin/pengaturan` via `PUT /api/admin/settings`.
- Saat mode off, semua pegawai bisa absen dari mana saja, status di-flag
  `'wfh'` sehingga di rekap bisa dibedakan dari `'valid'` (di kantor).
- **Catatan sejarah**: awalnya didesain per-pegawai (kolom `users.wfh`),
  tapi user minta diubah ke satu saklar global → kolom lama otomatis di-drop
  oleh [server/plugins/migrate.ts](server/plugins/migrate.ts#L130-L138).

---

## 8. Pengajuan Cuti / Sakit / Izin + Lampiran

### 8.1 Submit pengajuan

File: [server/api/leaves/index.post.ts](server/api/leaves/index.post.ts).

Endpoint menerima **dua tipe body**:
- `application/json` — pengajuan tanpa lampiran.
- `multipart/form-data` — pengajuan dengan file (PDF/gambar surat dokter).

Validasi multipart pakai `readMultipartFormData(event)` (utility dari `h3`).
Field `type`, `date_from`, `date_to`, `reason`, dan opsional `file`
diparsing manual.

Validasi:
- `type` ∈ `izin | sakit | cuti`.
- Tanggal pakai regex `YYYY-MM-DD`.
- `date_to >= date_from`.
- `reason` minimal 5 karakter.

### 8.2 Penyimpanan lampiran

File: [server/utils/uploads.ts](server/utils/uploads.ts).
- Hanya MIME yang ada di `ALLOWED_ATTACHMENT_TYPES` yang diterima (PNG, JPG,
  GIF, WebP, HEIC, PDF).
- Maksimum 5 MB.
- Disimpan di folder `uploads/leaves/` di luar Git. Nama file: `<timestamp>-<random hex>.<ext>` (tidak pakai nama asli untuk cegah path traversal).
- Path relatif (`leaves/<file>`) disimpan ke `leaves.attachment_path`.
- File diakses via `GET /api/leaves/attachment/[id]` yang memvalidasi
  ownership (pegawai cuma bisa download miliknya, admin bisa semua).

### 8.3 Approve / reject

File: [server/api/admin/leaves/[id].put.ts](server/api/admin/leaves/[id].put.ts).

Flow:
1. `requireAdmin` — admin/super admin saja.
2. Cek pengajuan exist & masih `pending` (tidak bisa ubah yang sudah
   approved/rejected — idempoten).
3. UPDATE status, set `reviewed_by`, `reviewed_at`, `review_note`.
4. Kirim notifikasi via `createNotification()` (insert ke `notifications`
   table **dan** push ke HP user).
5. `recordActivity()` — catat di `activity_logs`.

### 8.4 Pengaruh ke rekap

[server/api/admin/daily.get.ts](server/api/admin/daily.get.ts) menggabungkan
3 sumber data per tanggal:
- `attendance` → kalau ada `check_in` → status `hadir`.
- `leaves` (status `approved`, tanggal mencakup hari ini) → status sesuai
  tipe (`cuti`/`sakit`/`izin`).
- `holidays` (tanggal mencakup hari ini) → status `libur`.
- Sisanya → `belum`.

---

## 9. Sinkronisasi Hari Libur Nasional (Google Calendar ICS)

File: [server/utils/holidaySync.ts](server/utils/holidaySync.ts).

### 9.1 Latar belakang

Awalnya direncanakan pakai API JSON (`dayoffapi.vercel.app`,
`api-harilibur.vercel.app`). Per Mei 2026 dua-duanya mati (response
"DEPLOYMENT_DISABLED" dari Vercel). Akhirnya pakai feed **ICS publik dari
Google Calendar** yang lebih stabil:

```
https://calendar.google.com/calendar/ical/
  id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics
```

### 9.2 Parsing ICS

ICS adalah format text plain berbentuk `KEY:VALUE` per baris, dengan blok
`BEGIN:VEVENT` … `END:VEVENT`. Fungsi `parseNationalHolidays`:
1. **Unfold** baris kontinuasi (baris yang mulai dengan space = sambungan
   baris sebelumnya).
2. Loop tiap line, kumpulkan key-value tiap `VEVENT`.
3. Filter: hanya event dengan `DESCRIPTION` yang diawali `"Hari libur
   nasional"` (mencakup tanggal merah & cuti bersama; mengecualikan
   "Perayaan" seperti malam Tahun Baru atau 1 Ramadan yang bukan libur
   formal).
4. Konversi `DTSTART` (format `YYYYMMDD`) ke `YYYY-MM-DD`.
5. `DTEND` di ICS bersifat **exclusive** → tanggal terakhir sebenarnya =
   `DTEND - 1` hari.

### 9.3 Sync ke DB

`syncNationalHolidays(year)`:
1. Fetch ICS dengan timeout 15 detik.
2. Parse → list `{ name, date_from, date_to }`.
3. **Dalam satu transaksi**: DELETE semua `source='national'` di tahun
   tersebut, lalu INSERT ulang. Idempoten — bisa dijalankan berkali-kali
   tanpa duplikat.

### 9.4 Pemicu sync

- **Otomatis** saat cold start: [server/plugins/migrate.ts](server/plugins/migrate.ts#L171)
  memanggil `ensureCurrentYearSynced()`. Self-guarded (`currentYearSyncPromise`)
  agar hanya jalan sekali per cold start.
- **Manual** oleh admin via tombol di `/admin/libur` →
  `POST /api/admin/holidays/sync`.

### 9.5 Penggunaan di logika absensi

[server/utils/workday.ts](server/utils/workday.ts) **TIDAK** memblokir absen
di hari libur — karyawan tetap boleh absen di tanggal merah (untuk lembur).
Yang diblokir hanya hari di luar `work_days` (mis. Sabtu/Minggu kalau
defaultnya 1-5).

Hari libur dipakai oleh logika rekap (`server/api/admin/daily.get.ts`) untuk
**tidak menghitung absen sebagai "alpa"** di tanggal merah.

---

## 10. Notifikasi (In-App + Web Push)

### 10.1 Konsep dua jalur

```
Aksi (mis. approve cuti)
        │
        ▼
createNotification(userId, {...})    ← server/utils/notify.ts
        │
        ├──► INSERT notifications        (in-app, dibaca dari /notifikasi)
        │
        └──► sendPushToUser(userId, ...) ← server/utils/push.ts
                 │
                 ▼
            web-push library
                 │
                 ▼
            Push Service browser (FCM utk Chrome, Mozilla utk Firefox)
                 │
                 ▼
            Service Worker user → showNotification()
```

### 10.2 VAPID — kenapa perlu?

**VAPID** (Voluntary Application Server Identification) = standar yang
memungkinkan push service browser mempercayai server Anda **tanpa
mendaftar dulu di vendor** (seperti yang dulu wajib di GCM/FCM legacy).

Tiga kunci dipakai:
- `VAPID_PUBLIC_KEY` (public, dipakai browser saat `subscribe`)
- `VAPID_PRIVATE_KEY` (rahasia, dipakai server saat `sendNotification`)
- `VAPID_SUBJECT` (mailto, identitas pengirim)

Pasangan kunci di-generate sekali: `npx web-push generate-vapid-keys`.

### 10.3 Subscribe (browser → DB)

File: [composables/usePushNotifications.ts](composables/usePushNotifications.ts).
1. Cek dukungan: `serviceWorker`, `PushManager`, `Notification` ada di
   `window`.
2. Minta izin: `Notification.requestPermission()`.
3. `registration.pushManager.subscribe({ userVisibleOnly: true,
   applicationServerKey: <vapid public key> })`.
4. Kirim hasilnya (`endpoint`, `keys.p256dh`, `keys.auth`) ke
   `POST /api/push/subscribe` → INSERT ke `push_subscriptions`.

### 10.4 Kirim push (server)

File: [server/utils/push.ts](server/utils/push.ts).
- Set VAPID details sekali per cold start.
- Loop semua subscription milik user → `webpush.sendNotification(...)`.
- Handle error: status 404 / 410 → subscription kadaluarsa → auto-DELETE
  dari DB.
- **Best-effort**: error push tidak melempar exception ke caller (kalau push
  gagal, in-app notif tetap tersimpan).

### 10.5 Service Worker handler

File: [public/push-sw.js](public/push-sw.js).
- Listener `push` event → parse JSON payload → `showNotification(title,
  options)`.
- Listener `notificationclick` → buka tab yang sudah ada (kalau ada) atau
  buka tab baru ke URL target.

File ini di-`importScripts` ke service worker bawaan Workbox via
[nuxt.config.ts](nuxt.config.ts#L67).

### 10.6 Caveat iOS

iOS hanya mendukung Web Push **kalau PWA sudah di-install ke home screen**
(iOS 16.4+). Di Chrome Android jalan normal sebagai browser tab.

---

## 11. PWA (Progressive Web App)

Konfigurasi: [nuxt.config.ts](nuxt.config.ts#L44-L91), modul
`@vite-pwa/nuxt`.

### 11.1 Yang otomatis disediakan

- **`manifest.webmanifest`** — metadata aplikasi (nama, icon, theme color,
  display `standalone` → tanpa address bar).
- **Service worker** (di-generate Workbox) — caching shell + runtime
  caching strategy:
  - `/api/*` → **NetworkOnly** (data live, jangan cache).
  - `request.destination === 'image'` → **CacheFirst** (icon, foto profil)
    dengan expiration 30 hari.
- **Auto-update**: `registerType: 'autoUpdate'` → SW versi baru langsung
  dipakai saat tab di-reload.
- **Install prompt**: handled di [components/InstallPrompt.vue](components/InstallPrompt.vue)
  via event `beforeinstallprompt`.

### 11.2 Mengapa PWA dulu, baru APK?

- Iterasi cepat: ubah kode → push → user langsung lihat tanpa re-install.
- Bisa diakses dari browser apa saja, tidak perlu publish Play Store.
- Cukup untuk 80% kebutuhan (GPS, kamera via `getUserMedia`, notifikasi).
- **Kekurangan**: tidak bisa deteksi Mock GPS (Fake GPS app), tidak bisa
  akses Android ID untuk device binding → di-roadmap saat migrasi ke APK
  native.

---

## 12. Capacitor (Wrapping ke APK Android)

Konfigurasi: [capacitor.config.ts](capacitor.config.ts).

### 12.1 Cara kerja

Capacitor membungkus build statis Nuxt (`nuxi generate` → `.output/public`)
sebagai aset di dalam APK, dijalankan di WebView. JS yang sama persis,
ditambah jembatan ke API native via plugin (camera, geolocation, device, dst).

### 12.2 Setting penting

- `webDir: '.output/public'` — Capacitor cari index.html di sini.
- `allowMixedContent: true` — wajib kalau API masih di HTTP (LAN dev). Production
  WAJIB HTTPS.
- `appId: 'id.absensi.karyawan'` — package name Android (mirip Java package).

### 12.3 Build APK (alur singkat)

```bash
# 1. Build static SPA, point API ke server (LAN atau prod)
NUXT_PUBLIC_API_BASE=http://192.168.1.10:3000 npm run build:capacitor

# 2. (Sekali saja) Tambah platform android
npm run cap:add-android

# 3. Sync hasil build ke folder android/
npm run cap:sync

# 4. Buka di Android Studio → Build → Build APK
npm run cap:open
```

Lihat README untuk detail lengkap setup Android Studio.

### 12.4 Roadmap native plugin (belum)

- `@capacitor/geolocation` — GPS native lebih akurat & cepat.
- `@capacitor/camera` — selfie wajib saat absen.
- `@capacitor/device` — device UUID untuk binding 1 akun = 1 HP.
- Custom Kotlin plugin → deteksi Mock Location & root.

---

## 13. Auto-Migration & Bootstrap Super Admin

File: [server/plugins/migrate.ts](server/plugins/migrate.ts).

### 13.1 Mengapa auto-migrate?

Di **Vercel** (deploy via push ke Git) tidak ada shell untuk jalan
`mysql -e "CREATE TABLE ..."`. Solusinya: **Nitro plugin** yang di-hook
ke event `request` pertama setelah cold start → jalan migrasi idempoten.

### 13.2 Strategi

1. `CREATE TABLE IF NOT EXISTS` untuk tabel baru.
2. `ALTER TABLE ADD COLUMN/INDEX` di-wrap try-catch — ignore error code
   `ER_DUP_FIELDNAME` (1060) dan `ER_DUP_KEYNAME` (1061), karena artinya
   migrasi tersebut sudah pernah diterapkan.
3. **Perubahan ENUM** (penambahan nilai): cek dulu via `information_schema.COLUMNS`
   apakah nilai baru sudah ada, baru `MODIFY COLUMN`. Catatan TiDB: nilai
   enum baru harus ditambahkan **di akhir** daftar.
4. **Bootstrap super admin**: kalau tidak ada satu pun `role='super_admin'`,
   promote admin tertua → super admin (`UPDATE … ORDER BY id ASC LIMIT 1`).
5. **Sekali per cold start**: variabel `migrationPromise` mengingat hasil,
   re-throw kalau gagal supaya retry di request berikutnya.

### 13.3 Kelebihan & risiko

| Kelebihan | Risiko / Mitigasi |
|---|---|
| Tidak perlu deployment step manual. | Migrasi salah bisa korup data → uji dulu di lokal. |
| Aman untuk multi-instance (idempoten). | Race condition antar request awal cold start → `migrationPromise` di-memoize per process. |
| Versi DB selalu sync dengan kode. | Migrasi besar bisa memperlambat cold start → keep migrasi ringan. |

---

## 14. Activity Log (Audit Trail untuk Super Admin)

File: [server/utils/activityLog.ts](server/utils/activityLog.ts).

Setiap aksi sensitif admin (approve cuti, buat pegawai, ubah setting, sync
holiday, dst) memanggil `recordActivity(event, auth, { action, entity, entityId, summary })`.

Yang dicatat: siapa (`actor_id`, `actor_name`, `actor_role`), apa (`action`,
`entity`, `entity_id`), ringkasan teks, IP. Pencatatan **best-effort** — kalau
INSERT log gagal, request utama tetap sukses.

Super admin baca di `/admin/log` via `GET /api/admin/logs` (paginated).

---

## 15. Strategi Anti-Cheat (Yang Sudah & Yang Direncanakan)

| Risiko | Status sekarang | Solusi lanjutan |
|---|---|---|
| GPS dipalsukan via Fake GPS app | Tidak bisa dideteksi di PWA | Capacitor + `isMockLocation()` di plugin native |
| Titip absen (HP teman) | Mitigasi: log `user_agent`+`ip_address` | Device binding (Android ID), selfie wajib |
| Replay request via cURL/Postman | Cek duplikat per hari + validasi koordinat | Sama, plus signing payload + rate limit |
| User di luar radius mengaku di dalam | Server hitung Haversine, tolak 422 | — sudah aman |
| Token JWT dicuri | Expiry 12 jam, `sameSite=lax` | Refresh token + device binding |
| Mengubah jam HP | Server pakai `CURDATE()` MySQL (server time), bukan client | — sudah aman |

---

## 16. Integrasi Eksternal — Ringkas

| Sistem | Fungsi | Cara integrasi | File terkait |
|---|---|---|---|
| **TiDB Cloud** | Database produksi | mysql2 pool dengan SSL (`DB_SSL=true`), connection limit 3 (TiDB free tier) | [server/utils/db.ts](server/utils/db.ts) |
| **Vercel** | Hosting Nuxt + Nitro | Auto-deploy dari Git, env var via dashboard. Nitro plugin migrate.ts jalan di cold start. | [nuxt.config.ts](nuxt.config.ts) |
| **Google Calendar** | Sumber tanggal merah Indonesia | Fetch ICS publik via `$fetch`, parse manual, sinkron 1x/cold-start | [server/utils/holidaySync.ts](server/utils/holidaySync.ts) |
| **Web Push (VAPID)** | Notifikasi HP via service worker | `web-push` library, kirim ke endpoint `fcm.googleapis.com` (Chrome) atau Mozilla (Firefox) | [server/utils/push.ts](server/utils/push.ts), [public/push-sw.js](public/push-sw.js) |
| **Cloudflare Tunnel** | Dev HTTPS tunnel utk test PWA di HP | Script `dev:tunnel` via `cloudflared` | [package.json](package.json#L9) |
| **Capacitor** | Wrapper APK Android | Bundle build statis ke WebView Android | [capacitor.config.ts](capacitor.config.ts) |

---

## 17. Environment Variables

File `.env` di root. Yang dibaca via [nuxt.config.ts](nuxt.config.ts#L6-L25):

| Variable | Keterangan |
|---|---|
| `JWT_SECRET` | Kunci tanda tangan JWT. WAJIB diganti acak di produksi. |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Koneksi MySQL/TiDB |
| `DB_SSL` | `true` untuk TiDB Cloud, `false` untuk lokal |
| `VAPID_PUBLIC_KEY` | Public key Web Push (boleh di-expose ke client) |
| `VAPID_PRIVATE_KEY` | Private key Web Push (RAHASIA, server only) |
| `VAPID_SUBJECT` | `mailto:admin@example.com` |
| `NUXT_PUBLIC_API_BASE` | Base URL API untuk Capacitor APK (kosong untuk web) |

`runtimeConfig.public.*` boleh dibaca client. Sisanya server-only.

---

## 18. Daftar Kemungkinan Pertanyaan Sidang + Jawaban Cepat

> **Tip menjawab**: setiap kali bisa, sebutkan file atau pola yang Anda
> pakai. Penguji terkesan kalau Anda hapal letak kodenya.

### A. Konseptual

**Q1. Kenapa pilih Nuxt 3, bukan Laravel atau MERN?**
A. Karena ingin satu codebase TypeScript end-to-end. Nuxt 3 punya Nitro
sebagai server API built-in, jadi tidak perlu maintain dua repo seperti
Laravel + Vue terpisah. Deployment juga lebih sederhana — satu build, satu
host (Vercel). Untuk skala MVP ini, single-process Node lebih ringan dari
PHP-FPM + Apache.

**Q2. Apa beda PWA dan APK native?**
A. PWA jalan di browser sebagai service worker + manifest, bisa di-install
ke home screen, tapi tidak punya akses penuh ke API native (Android ID,
deteksi Mock GPS). APK native (via Capacitor) membungkus PWA ke WebView dan
membuka akses ke plugin native (kamera, GPS akurat, device UUID). Strategi
kami: PWA dulu untuk iterasi cepat, APK saat butuh anti-cheat ketat.

**Q3. Kenapa pakai JWT, bukan session cookie biasa?**
A. JWT stateless — tidak butuh tabel session, cocok untuk Vercel serverless
yang multi-instance. Sekaligus future-proof untuk APK Capacitor yang tidak
share cookie domain. Trade-off: tidak bisa revoke instan; mitigasi: expiry
12 jam.

**Q4. Bagaimana cara cegah titip absen?**
A. Ada beberapa lapis: (1) server-side validasi Haversine — koordinat
GPS dihitung di server, tidak bisa dimanipulasi client. (2) log IP & user
agent — pola absen 5 user dari 1 IP mencurigakan. (3) Roadmap: selfie wajib
+ device binding via Android ID + deteksi Mock GPS (perlu Capacitor native).

**Q5. Kenapa MySQL/TiDB, bukan PostgreSQL atau MongoDB?**
A. (a) Data absensi sangat relasional (user-attendance-office), SQL paling
cocok. (b) TiDB Cloud punya free tier dan wire-protocol MySQL → bisa pakai
driver mysql2 standar, deploy gratis di Vercel tanpa setup VPS. (c) MongoDB
tidak punya FK & transaksi yang sama mature-nya — riskan untuk data
audit-like seperti absensi.

### B. Implementasi

**Q6. Jelaskan rumus Haversine.**
A. Rumus untuk menghitung jarak terdekat antara dua titik pada permukaan
bola (great-circle distance). Input: dua pasang (lat, lng). Konversi ke
radian, hitung selisih, masukkan ke `2R × asin(√(sin²(Δlat/2) +
cos(lat1)·cos(lat2)·sin²(Δlng/2)))` dengan R = jari-jari bumi (6.371.000 m).
Akurasi sub-meter untuk jarak < 1 km. Kode di
[server/utils/distance.ts](server/utils/distance.ts).

**Q7. Bagaimana password disimpan?**
A. Pakai bcrypt dengan cost factor 10. Plain password user dikirim via HTTPS,
di server di-hash via `bcrypt.hash(plain, 10)`, disimpan di kolom
`users.password_hash`. Saat login pakai `bcrypt.compare`. bcrypt punya salt
otomatis di output, jadi hash sama untuk dua user dengan password sama akan
berbeda.

**Q8. Bagaimana mencegah SQL injection?**
A. Selalu pakai **prepared statement** dengan `?` placeholder yang
disediakan mysql2: `db.query('SELECT … WHERE email = ?', [identifier])`.
Library yang escape value, bukan string concat. Tidak pernah `${variable}`
di SQL.

**Q9. Bagaimana auto-migrasi jalan di Vercel?**
A. Pakai Nitro plugin di [server/plugins/migrate.ts](server/plugins/migrate.ts).
Hook `request` event → cek `migrationPromise`. Kalau belum jalan, eksekusi
semua `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` (try-catch untuk error
"sudah ada"). Idempoten, aman dijalankan tiap cold start.

**Q10. Mengapa hari libur tidak memblokir absen?**
A. Karena ada skenario lembur di tanggal merah. Hari libur hanya dipakai di
logika rekap supaya tidak menghitung absen sebagai "alpa". Yang memblokir
absen hanya hari di luar `work_days` (lihat
[server/utils/workday.ts](server/utils/workday.ts)).

**Q11. Bagaimana Web Push bekerja teknisnya?**
A. (1) Browser subscribe ke push service-nya (Chrome → FCM, Firefox →
Mozilla autopush) dengan VAPID public key → dapat endpoint URL. (2)
Endpoint+keys disimpan ke DB kami. (3) Saat ada notif, server `web-push`
library membentuk payload terenkripsi dengan VAPID private key, POST ke
endpoint. (4) Push service mengirim ke device, service worker bangun,
`showNotification()`. Tanpa Firebase Console karena VAPID = standar W3C.

**Q12. Bagaimana mengelola token JWT di frontend?**
A. Disimpan di `useCookie('auth_token', { maxAge: 12h, sameSite: 'lax' })`.
Cookie aman di-share antar SSR & client di Nuxt. `composables/useApi.ts`
auto-inject `Authorization: Bearer <token>` di tiap request. Kalau response
401 → auto-logout.

**Q13. Bagaimana frontend tahu user mana yang login?**
A. Setelah login, response berisi `{ token, user }`. Token disimpan di
cookie, user disimpan di `useState('auth_user')` (state Nuxt yang
shared per-request di SSR dan reactive di client). Saat reload, middleware
auth panggil `/api/me` untuk re-hydrate user dari token.

**Q14. Apa fungsi `app_settings` table?**
A. Key-value store untuk konfigurasi yang bisa diubah admin tanpa redeploy:
jam masuk/pulang, hari kerja, kuota cuti tahunan, dan switch WFH global.
Lebih simpel dari bikin tabel kolom-spesifik karena setting bisa tambah ke
depannya. Reader di [server/utils/settings.ts](server/utils/settings.ts) yang
membaca semua key & cast ke type yang benar.

**Q15. Bagaimana validasi file upload (lampiran cuti) aman?**
A. (1) Whitelist MIME type — hanya PNG/JPG/GIF/WebP/HEIC/PDF. (2) Maksimum 5
MB. (3) Nama file di-rewrite jadi `<timestamp>-<randomHex>.<ext>` agar tidak
ada path traversal atau collision. (4) Disimpan di folder `uploads/` di luar
public, hanya bisa diakses via endpoint yang cek ownership.

### C. Arsitektur & Trade-off

**Q16. Kenapa server-side migration berbahaya? Bagaimana mengamankannya?**
A. Risiko: bila migrasi salah (DROP COLUMN salah nama, dll) bisa korup data
di produksi tiap cold start. Mitigasi: (1) hanya `CREATE TABLE IF NOT EXISTS`
+ `ALTER ADD COLUMN/INDEX` yang dilakukan otomatis. (2) DROP & rewrite besar
dilakukan manual via SQL Editor TiDB Cloud. (3) Idempoten — error "sudah
ada" diabaikan.

**Q17. Apa keterbatasan free tier TiDB Cloud?**
A. (a) RU (Request Unit) quota harian. (b) Idle connection di-close — perlu
`connectionLimit` kecil (3 di production). (c) Cold start lambat saat tidur.
Untuk skala MVP cukup, tapi untuk produksi enterprise harus upgrade ke
Dedicated tier atau migrasi ke RDS/Aurora.

**Q18. Bagaimana app ini scale kalau dipakai 1000+ pegawai?**
A. (1) Index `(user_id, recorded_at)` sudah ada, query riwayat tetap cepat.
(2) Tabel `attendance` bisa di-partition by month kalau sudah jutaan baris.
(3) Push notification bisa di-queue (saat ini sync, blocking). (4) Vercel
auto-scale serverless function, bottleneck pindah ke DB pool — perlu
upgrade TiDB tier. (5) Foto / lampiran sebaiknya pindah ke object storage
(S3/R2) dari filesystem lokal.

**Q19. Mengapa tidak pakai realtime (WebSocket / SSE)?**
A. Untuk fitur absensi, realtime tidak kritis — user explicitly tap tombol.
Notifikasi sudah ditangani Web Push. WebSocket akan menambah kompleksitas
untuk untung kecil. Vercel serverless juga tidak mendukung long-lived
connection dengan baik.

**Q20. Apa rencana pengembangan ke depan?**
A. (1) Migrasi ke Capacitor APK dengan plugin Camera (selfie wajib),
Geolocation native, dan Device UUID untuk binding. (2) Custom plugin Kotlin
untuk deteksi Mock GPS & rooted device. (3) Dashboard admin dengan peta
(Leaflet). (4) Multi-office (saat ini satu titik). (5) Auto-reminder pulang
via Web Push terjadwal.

---

## 19. Demo Flow Singkat (untuk Sidang)

Disarankan demo urut seperti ini, 5-7 menit:

1. **Login pegawai** (`pegawai@example.com / pegawai123`) → tunjukkan token
   tersimpan di cookie via DevTools.
2. **Halaman absen** → klik "Refresh GPS" → tampil marker user di peta →
   klik "Konfirmasi Clock In" → tampil halaman sukses dengan jarak.
3. **Buka tab kedua → riwayat** → record baru ada.
4. **Login admin** (`admin@example.com / admin123`) di tab incognito.
5. **/admin/harian** → tampil semua pegawai hari ini, salah satunya
   "hadir".
6. **/admin/pengaturan** → toggle "Cek Titik Lokasi" off → balik ke pegawai
   → halaman absen sekarang muncul banner "Mode WFH aktif".
7. **/admin/libur** → klik "Sinkron tanggal merah" → tampil daftar libur
   2026.
8. **/admin/izin** → pegawai submit izin dari `/izin` → admin approve →
   notifikasi muncul di HP pegawai (kalau Web Push aktif).
9. **/admin/log** (super admin) → tampil audit semua aksi tadi.

---

## 20. Checklist Hafalan Terakhir

Sebelum sidang, pastikan Anda bisa:

- [ ] Menggambar diagram arsitektur tanpa lihat catatan (Client → Nitro → DB
      + 2 layanan eksternal).
- [ ] Menyebut 8+ tabel beserta relasinya.
- [ ] Menjelaskan Haversine dalam 30 detik.
- [ ] Menjelaskan beda PWA & APK Capacitor.
- [ ] Menjelaskan alur JWT (login → cookie → header → verify).
- [ ] Menjelaskan VAPID dan kenapa tidak butuh Firebase.
- [ ] Menyebut minimal 3 strategi anti-titip-absen yang dipakai & yang
      direncanakan.
- [ ] Menjelaskan kenapa validasi GPS dilakukan di server bukan client.
- [ ] Menjelaskan auto-migrate idempoten pakai `CREATE TABLE IF NOT EXISTS`
      + try-catch ALTER.
- [ ] Hapal struktur folder Nuxt 3 (pages, server/api, composables, etc).

Semoga sukses sidangnya! 💪
