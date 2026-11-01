# Sesi H5P berbasis PIN

Unggah konten H5P, bagikan lewat PIN berjendela waktu, dan peserta
mengerjakannya lalu melihat peringkatnya.

- Penyelenggara masuk di `/admin/login`, mengunggah `.h5p` di `/admin/konten`,
  lalu membuat sesi dengan PIN dan tanggal buka/tutup.
- Peserta membuka `/`, memasukkan PIN, mengisi nama, mengerjakan, dan langsung
  melihat papan peringkat.

Rancangannya ada di
[docs/superpowers/specs/2026-11-01-h5p-pin-sessions-design.md](docs/superpowers/specs/2026-11-01-h5p-pin-sessions-design.md).

## Pemasangan lokal

Butuh Node 22+ dan PostgreSQL. Di Laragon keduanya sudah ada; pastikan layanan
PostgreSQL-nya berjalan.

```bash
npm install

# 1. Basis data
createdb -U postgres interactivemedia
createdb -U postgres interactivemedia_test

# 2. Berkas lingkungan
cp .env.example .env.local
#    lalu ganti SESSION_SECRET dengan teks acak yang panjang

# 3. Skema
npm run migrate

# 4. Aset inti klien H5P, disalin dari plugin Moodle mod_hvp di repositori ini
npm run h5p:core

# 5. Akun penyelenggara pertama (tidak ada halaman pendaftaran terbuka)
node scripts/seed-teacher.mjs anda@contoh.id "Nama Anda"

# 6. Jalankan
npm run dev
```

Lalu buka <http://localhost:3000>.

## Tentang pustaka H5P

Berkas `.h5p` yang diunduh dari internet umumnya **tidak menyertakan pustaka
tipe kontennya** — isinya hanya soal. Saat Anda mengunggah berkas seperti itu,
situs ini mengunduh pustaka yang kurang dari gudang resmi H5P
(`hub-api.h5p.org`), jadi **unggahan pertama butuh koneksi internet** dan bisa
memakan beberapa menit. Setelah pustakanya terpasang, memainkan konten tidak
butuh internet lagi.

Gudang H5P hanya melayani *tipe konten*, bukan sub-pustaka. Sub-pustaka yang
diminta konten (misalnya `H5P.AdvancedText`) dijemput lewat tipe konten
"payung" `H5P.Column`, yang membawa 90 pustaka sekaligus. Paket yang pernah
diunduh disimpan di `data/h5p/hub-cache/`.

Kalau sebuah konten meminta versi pustaka yang sudah tidak tersedia di gudang,
unggahannya gagal dengan pesan yang menyebut pustaka dan versinya. Jalan
keluarnya: unduh ulang kontennya dalam bentuk yang menyertakan pustaka
("export with libraries"), atau unggah berkas pustakanya langsung di kotak
unggah yang sama.

## Pengujian

```bash
npm test
```

Memakai basis data `interactivemedia_test` dan direktori H5P `data/h5p-test`,
terpisah dari data aplikasi. Sebagian tes benar-benar mengunduh pustaka dari
gudang H5P pada jalannya yang pertama.

## Perintah

| Perintah | Guna |
|---|---|
| `npm run dev` | server pengembangan |
| `npm run build` / `npm start` | bangun dan jalankan versi produksi |
| `npm run migrate` | pasang migrasi yang belum terpasang |
| `npm run h5p:core` | salin ulang aset inti klien H5P |
| `npm test` | seluruh pengujian |

## Catatan soal skor

Skor H5P dilaporkan dari peramban — itu melekat pada H5P, juga di Moodle.
Yang dilakukan situs ini: token peserta yang disimpan sebagai hash, satu baris
nilai per peserta, nama yang tidak bisa dipakai dua kali dalam satu sesi,
durasi yang selalu dihitung server, dan arsip pernyataan xAPI mentah untuk
audit. Cukup untuk pemakaian kelas; bukan untuk ujian berisiko tinggi.
