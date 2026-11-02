import { afterAll, beforeEach, expect, test } from 'vitest';
import { pool, query } from '@/lib/db';
import { hapusKontenLengkap } from '@/lib/hapus-konten';
import { daftarKonten, simpanKonten } from '@/lib/repo/contents';

beforeEach(async () => {
  await query(
    'truncate xapi_events, participants, quiz_sessions, contents, teachers restart identity cascade',
  );
});

afterAll(async () => {
  await pool.end();
});

async function buatGuru(email = 'guru@contoh.id') {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ($1, 'x', 'Bu Guru') returning id`,
    [email],
  );
  return g.id;
}

const konten = (judul = 'Crossword') => ({
  title: judul,
  mainLibrary: 'H5P.Crossword',
  // Nomor konten yang tidak ada di disk: penghapusan berkas harus tetap
  // menghasilkan ok, karena berkasnya memang boleh saja sudah tidak ada.
  h5pContentId: '9999999999',
  sourceFilename: 'a.h5p',
});

test('menghapus konten milik sendiri berhasil walau berkas H5P-nya tidak ada', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten());

  const hasil = await hapusKontenLengkap(guru, k.id);

  expect(hasil.ok).toBe(true);
  expect(await daftarKonten(guru)).toEqual([]);
});

test('menghapus konten milik penyelenggara lain ditolak', async () => {
  const pemilik = await buatGuru('pemilik@contoh.id');
  const orangLain = await buatGuru('lain@contoh.id');
  const k = await simpanKonten(pemilik, konten());

  const hasil = await hapusKontenLengkap(orangLain, k.id);

  expect(hasil.ok).toBe(false);
  expect(await daftarKonten(pemilik)).toHaveLength(1);
});

test('menghapus konten yang tidak ada ditolak dengan pesan', async () => {
  const guru = await buatGuru();
  const hasil = await hapusKontenLengkap(guru, 987654);

  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.pesan).toMatch(/tidak ditemukan/i);
});

test('jumlah sesi dan peserta yang terhapus ikut dilaporkan', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten());

  const [s] = await query<{ id: number }>(
    `insert into quiz_sessions (owner_id, content_id, title, pin, opens_at, closes_at)
     values ($1, $2, 'Kelas 8A', '400100', now() - interval '1 day', now() + interval '1 day')
     returning id`,
    [guru, k.id],
  );
  await query(
    `insert into participants (session_id, alias, token_hash)
     values ($1, 'Rina', 'h-400100'), ($1, 'Budi', 'h-400101')`,
    [s.id],
  );

  const hasil = await hapusKontenLengkap(guru, k.id);

  expect(hasil.ok).toBe(true);
  if (!hasil.ok) return;
  expect(hasil.sesiTerhapus).toBe(1);
  expect(hasil.pesertaTerhapus).toBe(2);
  expect(hasil.judul).toBe('Crossword');
});
