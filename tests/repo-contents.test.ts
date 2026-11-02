import { afterAll, beforeEach, expect, test } from 'vitest';
import { pool, query } from '@/lib/db';
import {
  ambilKonten,
  daftarKonten,
  hapusKonten,
  simpanKonten,
  tandaiScoring,
} from '@/lib/repo/contents';

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

const konten = (mainLibrary: string, title = 'Judul') => ({
  title,
  mainLibrary,
  h5pContentId: '101',
  sourceFilename: 'a.h5p',
});

test('simpanKonten menyimpan dan daftarKonten mengembalikannya', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword', 'Crossword'));

  expect(k.id).toBeGreaterThan(0);
  expect(k.title).toBe('Crossword');

  const daftar = await daftarKonten(guru);
  expect(daftar.map((x) => x.id)).toEqual([k.id]);
});

test('daftarKonten hanya menampilkan milik pemiliknya', async () => {
  const guruA = await buatGuru('a@contoh.id');
  const guruB = await buatGuru('b@contoh.id');
  await simpanKonten(guruA, konten('H5P.Crossword', 'Milik A'));

  expect(await daftarKonten(guruB)).toEqual([]);
  expect((await daftarKonten(guruA)).map((x) => x.title)).toEqual(['Milik A']);
});

test('daftarKonten menyertakan jumlah sesi yang memakainya', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword'));

  await query(
    `insert into quiz_sessions (owner_id, content_id, title, pin, opens_at, closes_at)
     values ($1, $2, 'Sesi 1', '100001', now(), now() + interval '1 day'),
            ($1, $2, 'Sesi 2', '100002', now(), now() + interval '1 day')`,
    [guru, k.id],
  );

  const [baris] = await daftarKonten(guru);
  expect(baris.jumlah_sesi).toBe(2);
});

test('konten H5P.MemoryGame TIDAK ditandai unscored — ia memberi nilai', async () => {
  // Memory Game mengimplementasikan getScore/getMaxScore/getXAPIData; ia
  // sempat salah masuk daftar "tidak pernah berskor".
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.MemoryGame', 'Memory Game'));
  expect(k.scoring).toBe('unknown');
});

test('konten H5P.ImagePair ditandai unknown — nilainya datang lewat event xAPI', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.ImagePair', 'Image pairing'));
  expect(k.scoring).toBe('unknown');
});

test('konten H5P.Dialogcards ditandai unscored saat disimpan', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Dialogcards', 'Dialog Cards'));
  expect(k.scoring).toBe('unscored');
});

test('konten H5P.Crossword ditandai unknown saat disimpan', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword'));
  expect(k.scoring).toBe('unknown');
});

test('tandaiScoring mengubah unknown menjadi scored', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword'));

  await tandaiScoring(k.id, 'scored');

  expect((await ambilKonten(k.id))?.scoring).toBe('scored');
});

test('tandaiScoring tidak menurunkan scored kembali ke unscored', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword'));

  await tandaiScoring(k.id, 'scored');
  await tandaiScoring(k.id, 'unscored');

  expect((await ambilKonten(k.id))?.scoring).toBe('scored');
});

test('ambilKonten mengembalikan null untuk id yang tidak ada', async () => {
  expect(await ambilKonten(987654)).toBeNull();
});

/* ── Penghapusan konten beserta sesinya ────────────────────────────────── */

async function buatSesiUntuk(guru: number, kontenId: number, pin: string, judul: string) {
  const [s] = await query<{ id: number }>(
    `insert into quiz_sessions (owner_id, content_id, title, pin, opens_at, closes_at)
     values ($1, $2, $3, $4, now() - interval '1 day', now() + interval '1 day')
     returning id`,
    [guru, kontenId, judul, pin],
  );
  return s.id;
}

test('daftarKonten menyertakan sesi yang memakai tiap konten', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword'));
  await buatSesiUntuk(guru, k.id, '300001', 'Kelas 8A');
  await buatSesiUntuk(guru, k.id, '300002', 'Kelas 8B');

  const [baris] = await daftarKonten(guru);

  expect(baris.jumlah_sesi).toBe(2);
  expect(baris.sesi.map((s) => s.pin).sort()).toEqual(['300001', '300002']);
  expect(baris.sesi.map((s) => s.title).sort()).toEqual(['Kelas 8A', 'Kelas 8B']);
});

test('konten tanpa sesi memiliki daftar sesi kosong', async () => {
  const guru = await buatGuru();
  await simpanKonten(guru, konten('H5P.Crossword'));

  const [baris] = await daftarKonten(guru);
  expect(baris.sesi).toEqual([]);
});

test('hapusKonten menghapus kontennya beserta seluruh sesinya', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword'));
  await buatSesiUntuk(guru, k.id, '300003', 'Kelas 8A');
  await buatSesiUntuk(guru, k.id, '300004', 'Kelas 8B');

  const hasil = await hapusKonten(k.id);

  expect(hasil.sesiTerhapus).toBe(2);
  expect(await ambilKonten(k.id)).toBeNull();
  expect(await query('select id from quiz_sessions')).toHaveLength(0);
});

test('hapusKonten ikut menghapus peserta dan pernyataan xapi sesinya', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.Crossword'));
  const sesi = await buatSesiUntuk(guru, k.id, '300005', 'Kelas 8A');

  const [p] = await query<{ id: number }>(
    `insert into participants (session_id, alias, token_hash)
     values ($1, 'Rina', 'h-300005') returning id`,
    [sesi],
  );
  await query(
    `insert into xapi_events (participant_id, statement) values ($1, '{"a":1}'::jsonb)`,
    [p.id],
  );

  const hasil = await hapusKonten(k.id);

  expect(hasil.pesertaTerhapus).toBe(1);
  expect(await query('select id from participants')).toHaveLength(0);
  expect(await query('select id from xapi_events')).toHaveLength(0);
});

test('hapusKonten tidak menyentuh konten lain maupun sesinya', async () => {
  const guru = await buatGuru();
  const dihapus = await simpanKonten(guru, konten('H5P.Crossword', 'Dihapus'));
  const tetap = await simpanKonten(guru, konten('H5P.FindTheWords', 'Tetap'));
  await buatSesiUntuk(guru, dihapus.id, '300006', 'Ikut terhapus');
  await buatSesiUntuk(guru, tetap.id, '300007', 'Harus tetap ada');

  await hapusKonten(dihapus.id);

  const sisa = await daftarKonten(guru);
  expect(sisa.map((x) => x.title)).toEqual(['Tetap']);
  expect((await query<{ pin: string }>('select pin from quiz_sessions')).map((x) => x.pin)).toEqual(
    ['300007'],
  );
});

test('hapusKonten pada id yang tidak ada tidak melempar', async () => {
  const hasil = await hapusKonten(987654);
  expect(hasil.sesiTerhapus).toBe(0);
});
