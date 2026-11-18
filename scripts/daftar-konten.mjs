#!/usr/bin/env node
/**
 * Mendaftarkan artefak H5P yang sudah ada di disk ke basis data.
 *
 * Kenapa perlu: unggahan menulis DUA tempat — berkas ke data/h5p/content/ dan
 * satu baris ke tabel contents. Berkasnya ikut ke produksi lewat git, tapi
 * barisnya tidak: ia mendarat di basis data yang sedang ditunjuk DATABASE_URL
 * saat mengunggah. Mengunggah di komputer sendiri lalu push membuat berkasnya
 * sampai di produksi tanpa barisnya, dan kontennya tidak muncul di sana.
 *
 * Skrip ini menutup celah itu: ia membaca h5p.json tiap folder konten dan
 * membuat baris yang hilang di basis data tujuan.
 *
 * Pakai:
 *   node scripts/daftar-konten.mjs <email-penyelenggara>              (laporan saja)
 *   node scripts/daftar-konten.mjs <email> <idKonten> [idKonten...]   (daftarkan)
 *   node scripts/daftar-konten.mjs <email> --semua                    (semua yang belum)
 *
 * Basis datanya diambil dari DATABASE_URL. Untuk produksi, setel ke Neon dulu.
 * Tanpa daftar id, skrip tidak menulis apa pun — folder konten biasanya
 * menyimpan sisa percobaan lama yang tidak semuanya pantas dihidupkan lagi.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { scoringAwal } from '../src/lib/scoring-awal.mjs';

const akar = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirKonten = join(akar, 'data', 'h5p', 'content');

/**
 * Isi satu folder konten, atau null kalau folder itu bukan konten H5P yang
 * utuh. Nama berkas sumbernya tidak tersimpan di artefak, jadi disusun dari
 * judulnya — hanya dipakai sebagai keterangan di halaman pustaka.
 *
 * @param {string} id
 * @returns {{ h5pContentId: string, title: string, mainLibrary: string, sourceFilename: string } | null}
 */
export function bacaKonten(id) {
  const berkas = join(dirKonten, id, 'h5p.json');
  if (!existsSync(berkas)) return null;

  let j;
  try {
    j = JSON.parse(readFileSync(berkas, 'utf8'));
  } catch {
    return null;
  }

  const title = String(j.title ?? '').trim();
  const mainLibrary = String(j.mainLibrary ?? '').trim();
  if (!title || !mainLibrary) return null;

  return { h5pContentId: id, title, mainLibrary, sourceFilename: `${title}.h5p` };
}

function kontenDiDisk() {
  if (!existsSync(dirKonten)) return [];
  return readdirSync(dirKonten, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => bacaKonten(d.name))
    .filter((k) => k !== null)
    .sort((a, b) => a.title.localeCompare(b.title, 'id'));
}

async function utama() {
  const [email, ...sisa] = process.argv.slice(2);
  if (!email) {
    console.error('Pakai: node scripts/daftar-konten.mjs <email-penyelenggara> [idKonten...|--semua]');
    process.exit(1);
  }

  const semua = sisa.includes('--semua');
  const diminta = new Set(sisa.filter((a) => a !== '--semua'));

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL belum disetel. Untuk produksi, setel ke Neon dulu.');
    process.exit(1);
  }

  // Tujuannya disebut di layar: skrip ini menulis ke basis data mana pun yang
  // sedang ditunjuk DATABASE_URL, dan keliru menunjuk yang salah adalah
  // kesalahan yang mudah dilakukan dan tidak mudah dilihat.
  const tujuan = new URL(url);
  console.log(`Basis data tujuan: ${tujuan.host}${tujuan.pathname}`);

  const klien = new pg.Client({ connectionString: url });
  await klien.connect();

  try {
    const { rows: guru } = await klien.query(
      'select id, name from teachers where lower(email) = lower(btrim($1))',
      [email],
    );
    if (guru.length === 0) {
      console.error(
        `Penyelenggara ${email} tidak ada di basis data ini. ` +
          'Buat dulu: node scripts/seed-teacher.mjs <email> "<nama>"',
      );
      process.exit(1);
    }
    const ownerId = guru[0].id;

    const { rows: adaBaris } = await klien.query('select h5p_content_id, title from contents');
    const sudah = new Map(adaBaris.map((r) => [r.h5p_content_id, r.title]));

    const disk = kontenDiDisk();
    const belum = disk.filter((k) => !sudah.has(k.h5pContentId));

    console.log(`Basis data ini sudah punya ${sudah.size} konten; di disk ada ${disk.length}.`);
    console.log('');

    for (const k of disk) {
      const tanda = sudah.has(k.h5pContentId) ? 'terdaftar' : 'BELUM    ';
      console.log(`  ${tanda}  ${k.h5pContentId}  ${k.mainLibrary.padEnd(32)} ${k.title}`);
    }
    // Arah sebaliknya, dan sama merepotkannya: baris yang berkasnya tidak ada.
    // Konten seperti ini tampil di halaman pustaka tapi gagal saat dibuka,
    // karena mesin H5P tidak menemukan artefaknya. Terjadi kalau folder
    // kontennya dihapus di komputer sendiri — atau tidak pernah ikut di-commit
    // — sementara barisnya tetap hidup di basis data.
    const diDisk = new Set(disk.map((k) => k.h5pContentId));
    const yatim = [...sudah.entries()].filter(([id]) => !diDisk.has(id));

    if (yatim.length > 0) {
      console.log('Baris yang berkasnya TIDAK ADA di disk — akan gagal saat dibuka:');
      for (const [id, judul] of yatim) console.log(`  hilang     ${id}  ${judul}`);
      console.log('');
    }

    if (belum.length === 0) {
      console.log('Tidak ada yang perlu didaftarkan.');
      return;
    }

    const akanDidaftar = semua ? belum : belum.filter((k) => diminta.has(k.h5pContentId));

    if (akanDidaftar.length === 0) {
      console.log(
        `${belum.length} konten belum terdaftar. Sebutkan id-nya untuk mendaftarkan, ` +
          'atau --semua untuk semuanya.',
      );
      return;
    }

    for (const k of akanDidaftar) {
      const { rows } = await klien.query(
        `insert into contents (owner_id, title, main_library, h5p_content_id, source_filename, scoring)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [ownerId, k.title, k.mainLibrary, k.h5pContentId, k.sourceFilename, scoringAwal(k.mainLibrary)],
      );
      console.log(`Didaftarkan (id ${rows[0].id}) untuk ${guru[0].name}: ${k.title}`);
    }

    const tidakKetemu = [...diminta].filter((id) => !belum.some((k) => k.h5pContentId === id));
    for (const id of tidakKetemu) {
      console.warn(`Dilewati ${id}: tidak ada di disk, atau sudah terdaftar.`);
    }
  } finally {
    await klien.end();
  }
}

// Hanya berjalan sebagai perintah, bukan saat diimpor oleh pengujian.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  await utama();
}
