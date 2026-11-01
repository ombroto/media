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
 * membundel isi data/h5p dan membatalkan build. Berkas konfigurasi ini dijalankan
 * Node biasa, baik saat build maupun saat server menyala, jadi di sinilah
 * tempatnya.
 */
const dirRelatif = process.env.H5P_DATA_DIR ?? './data/h5p';
const dirH5P = isAbsolute(dirRelatif) ? dirRelatif : resolve(process.cwd(), dirRelatif);

for (const sub of ['libraries', 'content', 'temp', 'hub-cache']) {
  mkdirSync(join(dirH5P, sub), { recursive: true });
}

// Dibaca aplikasi saat berjalan. Jangan disisipkan lewat `env:` di bawah —
// penyisipan literal itulah yang membuat Turbopack menelusuri direktorinya.
process.env.H5P_DATA_DIR_ABS = dirH5P;

const nextConfig: NextConfig = {
  serverExternalPackages: ['@lumieducation/h5p-server'],
};

export default nextConfig;
