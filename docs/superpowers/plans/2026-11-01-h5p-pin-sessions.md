# Website Sesi H5P berbasis PIN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Penyelenggara mengunggah konten H5P, membagikannya lewat PIN berjendela waktu, dan peserta mengerjakannya lalu melihat peringkatnya.

**Architecture:** Satu aplikasi Next.js (App Router). Postgres memegang data aplikasi; disk memegang artefak H5P lewat `@lumieducation/h5p-server`. Aturan yang menentukan keadilan peringkat (status sesi, pemilihan nilai resmi, pengurutan) dikerjakan sebagai fungsi murni yang diuji lepas dari basis data dan dari H5P.

**Tech Stack:** Next.js 16.4.3 · React 19.3.1 · TypeScript · PostgreSQL 18 (driver `pg` 8.23.1, migrasi SQL bernomor) · `@lumieducation/h5p-server` 10.0.4 · Tailwind CSS 4.3.3 · Vitest 5.0.5

**Spec:** [`docs/superpowers/specs/2026-11-01-h5p-pin-sessions-design.md`](../specs/2026-11-01-h5p-pin-sessions-design.md) — baca lebih dulu; rencana ini berargumen dari sana dan tidak mengulang alasannya.

## Global Constraints

- Berjalan lokal di Windows 11 / Laragon. Node 22.21.1, npm 10.9.4, PostgreSQL 18.0 sudah ada; jangan menambah runtime lain.
- Semua teks antarmuka **bahasa Indonesia**. Tata letak wajib nyaman di ponsel (peserta membuka dari ponsel).
- Satu sesi = satu konten H5P. Tidak ada editor/pengarangan H5P. Tidak ada akun peserta.
- `closes_at` **NOT NULL**. PIN **6 angka**, **unik di seluruh tabel sesi** (indeks unik biasa).
- Nama peserta unik per sesi, dibandingkan `lower(trim(alias))`, maksimal 40 karakter, ditegakkan indeks unik di basis data.
- Peringkat: `score_raw` DESC → durasi ASC → `finished_at` ASC. Hanya peserta yang `finished_at` terisi.
- Nilai resmi: utamakan pernyataan `completed` **terakhir**; kalau tak ada, `result.score.max` terbesar; seri → terakhir masuk. Dihitung ulang setiap pernyataan masuk.
- Durasi **selalu** dihitung server: `finished_at - started_at`. Jangan percaya angka waktu dari peramban.
- Konten tak berskor (`contents.scoring = 'unscored'`): sesi boleh dibuat, **tanpa papan peringkat**, dan **tidak ada tombol "saya selesai" di mana pun**.
- Berkas **konten** H5P tidak boleh diakses anonim (§7.3). Berkas **pustaka** boleh.
- Batas unggah 64 MB.
- Zona waktu antarmuka: Asia/Jakarta. Kolom waktu `timestamptz`.

## Review Focus

Lima hal yang dituntut spesifikasi tapi mudah lolos dari pengujian tugas, diurutkan dari yang paling mungkin menggigit pemakai. Tiap baris sudah dititipkan tesnya ke tugas yang memiliki kodenya.

1. **Berkas unggahan yang bukan paket H5P sah** (bukan zip, zip tanpa `h5p.json`, `h5p.json` rusak, lebih dari 64 MB) harus gagal dengan kalimat Indonesia yang menyebut sebabnya — bukan HTTP 500 atau halaman buntu. → Tugas 3, Langkah 1.
2. **Pernyataan xAPI tanpa `result.score`, atau dengan `score.max` = 0** tidak boleh menghasilkan `NaN`, pembagian nol, atau nilai tersimpan separuh. → Tugas 2, Langkah 1.
3. **Dua peserta menekan "Mulai" dengan nama sama pada saat yang sama** — satu harus ditolak dengan pesan "pakai nama lain", bukan tabrakan basis data yang bocor ke pemakai. → Tugas 8, Langkah 5.
4. **Peserta konten tak berskor sampai di akhir** tidak boleh mendapat halaman hasil kosong atau 404; ia dapat halaman "selesai, sesi ini tanpa peringkat". → Tugas 10, Langkah 3.
5. **PIN yang diketik dengan spasi, atau PIN sesi yang belum dibuka / sudah ditutup** harus dibedakan pesannya, bukan "PIN tidak ditemukan" untuk semua kasus. → Tugas 8, Langkah 1.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `db/migrations/001_init.sql` | seluruh skema §6 |
| `scripts/migrate.mjs` | jalankan migrasi bernomor yang belum tercatat |
| `scripts/seed-teacher.mjs` | buat akun penyelenggara pertama |
| `scripts/copy-h5p-core.mjs` | salin aset inti dari zip plugin → `public/h5p-core` |
| `scripts/ingest-h5p.mjs` | telan satu `.h5p` dari baris perintah (alat bukti & uji) |
| `src/lib/db.ts` | pool `pg` + `query()` |
| `src/lib/session-status.ts` | status sesi dari waktu — **murni** |
| `src/lib/scoring.ts` | pemilih nilai resmi — **murni** |
| `src/lib/ranking.ts` | pengurutan peringkat — **murni** |
| `src/lib/h5p.ts` | konfigurasi + singleton `H5PEditor` / `H5PPlayer` / `H5PAjaxEndpoint` |
| `src/lib/h5p-ingest.ts` | alur §5.4: periksa paket, pasang pustaka hilang, cache hub |
| `src/lib/h5p-access.ts` | penentu izin berkas H5P (§7.3) |
| `src/lib/auth.ts` | kata sandi + cookie sesi penyelenggara |
| `src/lib/participant.ts` | token peserta bertanda tangan + cookie |
| `src/lib/repo/contents.ts` · `sessions.ts` · `participants.ts` · `xapi.ts` | query per entitas |
| `src/app/h5p/[...path]/route.ts` · `src/app/h5p/ajax/route.ts` | jembatan `H5PAjaxEndpoint` |
| `src/app/api/xapi/route.ts` | penerima pernyataan xAPI |
| `src/app/(peserta)/*` · `src/app/admin/*` | halaman §7.2 |
| `tests/*` | Vitest; berkas uji bersebelahan dengan modulnya di `tests/` |

