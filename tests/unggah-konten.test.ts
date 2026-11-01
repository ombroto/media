import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { pool, query } from '@/lib/db';
import { daftarKonten } from '@/lib/repo/contents';
import { telanDanSimpan } from '@/lib/unggah-konten';

const CROSSWORD = join(process.cwd(), 'konten', 'example-content-crossword-1209160.h5p');

beforeEach(async () => {
  await query(
    'truncate xapi_events, participants, quiz_sessions, contents, teachers restart identity cascade',
  );
});

afterAll(async () => {
  await pool.end();
});

async function buatGuru() {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ('guru@contoh.id', 'x', 'Bu Guru') returning id`,
  );
  return g.id;
}

function berkasDari(buf: Buffer, nama: string): File {
  return new File([new Uint8Array(buf)], nama, { type: 'application/zip' });
}

test(
  'berkas .h5p yang sah tersimpan sebagai konten milik penyelenggara',
  async () => {
    const guru = await buatGuru();

    const hasil = await telanDanSimpan(
      guru,
      berkasDari(readFileSync(CROSSWORD), 'crossword.h5p'),
    );

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.hanyaPustaka).toBe(false);
    expect(hasil.judul).toBe('Crossword');

    const daftar = await daftarKonten(guru);
    expect(daftar).toHaveLength(1);
    expect(daftar[0]).toMatchObject({
      main_library: 'H5P.Crossword',
      source_filename: 'crossword.h5p',
      owner_id: guru,
    });
  },
  900000,
);

test('berkas cacat tidak meninggalkan baris konten apa pun', async () => {
  const guru = await buatGuru();

  const hasil = await telanDanSimpan(guru, berkasDari(Buffer.from('bukan zip'), 'rusak.h5p'));

  expect(hasil.ok).toBe(false);
  expect(await daftarKonten(guru)).toEqual([]);
});

test('berkas kosong ditolak sebelum menyentuh H5P', async () => {
  const guru = await buatGuru();

  const hasil = await telanDanSimpan(guru, berkasDari(Buffer.alloc(0), 'kosong.h5p'));

  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.pesan).toMatch(/kosong|pilih/i);
});

test(
  'paket yang hanya berisi pustaka tidak menambah baris konten',
  async () => {
    const guru = await buatGuru();
    const zip = new JSZip();
    zip.file(
      'h5p.json',
      JSON.stringify({
        title: 'Hanya Pustaka',
        preloadedDependencies: [
          { machineName: 'H5P.Crossword', majorVersion: '0', minorVersion: '5' },
        ],
      }),
    );
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    const hasil = await telanDanSimpan(guru, berkasDari(buf, 'pustaka.h5p'));

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.hanyaPustaka).toBe(true);
    expect(await daftarKonten(guru)).toEqual([]);
  },
  900000,
);
