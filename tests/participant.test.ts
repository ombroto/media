import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { NAMA_COOKIE_PESERTA } from '@/lib/nama-cookie';
import { pool, query } from '@/lib/db';
import { periksaAksesH5P } from '@/lib/h5p-access';
import { buatToken, hashToken, pesertaDariToken } from '@/lib/participant';
import { simpanKonten } from '@/lib/repo/contents';
import { mulaiPeserta, periksaPin } from '@/lib/repo/participants';
import { buatSesi } from '@/lib/repo/sessions';

beforeAll(() => {
  process.env.SESSION_SECRET ??= 'rahasia-uji-yang-cukup-panjang';
});

beforeEach(async () => {
  await query(
    'truncate xapi_events, participants, quiz_sessions, contents, teachers restart identity cascade',
  );
});

afterAll(async () => {
  await pool.end();
});

const hari = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);

async function siapkanSesi({
  pin = '482917',
  opensAt = hari(-1),
  closesAt = hari(4),
  mainLibrary = 'H5P.Crossword',
  h5pContentId = '101',
}: {
  pin?: string;
  opensAt?: Date;
  closesAt?: Date;
  mainLibrary?: string;
  h5pContentId?: string;
} = {}) {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ('guru' || floor(random() * 1e9) || '@contoh.id', 'x', 'Bu Guru') returning id`,
  );
  const konten = await simpanKonten(g.id, {
    title: 'Crossword',
    mainLibrary,
    h5pContentId,
    sourceFilename: 'a.h5p',
  });
  const hasil = await buatSesi(g.id, {
    contentId: konten.id,
    title: 'Teka-teki Bab 3',
    pin,
    opensAt,
    closesAt,
  });
  if (!hasil.ok) throw new Error(`sesi gagal: ${hasil.pesan}`);
  return { guruId: g.id, konten, sesi: hasil.sesi };
}

/* ── Pintu masuk PIN ───────────────────────────────────────────────────── */

test('pin dengan spasi di ujung tetap diterima', async () => {
  const { sesi } = await siapkanSesi();
  const hasil = await periksaPin(' 482917 ');
  expect(hasil.ok).toBe(true);
  if (hasil.ok) expect(hasil.sesi.id).toBe(sesi.id);
});

test('pin bukan enam angka ditolak sebagai format salah, bukan tidak ditemukan', async () => {
  await siapkanSesi();
  for (const pin of ['48291', 'abcdef', '', '4829177']) {
    const hasil = await periksaPin(pin);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe('format');
  }
});

test('pin yang tidak ada mengembalikan tidak_ada', async () => {
  await siapkanSesi();
  const hasil = await periksaPin('000000');
  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.alasan).toBe('tidak_ada');
});

test('sesi belum dibuka mengembalikan belum_dibuka beserta tanggal bukanya', async () => {
  const { sesi } = await siapkanSesi({ opensAt: hari(2), closesAt: hari(5) });
  const hasil = await periksaPin('482917');

  expect(hasil.ok).toBe(false);
  if (hasil.ok) return;
  expect(hasil.alasan).toBe('belum_dibuka');
  expect(hasil.sesi?.opens_at.getTime()).toBe(sesi.opens_at.getTime());
});

test('sesi sudah ditutup mengembalikan sudah_ditutup beserta tanggal tutupnya', async () => {
  const { sesi } = await siapkanSesi({ opensAt: hari(-5), closesAt: hari(-2) });
  const hasil = await periksaPin('482917');

  expect(hasil.ok).toBe(false);
  if (hasil.ok) return;
  expect(hasil.alasan).toBe('sudah_ditutup');
  expect(hasil.sesi?.closes_at.getTime()).toBe(sesi.closes_at.getTime());
});

test('sesi yang ditutup lebih cepat juga mengembalikan sudah_ditutup', async () => {
  const { sesi } = await siapkanSesi();
  await query('update quiz_sessions set closed_early_at = now() where id = $1', [sesi.id]);

  const hasil = await periksaPin('482917');
  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.alasan).toBe('sudah_ditutup');
});

/* ── Token dan mulaiPeserta ────────────────────────────────────────────── */

test('buatToken menghasilkan token dan hash yang bersesuaian', () => {
  const { token, hash } = buatToken();
  expect(token.length).toBeGreaterThan(20);
  expect(hash).toBe(hashToken(token));
  expect(hash).not.toBe(token);
});

test('mulaiPeserta menetapkan started_at di server dan mengembalikan token', async () => {
  const { sesi } = await siapkanSesi();
  const sebelum = Date.now();

  const hasil = await mulaiPeserta(sesi.id, 'Rina');

  expect(hasil.ok).toBe(true);
  if (!hasil.ok) return;

  const peserta = await pesertaDariToken(hasil.token);
  expect(peserta?.alias).toBe('Rina');
  expect(peserta?.started_at.getTime()).toBeGreaterThanOrEqual(sebelum - 2000);
  expect(peserta?.finished_at).toBeNull();
});

test('token disimpan sebagai hash, bukan apa adanya', async () => {
  const { sesi } = await siapkanSesi();
  const hasil = await mulaiPeserta(sesi.id, 'Rina');
  if (!hasil.ok) throw new Error('gagal mulai');

  const [baris] = await query<{ token_hash: string }>(
    'select token_hash from participants',
  );
  expect(baris.token_hash).not.toBe(hasil.token);
  expect(baris.token_hash).toBe(hashToken(hasil.token));
});

test('token yang dirusak tidak mengembalikan peserta', async () => {
  const { sesi } = await siapkanSesi();
  const hasil = await mulaiPeserta(sesi.id, 'Rina');
  if (!hasil.ok) throw new Error('gagal mulai');

  expect(await pesertaDariToken(`${hasil.token.slice(0, -2)}xx`)).toBeNull();
  expect(await pesertaDariToken('')).toBeNull();
  expect(await pesertaDariToken(undefined)).toBeNull();
});

test('nama yang sudah terpakai ditolak dengan alasan nama_terpakai', async () => {
  const { sesi } = await siapkanSesi();
  await mulaiPeserta(sesi.id, 'Rina');

  const kedua = await mulaiPeserta(sesi.id, 'Rina');
  expect(kedua.ok).toBe(false);
  if (!kedua.ok) expect(kedua.alasan).toBe('nama_terpakai');
});

test('nama sama dengan beda huruf besar dan spasi juga ditolak', async () => {
  const { sesi } = await siapkanSesi();
  await mulaiPeserta(sesi.id, 'Rina');

  const kedua = await mulaiPeserta(sesi.id, '  rINa  ');
  expect(kedua.ok).toBe(false);
  if (!kedua.ok) expect(kedua.alasan).toBe('nama_terpakai');
});

test('nama kosong ditolak', async () => {
  const { sesi } = await siapkanSesi();
  const hasil = await mulaiPeserta(sesi.id, '   ');
  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.alasan).toBe('nama_tidak_sah');
});

test('nama lebih dari 40 karakter ditolak', async () => {
  const { sesi } = await siapkanSesi();
  const hasil = await mulaiPeserta(sesi.id, 'x'.repeat(41));
  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.alasan).toBe('nama_tidak_sah');
});

test('nama yang sama boleh di sesi yang berbeda', async () => {
  const a = await siapkanSesi({ pin: '100001' });
  const b = await siapkanSesi({ pin: '100002' });

  expect((await mulaiPeserta(a.sesi.id, 'Rina')).ok).toBe(true);
  expect((await mulaiPeserta(b.sesi.id, 'Rina')).ok).toBe(true);
});

test('mulaiPeserta di sesi tertutup ditolak dengan alasan sesi_tertutup', async () => {
  const { sesi } = await siapkanSesi({ opensAt: hari(-5), closesAt: hari(-2) });
  const hasil = await mulaiPeserta(sesi.id, 'Rina');
  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.alasan).toBe('sesi_tertutup');
});

test('mulaiPeserta di sesi yang belum dibuka juga ditolak', async () => {
  const { sesi } = await siapkanSesi({ opensAt: hari(2), closesAt: hari(5) });
  const hasil = await mulaiPeserta(sesi.id, 'Rina');
  expect(hasil.ok).toBe(false);
  if (!hasil.ok) expect(hasil.alasan).toBe('sesi_tertutup');
});

test('dua permintaan serentak dengan nama sama: tepat satu berhasil', async () => {
  const { sesi } = await siapkanSesi();

  const [a, b] = await Promise.all([
    mulaiPeserta(sesi.id, 'Rina'),
    mulaiPeserta(sesi.id, 'Rina'),
  ]);

  const berhasil = [a, b].filter((h) => h.ok);
  const gagal = [a, b].filter((h) => !h.ok);

  expect(berhasil).toHaveLength(1);
  expect(gagal).toHaveLength(1);
  expect(gagal[0].ok ? null : gagal[0].alasan).toBe('nama_terpakai');
  expect(await query('select id from participants')).toHaveLength(1);
});

/* ── Akses berkas konten oleh peserta ──────────────────────────────────── */

function reqPeserta(token: string, contentId: string): Request {
  return new Request(`http://localhost/h5p/content/${contentId}/content.json`, {
    headers: { cookie: `${NAMA_COOKIE_PESERTA}=${encodeURIComponent(token)}` },
  });
}