Fungsi murni dipisah dari repo dan dari H5P dengan sengaja: itu satu-satunya cara menguji aturan keadilan tanpa menyalakan Postgres atau mengunduh pustaka.

---

### Task 1: Fondasi proyek, skema, dan migrasi

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`
- Create: `db/migrations/001_init.sql`, `scripts/migrate.mjs`, `src/lib/db.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `query<T>(sql: string, params?: unknown[]): Promise<T[]>` dan `pool: Pool` dari `src/lib/db.ts`; perintah `npm run migrate`.

Pakai `next@16.4.3`, `react@19.3.1`, `react-dom@19.3.1`, `pg@8.23.1`, `tailwindcss@4.3.3`, `vitest@5.0.5`, `typescript`, `@types/node`, `@types/pg`. `.gitignore` memuat `node_modules`, `.next`, `.env.local`, `data/`, `.superpowers/`. `.env.example` memuat `DATABASE_URL`, `SESSION_SECRET`, `H5P_DATA_DIR=./data/h5p`.

`scripts/migrate.mjs`: tabel `schema_migrations(filename text primary key, applied_at timestamptz default now())`; jalankan tiap berkas `db/migrations/*.sql` berurutan nama yang belum tercatat, satu transaksi per berkas.

- [ ] **Step 1: Tulis `db/migrations/001_init.sql`**

```sql
create table teachers (
  id            bigserial primary key,
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  created_at    timestamptz not null default now()
);

create table contents (
  id              bigserial primary key,
  owner_id        bigint not null references teachers(id),
  title           text not null,
  main_library    text not null,
  h5p_content_id  text not null,
  scoring         text not null default 'unknown'
                  check (scoring in ('scored','unscored','unknown')),
  source_filename text not null,
  created_at      timestamptz not null default now()
);

create table quiz_sessions (
  id              bigserial primary key,
  owner_id        bigint not null references teachers(id),
  content_id      bigint not null references contents(id),
  title           text not null,
  pin             text not null unique check (pin ~ '^[0-9]{6}$'),
  opens_at        timestamptz not null,
  closes_at       timestamptz not null,
  closed_early_at timestamptz,
  created_at      timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table participants (
  id          bigserial primary key,
  session_id  bigint not null references quiz_sessions(id) on delete cascade,
  alias       text not null check (char_length(alias) between 1 and 40),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  score_raw   integer,
  score_max   integer,
  token_hash  text not null unique
);

create unique index participants_alias_unik
  on participants (session_id, lower(btrim(alias)));

create table xapi_events (
  id             bigserial primary key,
  participant_id bigint not null references participants(id) on delete cascade,
  statement      jsonb not null,
  received_at    timestamptz not null default now()
);

create index xapi_events_peserta on xapi_events (participant_id, received_at);
```

- [ ] **Step 2: Tulis tes yang gagal**

`tests/schema.test.ts`, terhadap basis data uji yang sudah dimigrasi:

```ts
test('pin unik di seluruh tabel sesi', /* insert dua sesi pin '482917' → error kedua */)
test('pin harus enam angka', /* pin '48291' dan 'abcdef' ditolak */)
test('alias unik per sesi tanpa pandang huruf dan spasi', /* 'Rina' lalu ' rina ' → error */)
test('alias sama boleh di sesi berbeda', /* 'Rina' di dua session_id → keduanya lolos */)
test('menghapus sesi ikut menghapus peserta dan pernyataan xapi', /* cascade */)
test('closes_at wajib dan harus setelah opens_at')
```

