import { afterAll, beforeEach, expect, test } from 'vitest';
import { pool, query } from '@/lib/db';
import {
  ambilKonten,
  daftarKonten,
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

test('konten H5P.MemoryGame ditandai unscored saat disimpan', async () => {
  const guru = await buatGuru();
  const k = await simpanKonten(guru, konten('H5P.MemoryGame', 'Memory Game'));
  expect(k.scoring).toBe('unscored');
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
