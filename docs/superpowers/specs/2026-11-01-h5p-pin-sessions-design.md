# Desain: Website Sesi H5P berbasis PIN

Tanggal: 2026-11-01
Status: disetujui untuk direncanakan

## 1. Maksud dan alasannya

Penyelenggara (untuk sekarang satu orang: pemilik proyek, seorang pengajar) punya
koleksi konten interaktif H5P dan ingin membagikannya ke peserta tanpa harus
memasang Moodle atau LMS apa pun. Pola yang diinginkan sederhana: pilih satu
konten, dapatkan PIN, bagikan PIN itu (lewat WhatsApp dan sejenisnya), peserta
mengerjakan kapan saja selama jendela waktunya terbuka, lalu melihat posisinya di
papan peringkat.

Yang membuat ini bernilai bukan "menjalankan H5P" — itu sudah bisa dilakukan
banyak alat — tapi **lapisan kompetisinya**: PIN, nama alias, dan peringkat yang
langsung terlihat begitu selesai. Itu yang mengubah latihan jadi sesuatu yang mau
diulang peserta.

Mengapa sekarang: koleksi konten sudah ada (9 file `.h5p` di `konten/`), dan
pemilik ingin memakainya untuk sesi nyata, bukan sekadar mencoba.

## 2. Tujuan

1. Penyelenggara dapat mengunggah file `.h5p` dan memainkannya di situs ini,
   termasuk file yang **tidak membawa pustaka tipe kontennya** — pustaka yang
   hilang diunduh sendiri oleh sistem dari gudang resmi H5P.
2. Satu konten dapat dipakai untuk banyak sesi berbeda, masing-masing dengan PIN
   dan jendela waktu sendiri.
3. Peserta masuk hanya dengan PIN dan sebuah nama; tidak ada pendaftaran akun.
4. Skor dan waktu pengerjaan tercatat otomatis dari konten H5P, tanpa tombol
   "kirim" buatan sendiri.
5. Peringkat terlihat peserta segera setelah ia selesai, diurutkan skor lalu
   waktu tercepat.
6. Penyelenggara dapat melihat daftar sesinya, memantau hasil, mengubah, dan
   menghapus sesi, serta mengunduh hasil sebagai CSV.

### Bukan tujuan

- **Mengarang/menyunting konten H5P di situs ini.** Konten dibuat di tempat lain
  (h5p.org, Lumi, H5P.com) lalu diunggah. Editor H5P tidak dipasang sama sekali.
- **Akun untuk peserta.** Tidak ada kata sandi, profil, atau riwayat lintas sesi
  bagi peserta.
- **Banyak konten dalam satu sesi.** Satu sesi = satu konten. (Ini revisi
  eksplisit dari pemilik di tengah pembahasan.)
- **Melanjutkan pekerjaan dengan nama yang sama.** Nama unik per sesi; ikut lagi
  berarti pakai alias lain.
- **Analitik mendalam per soal** (laporan xAPI rinci seperti `review.php` milik
  mod_hvp). Pernyataan xAPI mentah disimpan supaya bisa dipakai nanti, tapi tidak
  ditampilkan.
- **Penempatan ke server publik.** Untuk sekarang berjalan lokal di Laragon.
- **Manajemen akun guru.** Struktur datanya disiapkan (lihat §6), tapi antarmuka
  pembuatan akun guru tidak dibangun sekarang.

### Anti-tujuan — yang membuat ini gagal walau "jalan"

- **Papan peringkat yang tidak bisa dipercaya.** Peringkat yang ngawur (skor
  ganda dari satu orang, waktu yang salah hitung, peserta yang belum selesai
  ikut terperingkat) lebih buruk daripada tidak ada peringkat.
- **Konten yang gagal tampil tanpa penjelasan.** Pesan "error" buntu saat upload
  atau saat peserta membuka konten akan membunuh pemakaiannya. Setiap kegagalan
  pustaka harus berakhir pada kalimat yang bisa ditindaklanjuti.
