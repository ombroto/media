#!/usr/bin/env node
/**
 * Menyebutkan basis data mana yang sedang ditunjuk DATABASE_URL, dan apa
 * isinya.
 *
 * Dipakai sebelum migrasi atau pendaftaran konten: satu proyek Neon bisa punya
 * beberapa basis data dan beberapa cabang, dan menunjuk yang salah gagal
 * dengan cara yang membingungkan — entah "relation does not exist", entah
 * diam-diam menulis ke tempat yang tidak dilihat siapa pun.
 *
 * Pakai:
 *   $env:DATABASE_URL="..."; node scripts/periksa-db.mjs
 *
 * Tidak menulis apa pun.
 */
import pg from 'pg';

const url = process.env.DATABASE_URL ?? process.argv[2];
if (!url) {
  console.error('Pakai: node scripts/periksa-db.mjs [DATABASE_URL]');
  process.exit(1);
}

const tujuan = new URL(url);
console.log(`Inang     : ${tujuan.host}`);
console.log(`Basis data: ${tujuan.pathname.replace(/^\//, '')}`);
// Endpoint Neon tanpa akhiran -pooler membuat tiap instance fungsi membuka
// koneksinya sendiri sampai jatah habis.
if (tujuan.host.includes('neon.tech') && !tujuan.host.includes('-pooler')) {
  console.log('Catatan   : endpoint Neon ini BUKAN yang -pooler.');
}
console.log('');

async function isiTabel(klien) {
  const { rows: info } = await klien.query(
    'select current_database() as db, current_user as pemakai, version() as versi',
  );
  console.log(`Tersambung sebagai ${info[0].pemakai} ke ${info[0].db}`);
  console.log(info[0].versi.split(',')[0]);
  console.log('');

  const { rows: tabel } = await klien.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );

  if (tabel.length === 0) {
    console.log('Tidak ada tabel sama sekali di skema public.');
    console.log('Jalankan migrasinya: node scripts/migrate.mjs');
    return;
  }

  console.log(`Tabel (${tabel.length}):`);
  for (const t of tabel) {
    const { rows } = await klien.query(`select count(*)::int as n from "${t.table_name}"`);
    console.log(`  ${t.table_name.padEnd(20)} ${rows[0].n} baris`);
  }
}

const klien = new pg.Client({ connectionString: url });
await klien.connect();
try {
  await isiTabel(klien);
} finally {
  await klien.end();
}
