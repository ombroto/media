import { afterAll, beforeEach, expect, test } from 'vitest';
import { POST } from '@/app/api/konten/unggah/route';
import { NAMA_COOKIE_GURU, buatTokenSesi } from '@/lib/auth';
import { pool, query } from '@/lib/db';

beforeEach(async () => {
  process.env.SESSION_SECRET ??= 'rahasia-uji-yang-cukup-panjang';
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

function permintaanUnggah(token: string | null, berkas: File | null): Request {
  const data = new FormData();
  if (berkas) data.set('berkas', berkas);

  return new Request('http://localhost/api/konten/unggah', {
    method: 'POST',
    headers: token ? { cookie: `${NAMA_COOKIE_GURU}=${encodeURIComponent(token)}` } : {},
    body: data,
  });
}

const berkasDari = (buf: Buffer, nama: string) =>
  new File([new Uint8Array(buf)], nama, { type: 'application/zip' });

test('unggahan tanpa cookie penyelenggara dibalas 403', async () => {
  const res = await POST(permintaanUnggah(null, berkasDari(Buffer.from('x'), 'a.h5p')));
  expect(res.status).toBe(403);
});

test('unggahan tanpa berkas dibalas 400', async () => {
  const id = await buatGuru();
  const res = await POST(permintaanUnggah(buatTokenSesi(id), null));
  expect(res.status).toBe(400);
});

/**
 * Inti dari perbaikan ini: berkas di atas 1 MB harus SAMPAI ke lapisan
 * pemeriksaan dan ditolak dengan kalimat Indonesia, bukan mati sebagai 413
 * tanpa pesan sebelum kode kita berjalan. Dua dari sembilan berkas pemilik
 * berukuran 3,4 MB dan 8,5 MB.
 */
test('berkas 2 MB sampai ke pemeriksaan dan ditolak dengan alasan yang jelas', async () => {
  const id = await buatGuru();
  const besar = Buffer.alloc(2 * 1024 * 1024, 0x41); // 2 MB, jelas bukan zip

  const res = await POST(permintaanUnggah(buatTokenSesi(id), berkasDari(besar, 'besar.h5p')));
  const badan = (await res.json()) as { pesan?: string };

  expect(res.status).toBe(400);
  expect(badan.pesan).toMatch(/zip|arsip|rusak/i);
});

test('berkas di atas 64 MB ditolak dengan menyebut batasnya', async () => {
  const id = await buatGuru();
  const terlalu = Buffer.alloc(64 * 1024 * 1024 + 1);

  const res = await POST(permintaanUnggah(buatTokenSesi(id), berkasDari(terlalu, 'gendut.h5p')));
  const badan = (await res.json()) as { pesan?: string };

  expect(res.status).toBe(400);
  expect(badan.pesan).toMatch(/64\s*MB|terlalu besar/i);
});