- **Peserta terkunci di luar percobaannya sendiri.** Menyegarkan halaman atau
  ponsel yang mengunci layar tidak boleh membuat ia kehilangan identitas,
  nilainya yang sudah masuk, atau terpaksa memakai alias baru. Isian H5P-nya
  sendiri memang dimuat ulang dari awal — itu pilihan sadar, dan harus
  diperingatkan di muka. Lihat §7.4.
- **Penyelenggara harus menyentuh terminal untuk operasi sehari-hari** (memasang
  pustaka, membereskan berkas). Semua lewat antarmuka web.

## 3. Batasan

- Berjalan lokal di Laragon, Windows 11. Sudah tersedia: **Node 22.21.1**,
  **npm 10.9.4**, **PostgreSQL 18.0**. Tidak perlu memasang runtime baru.
- Tumpukan ditentukan pemilik: **Next.js + PostgreSQL**.
- Jalur berkas Windows (`C:\...`) dan penanganan path harus aman di Windows;
  pustaka H5P banyak bermain dengan path relatif di dalam zip.
- Perlu koneksi internet **saat upload** konten yang pustakanya belum ada.
  Setelah pustaka terpasang, memainkan konten tidak butuh internet (kecuali
  konten itu sendiri menarik video dari luar, misalnya YouTube).
- Proyek ini **belum repositori git**. Dokumen ini hidup di
  `docs/superpowers/specs/`; inisialisasi git diserahkan ke pemilik.

## 4. Temuan penting dari pembedahan `mod_hvp_2026090101.zip`

Hasil ini mengubah desain, jadi dicatat di sini:

1. **Plugin itu membawa pustaka inti H5P lengkap dalam PHP** di `hvp/library/`
   (`H5PCore`, `H5PValidator`, `H5PStorage`, core API **1.28**), plus aset klien
   (`library/js/*`, `library/styles/*`, `fonts/`, `images/`) dan
   `xapi-collector.js`. Karena tumpukan yang dipilih adalah Next.js, **sisi PHP
   tidak dipakai** — penggantinya `@lumieducation/h5p-server`. Tapi **aset klien
   dan polanya tetap dipakai** (lihat §5.2 dan §7.3).
2. **Cara skor ditangkap** (dari `xapi-collector.js`): berlangganan
   `H5P.externalDispatcher.on('xAPI', …)`, lalu **hanya ambil pernyataan dengan
   verb `answered` atau `completed` yang bukan anak** (tidak punya
   `context.contextActivities.parent`). Nilainya ada di `result.score.raw` dan
   `result.score.max`. Pola inilah yang ditiru.
3. **Sembilan file `.h5p` milik pemilik tidak membawa pustaka.** Isi setiap arsip
   hanya `h5p.json` + `content/`. Jadi tanpa mekanisme unduh pustaka, **tidak
   satu pun bisa dimainkan**. Ini sebabnya unduh otomatis dari gudang H5P jadi
   bagian wajib, bukan kemewahan.
4. **Titik unduh pustaka sudah diverifikasi bekerja:**
   `https://hub-api.h5p.org/v1/content-types/<machineName>` (perhatikan
   `hub-api`, bukan `api` — `api.h5p.org` membalas HTTP 500). Uji nyata:
   `H5P.Crossword` → 1.111.787 byte, 198 berkas, memuat `H5P.Crossword-0.5`
   persis versi yang diminta konten pemilik, beserta 12 pustaka turunan.

## 5. Keputusan yang sudah diambil

### 5.1 Tumpukan

| Bagian | Pilihan | Catatan |
|---|---|---|
| Kerangka web | **Next.js (App Router) + TypeScript** | keputusan pemilik |
| Basis data | **PostgreSQL 18** | keputusan pemilik |
| Mesin H5P | **`@lumieducation/h5p-server` 10.0.4** | pilihan saya; padanan resmi Node untuk `h5p-php-library`, sudah mendukung unduh dari hub |
| Penyimpanan berkas H5P | **berkas di disk** (`FileLibraryStorage` + `FileContentStorage`) | pilihan saya; §5.3 |
| Akses basis data | diserahkan ke pembangun | §9 |
| Autentikasi penyelenggara | sesi cookie sendiri, kata sandi di-hash | pilihan saya; §7.1 |

