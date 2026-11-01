#!/usr/bin/env node
/**
 * Membuat akun penyelenggara. Situs ini tidak punya halaman pendaftaran
 * terbuka (§7.1), jadi akun pertama dibuat dari sini.
 *
 * Pakai: node scripts/seed-teacher.mjs <email> "<nama>"
 * Kata sandi dibaca dari stdin supaya tidak tertinggal di riwayat perintah.
 */
import { createInterface } from 'node:readline';
import pg from 'pg';
import { hashKataSandi } from '../src/lib/password.mjs';

const PANJANG_MINIMAL = 10;

/**
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ id: number }> }> }} klien
 * @param {{ email: string, name: string, kataSandi: string }} data
 * @returns {Promise<number>} id penyelenggara
 */
export async function buatAtauPerbaruiPenyelenggara(klien, { email, name, kataSandi }) {
  const emailBersih = String(email ?? '').trim();
  if (!emailBersih.includes('@') || emailBersih.length < 3) {
    throw new Error(`Email tidak sah: ${emailBersih || '(kosong)'}`);
  }
  if (String(kataSandi ?? '').length < PANJANG_MINIMAL) {
    throw new Error(`Kata sandi minimal ${PANJANG_MINIMAL} karakter.`);
  }
  const namaBersih = String(name ?? '').trim();
  if (namaBersih.length === 0) {
    throw new Error('Nama tidak boleh kosong.');
  }

  const hash = await hashKataSandi(kataSandi);
  const { rows } = await klien.query(
    `insert into teachers (email, password_hash, name)
     values ($1, $2, $3)
     on conflict (email)
       do update set password_hash = excluded.password_hash, name = excluded.name
     returning id`,
    [emailBersih, hash, namaBersih],
  );
  // int8 dibaca pg sebagai string kalau parser belum dipasang.
  return Number(rows[0].id);
}

/** @returns {Promise<string>} */
function bacaKataSandi() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  return new Promise((res) => {
    process.stdout.write(`Kata sandi (minimal ${PANJANG_MINIMAL} karakter): `);
    rl.once('line', (baris) => {
      rl.close();
      res(baris.trim());
    });
  });
}

// Hanya berjalan sebagai perintah, bukan saat diimpor oleh pengujian.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Pakai: node scripts/seed-teacher.mjs <email> "<nama>"');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/interactivemedia';
  const kataSandi = await bacaKataSandi();

  const klien = new pg.Client({ connectionString: url });
  await klien.connect();
  try {
    const id = await buatAtauPerbaruiPenyelenggara(klien, { email, name, kataSandi });
    console.log(`Penyelenggara siap (id ${id}): ${email}`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await klien.end();
  }
}
