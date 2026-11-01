import { afterAll, beforeEach, expect, test } from 'vitest';
import { pool, query } from '@/lib/db';
import { buatPinBaru } from '@/lib/pin';
import { simpanKonten } from '@/lib/repo/contents';
import {
  ambilSesi,
  ambilSesiDariPin,
  buatSesi,
  daftarSesi,
  hapusSesi,
  tutupSekarang,
  ubahSesi,
} from '@/lib/repo/sessions';

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

async function buatKonten(ownerId: number, mainLibrary = 'H5P.Crossword') {
  const k = await simpanKonten(ownerId, {
    title: 'Crossword',
    mainLibrary,
    h5pContentId: '101',
    sourceFilename: 'a.h5p',
  });
  return k.id;
}

const hari = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);

async function sesiBaku(
  ownerId: number,
  contentId: number,
  pin = '482917',
  opensAt = hari(-1),
  closesAt = hari(4),
) {
  return buatSesi(ownerId, { contentId, title: 'Teka-teki Bab 3', pin, opensAt, closesAt });
}

test('buatPinBaru menghasilkan enam angka', async () => {
  const pin = await buatPinBaru();
  expect(pin).toMatch(/^[0-9]{6}$/);
});

test('buatPinBaru tidak menabrak pin yang sudah ada', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);

  // Isi banyak pin lalu pastikan yang baru bukan salah satunya.
  const dipakai: string[] = [];
  for (let i = 0; i < 20; i++) {
    const pin = String(100000 + i);
    await sesiBaku(guru, konten, pin);
    dipakai.push(pin);
  }

  for (let i = 0; i < 10; i++) {
    const pin = await buatPinBaru();
    expect(dipakai).not.toContain(pin);
  }
});

test('buatSesi menolak closes_at sebelum opens_at', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);

  const hasil = await sesiBaku(guru, konten, '482917', hari(4), hari(1));

  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.pesan).toMatch(/tutup|akhir/i);
});

test('buatSesi menolak pin yang bukan enam angka', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);

  const hasil = await sesiBaku(guru, konten, '48x917');

  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.pesan).toMatch(/pin/i);
});

test('buatSesi menolak pin yang sudah dipakai, dengan pesan bukan galat basis data', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  await sesiBaku(guru, konten, '482917');

  const hasil = await sesiBaku(guru, konten, '482917');

  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.pesan).toMatch(/pin.*dipakai|sudah dipakai/i);
});

test('daftarSesi mengembalikan status terhitung, bukan kolom tersimpan', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  await sesiBaku(guru, konten, '100001', hari(-1), hari(4));
  await sesiBaku(guru, konten, '100002', hari(2), hari(5));
  await sesiBaku(guru, konten, '100003', hari(-5), hari(-2));

  const daftar = await daftarSesi(guru);
  const status = Object.fromEntries(daftar.map((s) => [s.pin, s.status]));

  expect(status['100001']).toBe('berjalan');
  expect(status['100002']).toBe('terjadwal');
  expect(status['100003']).toBe('selesai');
});

test('daftarSesi menyertakan judul konten dan hitungan peserta', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const hasil = await sesiBaku(guru, konten);
  if (!hasil.ok) throw new Error('sesi gagal dibuat');

  await query(
    `insert into participants (session_id, alias, token_hash, finished_at, score_raw, score_max)
     values ($1, 'Budi', 'h1', now(), 10, 10),
            ($1, 'Rina', 'h2', null, null, null)`,
    [hasil.sesi.id],
  );

  const [baris] = await daftarSesi(guru);
  expect(baris.judul_konten).toBe('Crossword');
  expect(baris.jumlah_ikut).toBe(2);
  expect(baris.jumlah_selesai).toBe(1);
});

test('daftarSesi hanya menampilkan sesi milik pemiliknya', async () => {
  const guruA = await buatGuru('a@contoh.id');
  const guruB = await buatGuru('b@contoh.id');
  const konten = await buatKonten(guruA);
  await sesiBaku(guruA, konten);

  expect(await daftarSesi(guruB)).toEqual([]);
});

test('tutupSekarang membuat status menjadi selesai walau closes_at masih jauh', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const hasil = await sesiBaku(guru, konten, '482917', hari(-1), hari(10));
  if (!hasil.ok) throw new Error('sesi gagal dibuat');

  await tutupSekarang(hasil.sesi.id);

  const [baris] = await daftarSesi(guru);
  expect(baris.status).toBe('selesai');
});

test('hapusSesi menghapus pesertanya tapi kontennya tetap ada', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const hasil = await sesiBaku(guru, konten);
  if (!hasil.ok) throw new Error('sesi gagal dibuat');

  await query(
    `insert into participants (session_id, alias, token_hash) values ($1, 'Rina', 'h1')`,
    [hasil.sesi.id],
  );

  await hapusSesi(hasil.sesi.id);

  expect(await query('select id from participants')).toHaveLength(0);
  expect(await query('select id from quiz_sessions')).toHaveLength(0);
  expect(await query('select id from contents')).toHaveLength(1);
});

test('ubahSesi mengubah judul, tanggal, dan pin', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const hasil = await sesiBaku(guru, konten, '482917');
  if (!hasil.ok) throw new Error('sesi gagal dibuat');

  const ubah = await ubahSesi(hasil.sesi.id, {
    title: 'Judul Baru',
    pin: '735104',
    opensAt: hari(-2),
    closesAt: hari(6),
  });

  expect(ubah.ok).toBe(true);
  const sesi = await ambilSesi(hasil.sesi.id);
  expect(sesi?.title).toBe('Judul Baru');
  expect(sesi?.pin).toBe('735104');
});

test('ubahSesi menolak pin milik sesi lain dengan pesan, bukan galat basis data', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const a = await sesiBaku(guru, konten, '482917');
  const b = await sesiBaku(guru, konten, '735104');
  if (!a.ok || !b.ok) throw new Error('sesi gagal dibuat');

  const ubah = await ubahSesi(b.sesi.id, {
    title: 'Judul',
    pin: '482917',
    opensAt: hari(-1),
    closesAt: hari(4),
  });

  expect(ubah.ok).toBe(false);
  if (!ubah.ok) expect(ubah.pesan).toMatch(/pin/i);
  expect((await ambilSesi(b.sesi.id))?.pin).toBe('735104');
});

test('ubahSesi membiarkan pin sesi itu sendiri tanpa mengeluh', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const hasil = await sesiBaku(guru, konten, '482917');
  if (!hasil.ok) throw new Error('sesi gagal dibuat');

  const ubah = await ubahSesi(hasil.sesi.id, {
    title: 'Judul Lain',
    pin: '482917',
    opensAt: hari(-1),
    closesAt: hari(4),
  });

  expect(ubah.ok).toBe(true);
});

test('ambilSesiDariPin menemukan sesi dan mengabaikan spasi', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  await sesiBaku(guru, konten, '482917');

  expect((await ambilSesiDariPin(' 482917 '))?.pin).toBe('482917');
  expect(await ambilSesiDariPin('000000')).toBeNull();
});