Pembagian tegas: **Postgres memegang data aplikasi** (akun, sesi, peserta, nilai);
**disk memegang artefak H5P** (pustaka dan berkas konten). Jangan menaruh berkas
pustaka H5P di Postgres — tidak ada untungnya dan menyulitkan penyajian aset.

### 5.2 Aset inti klien H5P

`@lumieducation/h5p-server` butuh berkas inti H5P (JS/CSS pemutar) disajikan ke
peramban. Biasanya diunduh terpisah dari rilis GitHub. **Ambil dari plugin yang
sudah ada**: `hvp/library/js`, `hvp/library/styles`, `hvp/library/fonts`,
`hvp/library/images` → salin ke lokasi aset inti yang dibaca h5p-server.
Alasannya: versinya pasti (core API 1.28), tidak perlu unduhan tambahan, dan
sudah teruji berpasangan dengan pustaka dari hub yang sama.

**Berkas editor tidak diperlukan** — tidak ada pengarangan. Ini memangkas
dependensi dan ukuran proyek secara berarti.

**Kalau ternyata tidak cocok, boleh berpaling.** *Keputusan saya:* jalur
"salin dari plugin" adalah pilihan utama, **bukan** keharusan. Kalau pada langkah
1 (§8) ternyata `@lumieducation/h5p-server` 10.0.4 mengharap versi aset inti yang
lain dan pemutarnya tampil kosong, pembangun **boleh** mengunduh rilis resmi
`h5p-php-library` yang cocok dengan h5p-server dan memakai itu. Batasan "tanpa
unduhan" di §3 berlaku untuk **menjalankan** konten sehari-hari, bukan untuk
penyiapan sekali jalan. Pemutar kosong adalah anti-tujuan; kecocokan versi
menang atas kerapian asal berkas.

### 5.3 Tata letak penyimpanan

```
data/h5p/libraries/      pustaka tipe konten terpasang (dibagi semua konten)
data/h5p/content/        parameter + berkas media per konten
data/h5p/temp/           area kerja unggahan
public/h5p-core/         aset inti klien, disalin dari plugin Moodle
```

`data/` tidak masuk git dan tidak disajikan langsung sebagai statik; berkas
konten keluar lewat titik akhir H5P (§7.3) supaya bisa dikontrol.

### 5.4 Alur unggah konten, termasuk unduh pustaka

Ini bagian paling berisiko, jadi urutannya ditetapkan di sini:

1. Terima berkas `.h5p`. Tolak kalau bukan zip yang sah, atau melebihi batas
   ukuran (tetapkan dari `konten/` terbesar: 8,5 MB → pakai batas **64 MB**).
2. Baca `h5p.json` dari dalam arsip **tanpa** memasang apa pun. Ambil
   `mainLibrary` dan `preloadedDependencies`.
3. Bandingkan dengan pustaka yang sudah terpasang di `data/h5p/libraries/`.
4. Untuk tiap pustaka yang hilang, **unduh dan pasang dari gudang H5P**
   (`installLibraryFromHub`, yang di balik layar memakai titik akhir §4.4).
   Tampilkan kemajuannya ke penyelenggara seperti catatan berjalan — temuan §4.3
   berarti ini akan terjadi pada **semua** konten pemilik saat ini, jadi
   tampilannya bukan kasus pinggir, melainkan jalur utama.
5. Baru setelah itu pasang paketnya (`uploadPackage` → `saveOrUpdateContent`).
6. Catat barisnya di tabel `contents`.

**Risiko yang harus ditangani pembangun, bukan diabaikan:** gudang H5P selalu
memberi **versi terbaru** sebuah tipe konten, sementara konten hanya mau
dimainkan oleh pustaka dengan **mayor.minor yang sama persis**. Hari ini uji
Crossword cocok (konten minta 0.5, hub memberi 0.5), tapi suatu saat hub bisa
sudah di 0.6 sementara konten minta 0.5. Kalau itu terjadi, upload harus gagal
dengan kalimat yang jelas — menyebut pustaka dan versi yang diminta versus yang
tersedia, dan menyarankan mengunduh ulang kontennya dalam bentuk yang menyertakan
pustaka ("export with libraries") lalu mengunggahnya kembali. Yang dilarang:
gagal diam-diam, atau memasang versi yang salah lalu membiarkan peserta melihat
halaman kosong.

