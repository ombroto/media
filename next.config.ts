import { mkdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type { NextConfig } from 'next';

/**
 * Direktori artefak H5P disiapkan di sini — di luar bundel aplikasi.
 *
 * Alasannya penting: kalau src/ yang menyusun jalurnya dari process.cwd() atau
 * menyentuh berkas di sana, penelusuran statis Turbopack menyimpulkan seluruh
 * proyek bisa dibaca. Awalnya itu memunculkan peringatan "pattern matches 16979
 * files"; setelah jalurnya diketahui sebagai literal, Turbopack malah mencoba
 * membundel isi data/h5p dan membatalkan build.
 *
 * Pembuatan direktori dibungkus try/catch: di Vercel disknya hanya bisa dibaca,
 * dan di sana memang tidak ada yang perlu dibuat.
 */
const dirRelatif = process.env.H5P_DATA_DIR ?? './data/h5p';
const dirH5P = isAbsolute(dirRelatif) ? dirRelatif : resolve(process.cwd(), dirRelatif);

for (const sub of ['libraries', 'content', 'temp', 'hub-cache']) {
  try {
    mkdirSync(join(dirH5P, sub), { recursive: true });
  } catch {
    // Disk hanya bisa dibaca (produksi) — tidak apa-apa.
  }
}

const nextConfig: NextConfig = {
  serverExternalPackages: ['@lumieducation/h5p-server'],

  /**
   * Artefak H5P ikut dibawa ke dalam bundel fungsi.
   *
   * Pustaka tipe konten (3.341 berkas, 29 MB) dan berkas konten dibaca saat
   * menjalankan, dan disk Vercel di luar bundel tidak bisa ditulis — jadi
   * keduanya harus ada di sini, bukan dipasang saat berjalan. Aset inti klien
   * juga ikut, karena berkas di public/ disajikan CDN dan tidak selalu ada di
   * sistem berkas fungsi, sementara rute kita membacanya dari disk.
   *
   * Dipasang untuk semua rute ('/*') dengan sengaja: pustaka yang hilang baru
   * ketahuan sebagai pemutar kosong di produksi, dan itu mahal untuk dilacak.
   */
  outputFileTracingIncludes: {
    '/*': [
      'data/h5p/libraries/**/*',
      'data/h5p/content/**/*',
      'public/h5p-core/**/*',
    ],
  },
};

export default nextConfig;