- [ ] **Step 3: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/schema.test.ts`
Expected: FAIL — relasi belum ada.

- [ ] **Step 4: Sambungkan `src/lib/db.ts` dan `npm run migrate`, lalu migrasikan basis data uji**

`query` memakai satu `Pool` bersama; baca `DATABASE_URL`.

- [ ] **Step 5: Jalankan tes untuk memastikan lulus**

Run: `npm test -- tests/schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: fondasi proyek, skema, dan migrasi"
```

---

### Task 2: Aturan keadilan sebagai fungsi murni

**Files:**
- Create: `src/lib/session-status.ts`, `src/lib/scoring.ts`, `src/lib/ranking.ts`
- Test: `tests/session-status.test.ts`, `tests/scoring.test.ts`, `tests/ranking.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type SesiWaktu = { opens_at: Date; closes_at: Date; closed_early_at: Date | null }`
  - `statusSesi(s: SesiWaktu, sekarang: Date): 'terjadwal' | 'berjalan' | 'selesai'`
  - `bolehMasuk(s: SesiWaktu, sekarang: Date): { ok: true } | { ok: false; alasan: 'belum_dibuka' | 'sudah_ditutup' }`
  - `type Pernyataan = { statement: unknown; received_at: Date }`
  - `pilihNilaiResmi(ps: Pernyataan[]): { score_raw: number; score_max: number; finished_at: Date } | null`
  - `type BarisPeringkat = { id: number; alias: string; score_raw: number; score_max: number; started_at: Date; finished_at: Date }`
  - `urutkanPeringkat(b: BarisPeringkat[]): (BarisPeringkat & { peringkat: number; durasi_ms: number })[]`

`pilihNilaiResmi` mengembalikan `null` kalau tak ada pernyataan yang memenuhi syarat — itulah keadaan konten tak berskor, dan bukan kesalahan. Syarat kelayakan sama dengan §4.2 spesifikasi: verb `answered` atau `completed`, **tanpa** `context.contextActivities.parent`.

- [ ] **Step 1: Tulis tes yang gagal untuk `pilihNilaiResmi`**

```ts
test('mengabaikan pernyataan anak', /* ada contextActivities.parent → null */)
test('mengabaikan verb lain', /* 'attempted', 'progressed' → null */)
test('satu pernyataan answered dipakai', /* raw 8 max 10 */)
test('completed menang atas answered walau answered datang lebih akhir')
test('completed terakhir yang dipakai kalau completed ada beberapa')
test('tanpa completed, score.max terbesar yang dipakai', /* 3/5 lalu 6/20 → 6/20 */)
test('score.max seri, yang terakhir masuk yang dipakai')
test('pernyataan tanpa result.score diabaikan, bukan menghasilkan NaN')
test('score.max nol diterima apa adanya tanpa pembagian', /* raw 0 max 0 → tersimpan 0/0 */)
test('finished_at adalah received_at pernyataan yang terpilih')
```

Dua tes terakhir sebelum `finished_at` adalah Review Focus #2: hasilnya harus angka, dan tidak boleh ada persentase dihitung di modul ini.

- [ ] **Step 2: Tulis tes yang gagal untuk `statusSesi` dan `bolehMasuk`**

```ts
test('tepat di opens_at sudah berjalan')
test('tepat di closes_at sudah selesai')
test('closed_early_at mengalahkan closes_at yang masih jauh')
test('bolehMasuk membedakan belum_dibuka dan sudah_ditutup')
```

- [ ] **Step 3: Tulis tes yang gagal untuk `urutkanPeringkat`**

```ts
test('skor lebih tinggi lebih dulu')
test('skor sama, durasi lebih singkat lebih dulu')
test('skor dan durasi sama, finished_at lebih awal lebih dulu')
test('durasi dihitung dari started_at dan finished_at, bukan dari masukan lain')
test('peringkat bernomor urut mulai dari satu')
```

- [ ] **Step 4: Jalankan ketiga berkas tes untuk memastikan gagal**

Run: `npm test -- tests/session-status.test.ts tests/scoring.test.ts tests/ranking.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 5: Implementasikan ketiga modul sesuai tanda tangan di blok Interfaces**

Tanpa impor ke `pg`, ke `@lumieducation/*`, atau ke apa pun yang menyentuh jaringan.

- [ ] **Step 6: Jalankan tes untuk memastikan lulus**

Run: `npm test -- tests/session-status.test.ts tests/scoring.test.ts tests/ranking.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: aturan status sesi, nilai resmi, dan peringkat"
```

---

### Task 3: Mesin H5P dan penelanan paket

Tugas paling berisiko; §8 spesifikasi menaruhnya lebih dulu dengan sengaja.

**Files:**
- Create: `src/lib/h5p.ts`, `src/lib/h5p-ingest.ts`, `scripts/copy-h5p-core.mjs`, `scripts/ingest-h5p.mjs`
- Test: `tests/h5p-ingest.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `getH5P(): { editor: H5PEditor; player: H5PPlayer; ajax: H5PAjaxEndpoint; config: H5PConfig }` — singleton, aman dipanggil berulang di mode dev Next.
  - `telanPaket(berkas: Buffer, namaBerkas: string, user: IUser): Promise<HasilTelan>` dengan
    `type HasilTelan = { ok: true; h5pContentId: string; title: string; mainLibrary: string; pustakaTerpasang: string[]; hanyaPustaka: boolean } | { ok: false; pesan: string; pustakaKurang?: string[] }`
  - `const H5P_USER_PENYELENGGARA: IUser`

**Fakta yang sudah diverifikasi — jangan diraba ulang:**
- `playerAssetList.json` milik h5p-server meminta tepat 10 skrip (`js/jquery.js`, `js/h5p.js`, `js/h5p-event-dispatcher.js`, `js/h5p-x-api-event.js`, `js/h5p-x-api.js`, `js/h5p-content-type.js`, `js/h5p-confirmation-dialog.js`, `js/h5p-action-bar.js`, `js/request-queue.js`, `js/h5p-tooltip.js`) dan 5 gaya (`styles/h5p.css`, `styles/h5p-confirmation-dialog.css`, `styles/h5p-core-button.css`, `styles/h5p-tooltip.css`, `styles/h5p-table.css`). **Kesemuanya ada** di `hvp/library/` dalam `mod_hvp_2026090101.zip`, jadi jalur §5.2 terbukti cukup dan kemungkinan besar tidak perlu berpaling ke rilis `h5p-php-library`.
- Titik unduh pustaka: `https://hub-api.h5p.org/v1/content-types/<machineName>` — `api.h5p.org` membalas 500.
- Sembilan berkas di `konten/` **tanpa pustaka**, jadi jalur "pasang pustaka dari hub" adalah jalur utama, bukan kasus pinggir.

