import { afterAll, beforeEach, expect, test } from 'vitest';
import { pool, query } from '@/lib/db';

/** Kode SQLSTATE Postgres — dipakai karena pesan galatnya mengikuti locale server. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const NOT_NULL_VIOLATION = '23502';

async function harapGagalPg(p: Promise<unknown>, kode: string) {
  await expect(p).rejects.toMatchObject({ code: kode });
}

async function buatGuru(email = 'guru@contoh.id') {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ($1, 'x', 'Guru') returning id`,
    [email],
  );
  return g.id;
}

async function buatKonten(ownerId: number) {
  const [k] = await query<{ id: number }>(
    `insert into contents (owner_id, title, main_library, h5p_content_id, source_filename)
     values ($1, 'Crossword', 'H5P.Crossword', '1', 'a.h5p') returning id`,
    [ownerId],
  );
  return k.id;
}

async function buatSesi(
  ownerId: number,
  contentId: number,
  pin: string,
  opens = '2026-11-01T00:00:00Z',
  closes = '2026-11-05T00:00:00Z',
) {
  const [s] = await query<{ id: number }>(
    `insert into quiz_sessions (owner_id, content_id, title, pin, opens_at, closes_at)
     values ($1, $2, 'Sesi', $3, $4, $5) returning id`,
    [ownerId, contentId, pin, opens, closes],
  );
  return s.id;
}

async function buatPeserta(sessionId: number, alias: string, token = alias) {
  const [p] = await query<{ id: number }>(
    `insert into participants (session_id, alias, token_hash)
     values ($1, $2, $3) returning id`,
    [sessionId, alias, `hash-${token}-${sessionId}`],
  );
  return p.id;
}

beforeEach(async () => {
  await query(
    'truncate xapi_events, participants, quiz_sessions, contents, teachers restart identity cascade',
  );
});

afterAll(async () => {
  await pool.end();
});

test('pin unik di seluruh tabel sesi', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  await buatSesi(guru, konten, '482917');
  await harapGagalPg(buatSesi(guru, konten, '482917'), UNIQUE_VIOLATION);
});

test('pin harus enam angka', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  await harapGagalPg(buatSesi(guru, konten, '48291'), CHECK_VIOLATION);
  await harapGagalPg(buatSesi(guru, konten, 'abcdef'), CHECK_VIOLATION);
});

test('alias unik per sesi tanpa pandang huruf dan spasi', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const sesi = await buatSesi(guru, konten, '100001');
  await buatPeserta(sesi, 'Rina', 'a');
  await harapGagalPg(buatPeserta(sesi, ' rina ', 'b'), UNIQUE_VIOLATION);
});

test('alias sama boleh di sesi berbeda', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const sesiA = await buatSesi(guru, konten, '100002');
  const sesiB = await buatSesi(guru, konten, '100003');
  const a = await buatPeserta(sesiA, 'Rina');
  const b = await buatPeserta(sesiB, 'Rina');
  expect(a).not.toBe(b);
});

test('menghapus sesi ikut menghapus peserta dan pernyataan xapi', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const sesi = await buatSesi(guru, konten, '100004');
  const peserta = await buatPeserta(sesi, 'Rina');
  await query(
    `insert into xapi_events (participant_id, statement) values ($1, '{"a":1}'::jsonb)`,
    [peserta],
  );

  await query('delete from quiz_sessions where id = $1', [sesi]);

  expect(await query('select id from participants')).toHaveLength(0);
  expect(await query('select id from xapi_events')).toHaveLength(0);
});

test('konten tidak terhapus saat sesinya dihapus', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const sesi = await buatSesi(guru, konten, '100005');

  await query('delete from quiz_sessions where id = $1', [sesi]);

  expect(await query('select id from contents')).toHaveLength(1);
});

test('closes_at wajib diisi', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  await harapGagalPg(
    query(
      `insert into quiz_sessions (owner_id, content_id, title, pin, opens_at)
       values ($1, $2, 'Sesi', '100006', now())`,
      [guru, konten],
    ),
    NOT_NULL_VIOLATION,
  );
});

test('closes_at harus setelah opens_at', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  await harapGagalPg(
    buatSesi(guru, konten, '100007', '2026-11-05T00:00:00Z', '2026-11-01T00:00:00Z'),
    CHECK_VIOLATION,
  );
});

test('scoring hanya menerima tiga nilai yang sah', async () => {
  const guru = await buatGuru();
  await harapGagalPg(
    query(
      `insert into contents (owner_id, title, main_library, h5p_content_id, source_filename, scoring)
       values ($1, 'X', 'H5P.X', '1', 'a.h5p', 'ngawur')`,
      [guru],
    ),
    CHECK_VIOLATION,
  );
});

test('alias lebih dari 40 karakter ditolak', async () => {
  const guru = await buatGuru();
  const konten = await buatKonten(guru);
  const sesi = await buatSesi(guru, konten, '100008');
  await harapGagalPg(buatPeserta(sesi, 'x'.repeat(41)), CHECK_VIOLATION);
});