Dua penangkal untuk itu, **keputusan saya**, karena saran "ekspor ulang" di atas
sering tidak bisa dijalankan — konten contoh yang diunduh dari internet tidak
dimiliki penyelenggara, jadi ia tak punya tempat untuk mengekspornya ulang:

1. **Simpan paket pustaka yang pernah diunduh** di `data/h5p/hub-cache/`. Begitu
   sebuah versi pernah berhasil diambil dari gudang, ia tetap tersedia walau
   gudangnya sudah bergerak maju. Ini mengubah masalah "versi hub sudah berbeda"
   dari buntu menjadi jarang.
2. **Halaman unggah yang sama juga menerima berkas pustaka.** Kalau `.h5p` yang
   diunggah ternyata hanya berisi pustaka tanpa konten, pasang pustakanya dan
   katakan begitu. Tidak ada halaman baru — ini tetap satu kotak unggah di
   `/admin/konten`, sehingga penyelenggara punya jalan keluar manual tanpa
   menyentuh terminal, sesuai anti-tujuan §2.

### 5.5 Konten tanpa skor

Sebagian tipe H5P tidak pernah mengirim skor (Memory Game, Dialog Cards). Sesi
berperingkat di atasnya tidak ada artinya. Keputusan: deteksi dan **tandai**
konten seperti itu di pustaka, dan **peringatkan** penyelenggara sebelum ia
membuat sesi dari konten itu — tapi **jangan dilarang**. Penandaannya: kolom
`contents.scoring` bernilai `scored` / `unscored` / `unknown`; nilai awal
`unknown`, dan menjadi pasti setelah pernyataan xAPI pertama dari konten itu
masuk (atau lewat daftar tipe yang diketahui tak berskor — pilihan pembangun).

**Sesi dari konten tak berskor tidak punya papan peringkat sama sekali**
(keputusan pemilik). Konten tetap bisa dibagikan lewat PIN dan dinikmati peserta;
yang dilihat penyelenggara hanya **daftar siapa saja yang sudah membuka**, dan
peserta tidak melihat halaman peringkat setelahnya. Konsekuensinya penting untuk
pembangun: **tidak ada tombol "saya selesai" di mana pun**, dan untuk konten
semacam ini `finished_at`, `score_raw`, `score_max` memang tetap kosong
selamanya — itu keadaan normal, bukan kerusakan. Jangan membuat peringkat
berbasis waktu sebagai gantinya, dan jangan menampilkan peserta tak berskor
sebagai "belum selesai" dengan nada gagal; sebut saja "sudah membuka".

### 5.6 Aturan skor dan peringkat

- Satu peserta = satu baris nilai. Yang disimpan: `score_raw`, `score_max`,
  `started_at`, `finished_at`.
- **Waktu pengerjaan dihitung server**: `finished_at - started_at`, keduanya cap
  waktu server. Jangan percaya durasi dari peramban.
- `started_at` ditetapkan saat peserta menekan "Mulai" (bukan saat memasukkan
  PIN).
- **Pernyataan mana yang menentukan nilai** (keputusan pemilik, menggantikan
  aturan "yang pertama menang" di rancangan awal). Beberapa konten pemilik —
  Interactive Video, Drag and Drop, Find the Words, Image Sequencing, Image
  Multiple Hotspot — mengirim nilai beberapa kali selama dikerjakan, sehingga
  "yang pertama menang" akan mengunci peserta di nilai parsial. Aturannya:

  1. Semua pernyataan yang memenuhi syarat §4.2 disimpan di `xapi_events`.
  2. Nilai resmi **dihitung ulang** dari kumpulan itu setiap kali ada yang masuk:
     - kalau ada pernyataan berverb **`completed`**, pakai yang **terakhir**;
     - kalau tidak ada, pakai pernyataan dengan **`result.score.max` terbesar**
       (yaitu yang cakupan soalnya paling luas), dan kalau masih seri, yang
       **terakhir masuk**.
  3. `finished_at` = `received_at` dari pernyataan yang terpilih itu.

  Jadi nilai peserta boleh naik selama ia masih mengerjakan. Yang tetap dijaga:
  satu peserta hanya punya **satu** baris nilai, dan nama tak bisa dipakai dua
  kali, sehingga tidak ada yang bisa menumpuk percobaan untuk mengangkat
  peringkatnya. Fungsi pemilih ini harus murni dan teruji — ia jantung dari
  anti-tujuan "peringkat yang bisa dipercaya".