`scripts/copy-h5p-core.mjs` membongkar `mod_hvp_2026090101.zip` ke direktori sementara lalu menyalin `hvp/library/{js,styles,fonts,images}` ke `public/h5p-core/`, dan gagal keras kalau salah satu dari 15 berkas di atas tidak ada.

`src/lib/h5p.ts`: `H5PConfig` dengan `baseUrl = '/h5p'`, `coreUrl = '/h5p-core'`, `contentHubEnabled = false`, `setFinishedEnabled = false`, `maxFileSize`/`maxTotalSize` = 64 MB. Penyimpanan: `fsImplementations.FileLibraryStorage(data/h5p/libraries)`, `FileContentStorage(data/h5p/content)`, `DirectoryTemporaryFileStorage(data/h5p/temp)`, `InMemoryStorage` untuk cache, `LaissezFairePermissionSystem` (izin dijaga di lapisan kita, §7.3). `H5PPlayer` dapat `contentUserDataStorage` **undefined** — keputusan §7.4, jangan dipasang.

Urutan dalam `telanPaket`, persis §5.4: baca `h5p.json` dari zip tanpa memasang apa pun → bandingkan `mainLibrary` + `preloadedDependencies` dengan `editor.libraryManager` → tiap yang hilang dipasang lewat `editor.installLibraryFromHub(machineName, user)` → baru `editor.uploadPackage(buffer, user)` → `editor.saveOrUpdateContent(undefined, parameters, metadata, mainLibraryUbername, user)`. Paket yang isinya hanya pustaka ditelan dengan `uploadPackage(buffer, user, { onlyInstallLibraries: true })` dan mengembalikan `hanyaPustaka: true` (§5.4 penangkal 2). Paket hub yang terunduh disimpan di `data/h5p/hub-cache/<machineName>.h5p` dan dipakai lebih dulu kalau ada (§5.4 penangkal 1).

- [ ] **Step 1: Tulis tes yang gagal untuk penolakan paket cacat** — Review Focus #1

```ts
test('bukan zip ditolak dengan pesan Indonesia', /* Buffer.from('bukan zip') → ok:false */)
test('zip tanpa h5p.json ditolak')
test('h5p.json bukan JSON sah ditolak')
test('h5p.json tanpa mainLibrary ditolak')
test('berkas lebih dari 64 MB ditolak sebelum dibongkar')
```

Tiap `pesan` wajib menyebut sebabnya; tidak boleh ada lemparan yang lolos ke pemanggil.

- [ ] **Step 2: Tulis tes yang gagal untuk penelanan nyata (butuh jaringan)**

Tandai sebagai tes integrasi lambat (mis. `describe.sequential`, timeout 180 detik):

```ts
test('menelan example-content-crossword-1209160.h5p memasang pustaka dari hub dan menghasilkan contentId',
  /* ok:true, mainLibrary 'H5P.Crossword', pustakaTerpasang memuat 'H5P.Crossword-0.5' */)
test('menelan berkas yang sama kedua kali tidak memasang pustaka lagi',
  /* pustakaTerpasang kosong */)
test('versi hub tidak cocok dengan yang diminta konten → ok:false dengan pustakaKurang terisi',
  /* palsukan pemeriksa versi; pesan menyebut nama dan versi yang diminta vs tersedia */)
```

Tes ketiga memakai berkas `.h5p` buatan sendiri yang meminta versi mustahil (mis. `H5P.Crossword 99.0`), supaya jalur kegagalan §5.4 teruji tanpa menunggu hub bergerak.

- [ ] **Step 3: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/h5p-ingest.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 4: Jalankan `node scripts/copy-h5p-core.mjs` dan periksa 15 berkas inti ada di `public/h5p-core`**

- [ ] **Step 5: Implementasikan `src/lib/h5p.ts` lalu `src/lib/h5p-ingest.ts`**

- [ ] **Step 6: Jalankan tes untuk memastikan lulus, lalu telan satu berkas lewat CLI**