test('token peserta sesi terbuka boleh mengambil berkas konten sesinya', async () => {
  const { sesi, konten } = await siapkanSesi({ h5pContentId: '555' });
  const hasil = await mulaiPeserta(sesi.id, 'Rina');
  if (!hasil.ok) throw new Error('gagal mulai');

  const akses = await periksaAksesH5P(reqPeserta(hasil.token, '555'), '555');
  expect(akses).toMatchObject({
    jenis: 'peserta',
    sessionId: sesi.id,
    h5pContentId: konten.h5p_content_id,
  });
});

test('token peserta tidak boleh mengambil berkas konten sesi lain', async () => {
  const a = await siapkanSesi({ pin: '100001', h5pContentId: '555' });
  const b = await siapkanSesi({ pin: '100002', h5pContentId: '777' });
  const hasil = await mulaiPeserta(a.sesi.id, 'Rina');
  if (!hasil.ok) throw new Error('gagal mulai');

  void b;
  expect(await periksaAksesH5P(reqPeserta(hasil.token, '777'), '777')).toBeNull();
});

test('token peserta sesi yang sudah ditutup tidak boleh mengambil berkas konten', async () => {
  const { sesi } = await siapkanSesi({ h5pContentId: '555' });
  const hasil = await mulaiPeserta(sesi.id, 'Rina');
  if (!hasil.ok) throw new Error('gagal mulai');

  await query('update quiz_sessions set closed_early_at = now() where id = $1', [sesi.id]);

  expect(await periksaAksesH5P(reqPeserta(hasil.token, '555'), '555')).toBeNull();
});

test('token peserta palsu tidak memberi akses', async () => {
  await siapkanSesi({ h5pContentId: '555' });
  expect(await periksaAksesH5P(reqPeserta('token-asal-asalan', '555'), '555')).toBeNull();
});
