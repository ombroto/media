#!/usr/bin/env node
/**
 * Menyalin aset inti klien H5P dari plugin Moodle mod_hvp ke public/h5p-core.
 *
 * Alasan mengambil dari plugin dan bukan mengunduh: zip itu sudah ada di
 * repositori ini dan membawa core API 1.28 lengkap. Daftar WAJIB di bawah
 * adalah isi playerAssetList.json milik @lumieducation/h5p-server — kalau satu
 * saja hilang, pemutar akan tampil kosong, jadi skrip ini gagal keras.
 */
import { createWriteStream, existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = process.argv[2] ?? join(AKAR, 'mod_hvp_2026090101.zip');
const TUJUAN = join(AKAR, 'public', 'h5p-core');

const WAJIB = [
  'js/jquery.js',
  'js/h5p.js',
  'js/h5p-event-dispatcher.js',
  'js/h5p-x-api-event.js',
  'js/h5p-x-api.js',
  'js/h5p-content-type.js',
  'js/h5p-confirmation-dialog.js',
  'js/h5p-action-bar.js',
  'js/request-queue.js',
  'js/h5p-tooltip.js',
  'styles/h5p.css',
  'styles/h5p-confirmation-dialog.css',
  'styles/h5p-core-button.css',
  'styles/h5p-tooltip.css',
  'styles/h5p-table.css',
];

/** Membongkar hanya hvp/library/** dari zip ke direktori tujuan. */
async function bongkarLibrary(zipPath, keluar) {
  const zip = await new Promise((res, rej) =>
    yauzl.open(zipPath, { lazyEntries: true }, (e, z) => (e ? rej(e) : res(z))),
  );

  await new Promise((res, rej) => {
    zip.on('entry', (entry) => {
      const nama = entry.fileName;
      if (!nama.startsWith('hvp/library/')) return zip.readEntry();

      const relatif = nama.slice('hvp/library/'.length);
      const tujuan = join(keluar, relatif);

      if (nama.endsWith('/')) {
        mkdir(tujuan, { recursive: true }).then(() => zip.readEntry(), rej);
        return;
      }

      zip.openReadStream(entry, async (e, aliran) => {
        if (e) return rej(e);
        try {
          await mkdir(dirname(tujuan), { recursive: true });
          await pipeline(aliran, createWriteStream(tujuan));
          zip.readEntry();
        } catch (err) {
          rej(err);
        }
      });
    });
    zip.on('end', res);
    zip.on('error', rej);
    zip.readEntry();
  });
}

if (!existsSync(ZIP)) {
  console.error(`Zip plugin tidak ditemukan: ${ZIP}`);
  process.exit(1);
}

const sementara = await mkdtemp(join(tmpdir(), 'hvp-core-'));
try {
  await bongkarLibrary(ZIP, sementara);

  const hilang = WAJIB.filter((f) => !existsSync(join(sementara, f)));
  if (hilang.length) {
    console.error(
      `Aset inti yang diminta h5p-server tidak ada di plugin:\n  ${hilang.join('\n  ')}`,
    );
    process.exit(1);
  }

  await rm(TUJUAN, { recursive: true, force: true });
  await mkdir(TUJUAN, { recursive: true });
  for (const sub of ['js', 'styles', 'fonts', 'images']) {
    const dari = join(sementara, sub);
    if (existsSync(dari)) {
      await cp(dari, join(TUJUAN, sub), { recursive: true });
    }
  }

  console.log(`Aset inti H5P disalin ke public/h5p-core (${WAJIB.length} berkas wajib lengkap)`);
} finally {
  await rm(sementara, { recursive: true, force: true });
}