Run: `npm test -- tests/h5p-ingest.test.ts`
Expected: PASS
Run: `node scripts/ingest-h5p.mjs konten/example-content-crossword-1209160.h5p`
Expected: mencetak contentId, dan `data/h5p/libraries/H5P.Crossword-0.5/` ada.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: mesin H5P dan penelanan paket dengan unduh pustaka dari hub"
```

---

### Task 4: Titik akhir H5P, penjaga izin, dan pemutar mentah

Buktikan konten tampil dan memancarkan xAPI, sebelum ada sesi atau peserta.

**Files:**
- Create: `src/lib/h5p-access.ts`, `src/app/h5p/ajax/route.ts`, `src/app/h5p/[...path]/route.ts`, `src/app/dev/play/[contentId]/page.tsx`, `src/components/PemutarH5P.tsx`, `public/penangkap-xapi.js`
- Test: `tests/h5p-access.test.ts`

**Interfaces:**
- Consumes: `getH5P()` (Tugas 3)
- Produces:
  - `type AksesH5P = { jenis: 'penyelenggara'; teacherId: number } | { jenis: 'peserta'; participantId: number; sessionId: number; h5pContentId: string } | null`
  - `periksaAksesH5P(req: Request, h5pContentId: string): Promise<AksesH5P>` — **menolak secara bawaan**; Tugas 8 menambahkan cabang peserta, tanda tangannya tidak berubah.

Rute berkas konten (`/h5p/content/<id>/<berkas>`) **wajib** lewat `periksaAksesH5P` dan membalas 403 kalau `null`; rute berkas pustaka (`/h5p/libraries/...`) terbuka. Pakai `ajax.getContentFile`, `ajax.getLibraryFile`, `ajax.getAjax`, `ajax.postAjax` sesuai tanda tangan yang sudah diverifikasi di Tugas 3. Rute ini mengalirkan berkas besar — pakai `Response` dengan stream, jangan buffer penuh.

`PemutarH5P.tsx` me-render keluaran `player.render(h5pContentId, user, 'id')` lewat `dangerouslySetInnerHTML` di halaman server, lalu memuat `/penangkap-xapi.js`.

`public/penangkap-xapi.js` meniru `xapi-collector.js` dari plugin, disederhanakan: berlangganan `H5P.externalDispatcher.on('xAPI', …)`, saring verb `answered`/`completed` tanpa `context.contextActivities.parent`, lalu `fetch('/api/xapi', { method:'POST', body: JSON.stringify({ statement }) })`. Tidak mengirim skor hasil hitungan sendiri dan tidak mengirim durasi — server yang menentukan (§5.6).

- [ ] **Step 1: Tulis tes yang gagal untuk `periksaAksesH5P`**

```ts
test('permintaan tanpa kredensial apa pun menghasilkan null')
test('cookie penyelenggara yang sah menghasilkan jenis penyelenggara')
test('cookie penyelenggara palsu atau kedaluwarsa menghasilkan null')
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/h5p-access.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan `h5p-access.ts` dan keempat rute `/h5p/*`**

Cabang penyelenggara memakai `auth.ts` dari Tugas 5 — kalau Tugas 5 belum ada saat ini dikerjakan, implementasikan `auth.ts` di sini dan Tugas 5 memakainya apa adanya.

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

Run: `npm test -- tests/h5p-access.test.ts`
Expected: PASS

- [ ] **Step 5: Verifikasi manual di peramban** — ini gerbang §8 langkah 1

Run: `npm run dev`, buka `/dev/play/<contentId>` hasil Tugas 3 sambil masuk sebagai penyelenggara.
Expected: teka-teki silang tampil dan bisa dimainkan; setelah diselesaikan, tab Network menunjukkan `POST /api/xapi` berisi `result.score`; `/h5p/content/<id>/...` tanpa cookie membalas 403.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: titik akhir H5P berizin, pemutar, dan penangkap xAPI"
```

---

### Task 5: Autentikasi penyelenggara

**Files:**
- Create: `src/lib/auth.ts` (kalau belum dibuat di Tugas 4), `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`, `scripts/seed-teacher.mjs`, `src/middleware.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `query` (Tugas 1)
- Produces: `hashKataSandi(k: string): Promise<string>`, `periksaKataSandi(k: string, hash: string): Promise<boolean>`, `buatSesiPenyelenggara(teacherId: number): Promise<string>`, `penyelenggaraSekarang(req?: Request): Promise<{ id: number; name: string } | null>`, `keluar(): Promise<void>`

Cookie `httpOnly`, `sameSite: 'lax'`, bertanda tangan dengan `SESSION_SECRET`. **Tidak ada halaman pendaftaran** (§7.1) — akun pertama hanya lewat `scripts/seed-teacher.mjs <email> <nama>` yang membaca kata sandi dari stdin. `src/middleware.ts` melindungi `/admin/*` kecuali `/admin/login`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
test('kata sandi benar menghasilkan cookie sesi')
test('kata sandi salah tidak menghasilkan cookie dan pesannya tidak membocorkan apakah email terdaftar')
test('cookie yang dirusak tandanya ditolak')
test('penyelenggaraSekarang mengembalikan null tanpa cookie')
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan `auth.ts`, halaman login, middleware, dan skrip seed**

- [ ] **Step 4: Jalankan tes untuk memastikan lulus; lalu seed akun dan masuk lewat peramban**

