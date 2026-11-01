import { afterAll, beforeEach, expect, test } from 'vitest';
import { pool, query } from '@/lib/db';
import { urutkanPeringkat } from '@/lib/ranking';
import { simpanKonten } from '@/lib/repo/contents';
import { peringkatSesi, ringkasanSesi } from '@/lib/repo/peringkat';
import { buatSesi } from '@/lib/repo/sessions';

beforeEach(async () => {
  await query(
    'truncate xapi_events, participants, quiz_sessions, contents, teachers restart identity cascade',
  );
});

afterAll(async () => {
  await pool.end();
});

const hari = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);

async function siapkanSesi(pin: string) {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ('guru' || floor(random() * 1e9) || '@contoh.id', 'x', 'Bu Guru') returning id`,
  );
  const konten = await simpanKonten(g.id, {
    title: 'Crossword',
    mainLibrary: 'H5P.Crossword',
    h5pContentId: '101',
    sourceFilename: 'a.h5p',
  });
  const sesi = await buatSesi(g.id, {
    contentId: konten.id,
    title: 'Sesi',
    pin,
    opensAt: hari(-1),
    closesAt: hari(4),
  });
  if (!sesi.ok) throw new Error('sesi gagal');
  return sesi.sesi;
}

async function tambahPeserta(
  sessionId: number,
  alias: string,
  opsi: { skor?: number; maks?: number; mulaiDetikLalu?: number; durasiDetik?: number } = {},
) {
  const { skor, maks = 10, mulaiDetikLalu = 600, durasiDetik } = opsi;
  const selesai = skor === undefined ? null : `now() - interval '${mulaiDetikLalu - (durasiDetik ?? 0)} seconds'`;

  const [p] = await query<{ id: number }>(
    `insert into participants (session_id, alias, token_hash, started_at, finished_at, score_raw, score_max)
     values ($1, $2, $3, now() - interval '${mulaiDetikLalu} seconds', ${selesai ?? 'null'}, $4, $5)
     returning id`,
    [sessionId, alias, `hash-${alias}-${sessionId}`, skor ?? null, skor === undefined ? null : maks],
  );
  return p.id;
}

test('peringkatSesi hanya memuat peserta yang finished_at terisi', async () => {
  const sesi = await siapkanSesi('100001');
  await tambahPeserta(sesi.id, 'Budi', { skor: 10, durasiDetik: 125 });
  await tambahPeserta(sesi.id, 'Belum', {});

  const baris = await peringkatSesi(sesi.id);
  expect(baris.map((b) => b.alias)).toEqual(['Budi']);
});

test('peringkatSesi tidak mencampur peserta sesi lain', async () => {
  const a = await siapkanSesi('100002');
  const b = await siapkanSesi('100003');
  await tambahPeserta(a.id, 'MilikA', { skor: 8, durasiDetik: 100 });
  await tambahPeserta(b.id, 'MilikB', { skor: 9, durasiDetik: 100 });

  expect((await peringkatSesi(a.id)).map((x) => x.alias)).toEqual(['MilikA']);
});

test('urutan dari urutkanPeringkat: skor dulu, lalu durasi', async () => {
  const sesi = await siapkanSesi('100004');
  await tambahPeserta(sesi.id, 'Rina', { skor: 8, durasiDetik: 221 });
  await tambahPeserta(sesi.id, 'Budi', { skor: 10, durasiDetik: 125 });
  await tambahPeserta(sesi.id, 'Doni', { skor: 8, durasiDetik: 330 });

  const urut = urutkanPeringkat(await peringkatSesi(sesi.id));

  expect(urut.map((b) => b.alias)).toEqual(['Budi', 'Rina', 'Doni']);
  expect(urut.map((b) => b.peringkat)).toEqual([1, 2, 3]);
});

test('durasi di peringkat dihitung dari cap waktu server', async () => {
  const sesi = await siapkanSesi('100005');
  await tambahPeserta(sesi.id, 'Rina', { skor: 8, mulaiDetikLalu: 600, durasiDetik: 221 });

  const [b] = urutkanPeringkat(await peringkatSesi(sesi.id));
  expect(Math.round(b.durasi_ms / 1000)).toBe(221);
});

test('ringkasanSesi menghitung ikut, selesai, dan rata-rata', async () => {
  const sesi = await siapkanSesi('100006');
  await tambahPeserta(sesi.id, 'Budi', { skor: 10, durasiDetik: 100 });
  await tambahPeserta(sesi.id, 'Rina', { skor: 6, durasiDetik: 100 });
  await tambahPeserta(sesi.id, 'Belum', {});

  const r = await ringkasanSesi(sesi.id);
  expect(r.jumlah_ikut).toBe(3);
  expect(r.jumlah_selesai).toBe(2);
  expect(r.rata_rata).toBeCloseTo(8, 5);
});

test('ringkasanSesi tanpa peserta selesai tidak menghasilkan NaN', async () => {
  const sesi = await siapkanSesi('100007');
  await tambahPeserta(sesi.id, 'Belum', {});

  const r = await ringkasanSesi(sesi.id);
  expect(r.jumlah_selesai).toBe(0);
  expect(r.rata_rata).toBeNull();
});

test('peserta belum selesai bisa didaftar terpisah', async () => {
  const sesi = await siapkanSesi('100008');
  await tambahPeserta(sesi.id, 'Budi', { skor: 10, durasiDetik: 100 });
  await tambahPeserta(sesi.id, 'Belum', {});

  const r = await ringkasanSesi(sesi.id);
  expect(r.belum_selesai.map((b) => b.alias)).toEqual(['Belum']);
});
