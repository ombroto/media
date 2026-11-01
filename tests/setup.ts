import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgres://postgres@127.0.0.1:5432/interactivemedia_test';

// Artefak H5P untuk pengujian dipisah dari yang dipakai aplikasi, supaya tes
// boleh membersihkan pustaka tanpa mengganggu konten yang sudah diunggah.
process.env.H5P_DATA_DIR = process.env.H5P_DATA_DIR_TEST ?? './data/h5p-test';
// Aplikasi hanya menerima jalur absolut; pengubahannya dikerjakan di luar
// src/ supaya penelusuran statis Turbopack tidak menarik seluruh proyek.
process.env.H5P_DATA_DIR_ABS = resolve(process.cwd(), process.env.H5P_DATA_DIR);

for (const sub of ['libraries', 'content', 'temp', 'hub-cache']) {
  mkdirSync(join(process.env.H5P_DATA_DIR_ABS, sub), { recursive: true });
}