Run: `npm test -- tests/auth.test.ts` → PASS
Run: `node scripts/seed-teacher.mjs grafis.bpip@gmail.com "Penyelenggara"` lalu masuk di `/admin/login`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: autentikasi penyelenggara"
```

---

### Task 6: Pustaka konten

**Files:**
- Create: `src/lib/repo/contents.ts`, `src/app/admin/konten/page.tsx`, `src/app/admin/konten/actions.ts`
- Test: `tests/repo-contents.test.ts`

**Interfaces:**
- Consumes: `telanPaket` (Tugas 3), `penyelenggaraSekarang` (Tugas 5)
- Produces:
  - `type Konten = { id: number; owner_id: number; title: string; main_library: string; h5p_content_id: string; scoring: 'scored' | 'unscored' | 'unknown'; source_filename: string; created_at: Date }`
  - `simpanKonten(ownerId: number, t: { title: string; mainLibrary: string; h5pContentId: string; sourceFilename: string }): Promise<Konten>`
  - `daftarKonten(ownerId: number): Promise<(Konten & { jumlah_sesi: number })[]>`
  - `ambilKonten(contentId: number): Promise<Konten | null>`
  - `tandaiScoring(contentId: number, scoring: 'scored' | 'unscored'): Promise<void>`

Halaman `/admin/konten`: kotak unggah (satu kotak, juga menerima paket pustaka §5.4), daftar konten dengan nama pustaka utama dan penanda `scoring`, dan tombol "Buat sesi". Catatan langkah penelanan ditampilkan apa adanya ke penyelenggara, termasuk pustaka apa yang diunduh — ini jalur utama, bukan kasus pinggir, jadi tampilkan sebagai kemajuan, bukan sebagai peringatan.

Konten baru masuk dengan `scoring = 'unknown'`. Daftar tipe yang diketahui tak berskor (`H5P.MemoryGame`, `H5P.DialogCards`) ditandai `'unscored'` saat penelanan; sisanya menjadi pasti saat pernyataan xAPI pertama masuk (Tugas 9).

- [ ] **Step 1: Tulis tes yang gagal**

```ts
test('simpanKonten menyimpan dan daftarKonten mengembalikannya untuk pemiliknya saja')
test('konten H5P.MemoryGame ditandai unscored saat disimpan')
test('konten H5P.Crossword ditandai unknown saat disimpan')
test('tandaiScoring mengubah unknown menjadi scored dan tidak menurunkan scored kembali ke unknown')
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/repo-contents.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan repo lalu halaman dan aksinya**

- [ ] **Step 4: Jalankan tes untuk memastikan lulus; unggah satu berkas dari `konten/` lewat peramban**

Run: `npm test -- tests/repo-contents.test.ts` → PASS
Expected di peramban: catatan unduh pustaka terlihat, konten muncul di daftar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pustaka konten dengan unggah dan penanda skor"
```

---

### Task 7: Sesi — buat, daftar, ubah, hapus

**Files:**
- Create: `src/lib/repo/sessions.ts`, `src/lib/pin.ts`, `src/app/admin/page.tsx`, `src/app/admin/sesi/baru/page.tsx`, `src/app/admin/sesi/[id]/ubah/page.tsx`, `src/app/admin/sesi/actions.ts`
- Test: `tests/repo-sessions.test.ts`

**Interfaces:**
- Consumes: `statusSesi` (Tugas 2), `ambilKonten`/`daftarKonten` (Tugas 6)
- Produces:
  - `type Sesi = { id: number; owner_id: number; content_id: number; title: string; pin: string; opens_at: Date; closes_at: Date; closed_early_at: Date | null }`
  - `buatPinBaru(): Promise<string>`
  - `buatSesi(ownerId: number, s: { contentId: number; title: string; pin: string; opensAt: Date; closesAt: Date }): Promise<{ ok: true; sesi: Sesi } | { ok: false; pesan: string }>`
  - `daftarSesi(ownerId: number): Promise<(Sesi & { status: 'terjadwal' | 'berjalan' | 'selesai'; judul_konten: string; scoring: Konten['scoring']; jumlah_ikut: number; jumlah_selesai: number })[]>`
  - `ambilSesi(id: number): Promise<Sesi | null>` dan `ambilSesiDariPin(pin: string): Promise<Sesi | null>`
  - `ubahSesi(id: number, s: { title: string; pin: string; opensAt: Date; closesAt: Date }): Promise<{ ok: true } | { ok: false; pesan: string }>`
  - `hapusSesi(id: number): Promise<void>` · `tutupSekarang(id: number): Promise<void>`

`/admin` adalah daftar sesi (halaman utama penyelenggara) dengan saringan Semua/Berjalan/Terjadwal/Selesai dan tombol Pantau / Ubah / Hapus per baris. Mengubah PIN sesi yang sudah punya peserta: konfirmasi yang menjelaskan PIN lama langsung tak berlaku. Menghapus: konfirmasi dengan mengetik judul sesi; konten tidak tersentuh.

Konten `scoring = 'unscored'` tetap boleh dibuatkan sesi, dengan keterangan jelas bahwa sesi itu tanpa papan peringkat.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
test('buatPinBaru menghasilkan enam angka dan tidak menabrak pin yang sudah ada')
test('buatSesi menolak closes_at sebelum opens_at')
test('daftarSesi mengembalikan status terhitung, bukan kolom tersimpan')
test('tutupSekarang membuat status menjadi selesai walau closes_at masih jauh')
test('hapusSesi menghapus pesertanya tapi kontennya tetap ada')
test('mengubah pin menjadi pin sesi lain ditolak dengan pesan, bukan error basis data')
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/repo-sessions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan `pin.ts`, repo, lalu halaman daftar/baru/ubah**

`buatPinBaru` mengulang sampai dapat yang belum terpakai; tangkap pelanggaran unik sebagai pesan Indonesia.

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

Run: `npm test -- tests/repo-sessions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: daftar sesi, pembuatan, pengubahan, dan penghapusan"
```

---

### Task 8: Alur masuk peserta

**Files:**
- Create: `src/lib/participant.ts`, `src/lib/repo/participants.ts`, `src/app/page.tsx`, `src/app/j/[pin]/page.tsx`, `src/app/j/[pin]/actions.ts`, `src/app/play/[token]/page.tsx`
- Modify: `src/lib/h5p-access.ts` (tambah cabang peserta)
- Test: `tests/participant.test.ts`

**Interfaces:**
- Consumes: `bolehMasuk` (Tugas 2), `getH5P`/`PemutarH5P` (Tugas 3–4), `ambilSesiDariPin` (Tugas 7)
- Produces: `buatToken(): { token: string; hash: string }`, `pesertaDariToken(token: string)`, `mulaiPeserta(sessionId: number, alias: string): Promise<{ ok: true; token: string } | { ok: false; alasan: 'nama_terpakai' | 'sesi_tertutup' }>`

`/` kotak PIN. `/j/[pin]` menampilkan judul sesi, tanggal tutup, kotak nama, dan **peringatan §7.4** bahwa pekerjaan sebaiknya diselesaikan sekali jalan karena menyegarkan halaman mengulang kontennya sementara waktu terus berjalan. `/play/[token]` memuat `PemutarH5P`; token yang `finished_at`-nya terisi dialihkan ke `/hasil/[token]`.

Cabang peserta di `periksaAksesH5P`: token sah **dan** `bolehMasuk` sesi itu `ok` **dan** `h5pContentId` yang diminta memang milik sesi itu.

- [ ] **Step 1: Tulis tes yang gagal untuk pintu masuk PIN** — Review Focus #5

```ts
test('pin dengan spasi di ujung tetap diterima', /* ' 482917 ' */)
test('pin bukan enam angka ditolak sebagai format salah, bukan tidak ditemukan')
test('pin yang tidak ada mengembalikan tidak ditemukan')
test('sesi belum dibuka mengembalikan belum_dibuka beserta tanggal bukanya')
test('sesi sudah ditutup mengembalikan sudah_ditutup beserta tanggal tutupnya')
```

- [ ] **Step 2: Tulis tes yang gagal untuk token dan `mulaiPeserta`**

```ts
test('mulaiPeserta menetapkan started_at di server dan mengembalikan token')
test('token disimpan sebagai hash, bukan apa adanya')
test('token yang dirusak tidak mengembalikan peserta')
test('nama yang sudah terpakai ditolak dengan alasan nama_terpakai')
test('nama yang sama dengan beda huruf besar dan spasi juga ditolak')
test('mulaiPeserta di sesi tertutup ditolak dengan alasan sesi_tertutup')
```

- [ ] **Step 3: Tulis tes yang gagal untuk akses berkas konten oleh peserta**

```ts
test('token peserta sesi terbuka boleh mengambil berkas konten sesinya')
test('token peserta tidak boleh mengambil berkas konten sesi lain')
test('token peserta sesi yang sudah ditutup tidak boleh mengambil berkas konten')
```

- [ ] **Step 4: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/participant.test.ts`
Expected: FAIL