- Urutan peringkat: `score_raw` menurun → durasi menaik → `finished_at` menaik.
  Dua yang terakhir sebagai pemecah seri, sesuai keputusan pemilik ("waktu
  pengerjaan kalau skor sama").
- **Hanya peserta yang selesai yang diperingkat.** Yang berhenti di tengah
  tersimpan dan terlihat penyelenggara sebagai "belum selesai", tanpa nomor
  peringkat.
- Peringkat ditampilkan **lengkap** (semua peserta), bukan 10 teratas, dengan
  baris peserta sendiri ditandai.

### 5.7 PIN dan jendela waktu

- PIN **6 angka**, dibuat otomatis, boleh diganti penyelenggara.
- **Unik di seluruh tabel sesi**, ditegakkan dengan indeks unik biasa pada kolom
  `pin`. *Keputusan saya, mengganti gagasan awal "unik hanya di antara sesi yang
  belum selesai".* Alasannya: status sesi dihitung dari waktu (lihat di bawah),
  dan Postgres tidak menerima indeks unik parsial yang bergantung pada `now()`,
  jadi rancangan awal itu memang tidak bisa dibangun. Menjadikan PIN unik
  selamanya berarti PIN lama tak bisa dipakai ulang — dengan sejuta kombinasi dan
  satu penyelenggara, itu tidak jadi masalah nyata, dan sebagai gantinya kita
  bebas dari kemungkinan tabrakan PIN saat tanggal sebuah sesi diubah.
- `closes_at` **wajib ada** — tidak ada sesi tanpa batas akhir. *Keputusan saya;*
  sesi terbuka selamanya akan menggantung di daftar dan mengaburkan arti statusnya.
- Status sesi **dihitung** dari `opens_at`, `closes_at`, dan `closed_early_at` —
  bukan kolom yang disunting tangan. Terjadwal / berjalan / selesai.
- Di luar jendela waktu, halaman PIN menolak dengan pesan yang membedakan "belum
  dibuka" dan "sudah ditutup", dan menyebutkan tanggalnya.
- **Peserta yang sedang mengerjakan saat jendela tertutup tidak diputus.**
  *Keputusan saya.* Yang dikunci adalah **pintu masuk**: setelah `closes_at` atau
  `closed_early_at`, PIN tidak menerima peserta baru dan tidak ada `started_at`
  baru. Tapi nilai yang datang dari peserta yang `started_at`-nya **di dalam**
  jendela tetap diterima dan tetap diperingkat, walau tiba setelah penutupan.
  Memutus orang di tengah pekerjaan melanggar anti-tujuan §2, sementara menerima
  nilainya tidak merusak kepercayaan peringkat — ia sudah masuk secara sah dan
  jamnya tetap dihitung server.
- Waktu disimpan sebagai `timestamptz`; antarmuka memakai zona waktu lokal mesin
  (Asia/Jakarta). *Keputusan saya, karena pemakaiannya lokal dan satu zona.*

### 5.8 Nama peserta

- Wajib, dan **unik per sesi**, dibandingkan tanpa memandang besar-kecil huruf
  dan spasi di ujung. Ditolak dengan pesan yang menyuruh pakai alias lain
  (keputusan pemilik).
- Keunikannya ditegakkan **di basis data** (indeks unik), bukan hanya diperiksa di
  aplikasi — dua orang bisa menekan "Mulai" pada saat yang sama.
- Batas panjang 40 karakter; saring karakter kendali. *Keputusan saya.*

## 6. Model data

Bentuk logisnya; nama boleh disesuaikan pembangun.

```
teachers      id, email (unik), password_hash, name, created_at
              → satu baris saja untuk sekarang; kolom pemilik sudah ada di
                mana-mana supaya akun guru bisa ditambah nanti tanpa migrasi besar

contents      id, owner_id→teachers, title, main_library, h5p_content_id,
              scoring ('scored'|'unscored'|'unknown'), source_filename,
              created_at

quiz_sessions id, owner_id→teachers, content_id→contents, title,
              pin, opens_at, closes_at (NOT NULL), closed_early_at, created_at
              → indeks unik biasa pada pin (unik selamanya, §5.7)

participants  id, session_id→quiz_sessions, alias, started_at, finished_at,
              score_raw, score_max, token_hash
              → indeks unik (session_id, lower(trim(alias)))

xapi_events   id, participant_id→participants, statement jsonb, received_at
              → arsip mentah; tidak ditampilkan, tapi menyelamatkan kalau
                aturan skor perlu dihitung ulang
```

Penghapusan sesi menghapus `participants` dan `xapi_events` miliknya (cascade),
tapi **tidak** menyentuh `contents`.

## 7. Perilaku yang ditetapkan

### 7.1 Autentikasi penyelenggara

Satu akun, email + kata sandi, hash kuat (argon2 atau bcrypt), sesi lewat cookie
`httpOnly`. Akun pertama dibuat lewat skrip penyemaian, bukan halaman pendaftaran
terbuka — situs ini nanti bisa diakses orang lain, dan halaman daftar terbuka
berarti siapa pun bisa jadi guru. *Keputusan saya.*

### 7.2 Halaman

| Jalur | Untuk | Isi |
|---|---|---|
| `/` | peserta | kotak PIN |
| `/j/[pin]` | peserta | info sesi + isi nama → mulai |
| `/play/[participantToken]` | peserta | pemutar H5P + penghitung waktu |
| `/hasil/[participantToken]` | peserta | skor sendiri + papan peringkat lengkap — hanya untuk konten berskor (§5.5) |
| `/admin` | penyelenggara | **daftar sesi** + saringan status + tombol Pantau/Ubah/Hapus |
| `/admin/konten` | penyelenggara | pustaka konten + unggah |
| `/admin/sesi/baru` | penyelenggara | buat sesi |
| `/admin/sesi/[id]` | penyelenggara | pantau: peringkat, yang belum selesai, CSV, tutup lebih cepat |
| `/admin/sesi/[id]/ubah` | penyelenggara | judul, tanggal, PIN |

Antarmuka berbahasa **Indonesia**. Tata letak harus pakai di ponsel — peserta
akan membuka dari ponsel setelah menerima PIN di WhatsApp.

### 7.3 Menjalankan konten

- Pemutar dirender server-side lewat `H5PPlayer` dari h5p-server, dengan aset
  inti dari `public/h5p-core` (§5.2).
- Titik akhir H5P (`/h5p/ajax`, berkas konten, berkas pustaka) dipasang sebagai
  route handler Next.js yang meneruskan ke `H5PAjaxEndpoint`.
- **Titik akhir itu tidak anonim.** *Keputusan saya,* menjawab "supaya bisa
  dikontrol" di §5.3 dengan isi yang konkret: setiap permintaan ke berkas konten
  harus datang dari **penyelenggara yang sudah masuk**, atau dari **token peserta
  yang sah pada sesi yang jendelanya terbuka**. Tanpa itu, siapa pun yang menebak
  nomor konten bisa membuka isi kuis sebelum sesinya dibuka — dan PIN jadi tak ada
  artinya. Berkas **pustaka** boleh lebih longgar (ia kode tipe konten, sama untuk
  semua orang, dan jumlah permintaannya banyak), tapi berkas **konten** tidak.
  Pembangun perlu memastikan URL yang dihasilkan pemutar ikut membawa atau
  mewarisi izin ini; ini keputusan lintas-aplikasi yang murah sekarang dan mahal
  kalau ditambal belakangan.
- Skor ditangkap di klien dengan pola §4.2, lalu dikirim ke titik akhir sendiri
  (`POST /api/xapi`) berisi token peserta + pernyataan. **Server** yang
  menentukan nilai dan waktu, bukan klien.
- Catatan jujur soal keamanan: skor H5P pada dasarnya dilaporkan klien — peserta
  yang paham peramban bisa memalsukannya. Itu melekat pada H5P, juga di Moodle.
  Yang kita lakukan: token peserta yang ditandatangani, satu nilai per peserta
  (§5.6), durasi dihitung server, dan arsip xAPI mentah untuk audit. Untuk
  pemakaian kelas, itu cukup; jangan dijual sebagai ujian berisiko tinggi.

### 7.4 Menyegarkan halaman dan kembali

Saat peserta menekan "Mulai", server membuat token peserta, menaruhnya di cookie,
dan mengalihkan ke `/play/[token]`. Membuka token itu lagi masuk kembali sebagai
peserta yang sama, dengan `started_at` yang sama — **jamnya terus berjalan**.

**Isian H5P-nya tidak dipulihkan** (keputusan pemilik): kontennya dimuat dari
awal. Penyimpanan keadaan H5P per peserta (`IContentUserDataStorage`) **tidak**
dibangun, dan itu memangkas satu tabel plus satu mekanisme identitas H5P
per-peserta.

Karena konsekuensinya ditanggung peserta, hal ini wajib **dikatakan di muka**:
di halaman isi nama (§7.2, `/j/[pin]`) ada peringatan jelas bahwa pekerjaan
sebaiknya diselesaikan sekali jalan, dan menutup atau menyegarkan halaman berarti
mengulang kontennya sementara waktunya tetap berjalan. *Peringatan itu keputusan
saya;* tanpanya pilihan ini terasa seperti kerusakan.

Token yang percobaannya sudah selesai mengarah ke halaman hasil.

Catatan untuk pembangun: identitas pengguna H5P yang diteruskan ke pemutar harus
tetap **peserta**, bukan pemilik konten — satu konten dipakai banyak sesi, dan
identitas yang salah akan mencampur keadaan antar peserta begitu nanti ada fitur
yang menyimpan apa pun per pengguna.

### 7.5 Ubah dan hapus sesi

- Mengubah PIN sesi yang sudah punya peserta: minta konfirmasi, jelaskan PIN lama
  langsung tak berlaku.
- Menghapus sesi: konfirmasi dengan mengetik nama sesinya, karena seluruh nilai
  peserta ikut hilang. Konten tetap di pustaka.
- Menutup lebih cepat: satu tombol, mengisi `closed_early_at`.

### 7.6 CSV

Satu baris per peserta: nama, skor, maksimum, durasi (detik), selesai pada,
peringkat. Pemisah dan pengodean yang aman dibuka Excel Indonesia — sertakan BOM
UTF-8. *Keputusan saya.*

## 8. Urutan yang disarankan

Tulang punggungnya adalah H5P; sisanya pekerjaan biasa. Buktikan bagian berisiko
lebih dulu:

1. Satu konten dari `konten/` **tampil dan memancarkan skor** di halaman Next.js
   — termasuk unduh pustaka dari hub. Sebelum ini jalan, jangan bangun yang lain.
2. Skema basis data + autentikasi penyelenggara.
3. Pustaka konten (unggah + tandai skor).
4. Sesi: buat, daftar, ubah, hapus.
5. Alur peserta: PIN → nama → kerjakan → hasil.
6. Peringkat + pantau + CSV.

## 9. Yang diserahkan ke pembangun

- Cara akses basis data (SQL langsung, Drizzle, Prisma) dan alat migrasi.
- Pustaka komponen/gaya, selama hasilnya nyaman di ponsel dan berbahasa
  Indonesia.
- Bentuk pengujian. Yang wajib diuji: pemilih nilai resmi §5.6 (utamakan
  `completed` terakhir, kalau tidak ada ambil `score.max` terbesar, seri →
  terakhir masuk), pengurutan peringkat beserta pemecah serinya,
  keunikan nama di bawah dua permintaan bersamaan, dan perhitungan status sesi di
  tepi jendela waktu.
- Cara menampilkan kemajuan unduh pustaka (polling, streaming, atau sekadar
  blokir dengan penjelasan) — asalkan penyelenggara tahu apa yang sedang terjadi
  dan apa yang gagal.
- Penanganan berkas media besar di dalam `.h5p` (contoh 8,5 MB) dan batas unggah
  Next.js.