- [ ] **Step 5: Implementasikan ketiganya; tangani tabrakan nama sebagai pesan, bukan lemparan** — Review Focus #3

`mulaiPeserta` **mengandalkan indeks unik** `participants_alias_unik`: sisipkan, lalu tangkap pelanggaran unik Postgres (`23505`) dan kembalikan `{ ok: false, alasan: 'nama_terpakai' }`. Jangan memeriksa dulu lalu menyisipkan — dua permintaan serentak akan lolos keduanya. Tambahkan tes yang menjalankan dua `mulaiPeserta` dengan nama sama secara bersamaan lewat `Promise.all` dan menuntut tepat satu berhasil.

- [ ] **Step 6: Jalankan tes untuk memastikan lulus**

Run: `npm test -- tests/participant.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: alur masuk peserta dengan pin, nama unik, dan token"
```

---

### Task 9: Penerima xAPI dan nilai resmi

**Files:**
- Create: `src/app/api/xapi/route.ts`, `src/lib/repo/xapi.ts`
- Modify: `src/lib/repo/participants.ts`
- Test: `tests/api-xapi.test.ts`

**Interfaces:**
- Consumes: `pilihNilaiResmi` (Tugas 2), `pesertaDariToken` (Tugas 8), `tandaiScoring` (Tugas 6)
- Produces: `catatPernyataan(participantId: number, statement: unknown): Promise<void>` — menyimpan ke `xapi_events`, menghitung ulang nilai resmi, lalu memperbarui `score_raw`, `score_max`, `finished_at` peserta itu.

Pernyataan yang tidak memenuhi syarat tetap disimpan di `xapi_events` tapi tidak mengubah nilai. Pernyataan pertama yang memenuhi syarat dari sebuah konten juga memanggil `tandaiScoring(contentId, 'scored')`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
test('pernyataan tanpa token peserta yang sah dibalas 401 dan tidak disimpan')
test('pernyataan yang memenuhi syarat mengisi score_raw, score_max, finished_at')
test('pernyataan berikutnya dengan score.max lebih besar memperbarui nilai')
test('pernyataan completed mengalahkan answered yang datang setelahnya')
test('pernyataan tak memenuhi syarat disimpan tapi nilai peserta tidak berubah')
test('pernyataan dari peserta sesi yang sudah ditutup tetap diterima kalau started_at di dalam jendela')
test('durasi tidak pernah diambil dari badan permintaan walau dikirim')
test('pernyataan pertama yang memenuhi syarat menandai kontennya scored')
```

Tes keenam adalah aturan §5.7 "peserta yang sedang mengerjakan tidak diputus"; tes ketujuh menjaga §5.6.

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/api-xapi.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan `catatPernyataan` dan rute `POST /api/xapi`**

Penghitungan ulang membaca seluruh `xapi_events` peserta itu lalu memanggil `pilihNilaiResmi`; jangan menyalin aturannya ke SQL.

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

Run: `npm test -- tests/api-xapi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: penerima xAPI dan penghitungan nilai resmi"
```

---

### Task 10: Hasil peserta dan papan peringkat

**Files:**
- Create: `src/app/hasil/[token]/page.tsx`, `src/components/PapanPeringkat.tsx`
- Modify: `src/lib/repo/participants.ts`
- Test: `tests/peringkat.test.ts`

**Interfaces:**
- Consumes: `urutkanPeringkat` (Tugas 2), `pesertaDariToken` (Tugas 8)
- Produces: `peringkatSesi(sessionId: number): Promise<BarisPeringkat[]>` — hanya peserta dengan `finished_at` terisi.

Halaman menampilkan skor sendiri, durasinya, lalu papan peringkat **lengkap** dengan baris peserta sendiri ditandai.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
test('peringkatSesi hanya memuat peserta yang finished_at terisi')
test('peringkatSesi tidak mencampur peserta sesi lain')
test('urutan hasil query cocok dengan urutkanPeringkat untuk data yang sama')
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/peringkat.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan `peringkatSesi` lalu halaman hasil** — Review Focus #4

Kalau `contents.scoring = 'unscored'`, halaman ini **tidak** menampilkan papan peringkat dan **tidak** 404: ia menampilkan "selesai — sesi ini tanpa peringkat". Tambahkan tes halaman untuk kasus itu.

- [ ] **Step 4: Jalankan tes untuk memastikan lulus; periksa di peramban dengan tiga peserta berbeda**

Run: `npm test -- tests/peringkat.test.ts` → PASS
Expected di peramban: urutan skor lalu waktu benar, baris sendiri ditandai.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: halaman hasil peserta dan papan peringkat"
```

---

### Task 11: Pantau sesi, CSV, dan tutup cepat

**Files:**
- Create: `src/app/admin/sesi/[id]/page.tsx`, `src/app/admin/sesi/[id]/csv/route.ts`, `src/lib/csv.ts`
- Test: `tests/csv.test.ts`

**Interfaces:**
- Consumes: `peringkatSesi` (Tugas 10), `tutupSekarang` (Tugas 7)
- Produces: `buatCsvHasil(baris: (BarisPeringkat & { peringkat: number; durasi_ms: number })[]): string`

Halaman pantau: PIN, status, jumlah ikut/selesai, rata-rata, peringkat, daftar yang belum selesai, tombol Unduh CSV, tombol Tutup sekarang, dan hapus satu peserta. Untuk sesi tak berskor: daftar "sudah membuka" tanpa peringkat dan tanpa rata-rata.

CSV: kolom `peringkat,nama,skor,maksimum,durasi_detik,selesai_pada`; diawali BOM UTF-8; nama yang memuat koma atau tanda kutip dikutip sesuai RFC 4180.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
test('csv diawali BOM UTF-8')
test('nama dengan koma dikutip')
test('nama dengan tanda kutip ganda di-escape menjadi dua tanda kutip')
test('durasi ditulis dalam detik bulat')
test('baris mengikuti urutan peringkat')
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Run: `npm test -- tests/csv.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan `csv.ts`, rute unduhan, dan halaman pantau**

Rute CSV wajib memeriksa bahwa sesi itu milik penyelenggara yang masuk.

- [ ] **Step 4: Jalankan tes untuk memastikan lulus; unduh CSV dan buka di Excel**

Run: `npm test -- tests/csv.test.ts` → PASS
Expected: huruf beraksen dan nama berkoma tampil benar di Excel.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pantau sesi, unduh csv, dan tutup lebih cepat"
```

---

### Task 12: Jalan penuh dari ujung ke ujung

**Files:**
- Create: `tests/e2e-alur.test.ts`, `README.md`
- Test: berkas di atas

**Interfaces:**
- Consumes: semua tugas sebelumnya
- Produces: —

`README.md` memuat langkah pemasangan lokal: buat basis data, `.env.local`, `npm run migrate`, `node scripts/copy-h5p-core.mjs`, `node scripts/seed-teacher.mjs`, `npm run dev`.

- [ ] **Step 1: Tulis tes alur yang gagal**

```ts
test('unggah konten, buat sesi, dua peserta mengerjakan, peringkat benar',
  /* telan berkas dari konten/, buatSesi, mulaiPeserta x2, catatPernyataan x2,
     peringkatSesi → urutan sesuai skor lalu durasi */)
test('nama yang sama di sesi yang sama ditolak, alias lain diterima')
test('setelah tutupSekarang, peserta baru tidak bisa masuk tapi yang sedang jalan masih bisa menyetor nilai')
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal atau mengungkap celah sambungan**

Run: `npm test -- tests/e2e-alur.test.ts`
Expected: FAIL

- [ ] **Step 3: Perbaiki celah yang terungkap; jangan melonggarkan tes**

- [ ] **Step 4: Jalankan seluruh tes**

Run: `npm test`
Expected: semua PASS

- [ ] **Step 5: Tulis README lalu commit**

```bash
git add -A
git commit -m "feat: uji alur ujung ke ujung dan petunjuk pemasangan"
```
