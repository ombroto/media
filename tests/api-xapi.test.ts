import { afterAll, beforeEach, expect, test } from 'vitest';
import { POST } from '@/app/api/xapi/route';
import { pool, query } from '@/lib/db';
import { NAMA_COOKIE_PESERTA } from '@/lib/nama-cookie';
import { pesertaDariToken } from '@/lib/participant';
import { simpanKonten, ambilKonten } from '@/lib/repo/contents';
import { mulaiPeserta } from '@/lib/repo/participants';
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

async function siapkan({
  mainLibrary = 'H5P.Crossword',
  opensAt = hari(-1),
  closesAt = hari(4),
} = {}) {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ('guru' || floor(random() * 1e9) || '@contoh.id', 'x', 'Bu Guru') returning id`,
  );
  const konten = await simpanKonten(g.id, {
    title: 'Crossword',
    mainLibrary,
    h5pContentId: '101',
    sourceFilename: 'a.h5p',
  });
  const sesi = await buatSesi(g.id, {
    contentId: konten.id,
    title: 'Sesi',
    pin: String(100000 + Math.floor(Math.random() * 899999)),
    opensAt,
    closesAt,
  });
  if (!sesi.ok) throw new Error('sesi gagal');

  const mulai = await mulaiPeserta(sesi.sesi.id, 'Rina');
  if (!mulai.ok) throw new Error('peserta gagal');

  return { konten, sesi: sesi.sesi, token: mulai.token, participantId: mulai.participantId };
}

type OpsiStatement = { verb?: string; raw?: number; max?: number; anak?: boolean };

function statement({ verb = 'answered', raw = 8, max = 10, anak = false }: OpsiStatement = {}) {
  const s: Record<string, unknown> = {
    verb: { display: { 'en-US': verb } },
    result: { score: { raw, max } },
  };
  if (anak) {
    s.context = { contextActivities: { parent: [{ id: 'http://induk' }] } };
  }
  return s;
}

function permintaan(token: string | null, muatan: unknown): Request {
  return new Request('http://localhost/api/xapi', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `${NAMA_COOKIE_PESERTA}=${encodeURIComponent(token)}` } : {}),
    },
    body: JSON.stringify(muatan),
  });
}

test('pernyataan tanpa token peserta dibalas 401 dan tidak disimpan', async () => {
  await siapkan();

  const res = await POST(permintaan(null, { statement: statement() }));

  expect(res.status).toBe(401);
  expect(await query('select id from xapi_events')).toHaveLength(0);
});

test('token peserta palsu dibalas 401', async () => {
  await siapkan();
  const res = await POST(permintaan('token-asal', { statement: statement() }));
  expect(res.status).toBe(401);
});

test('badan permintaan yang bukan JSON dibalas 400', async () => {
  const { token } = await siapkan();

  const res = await POST(
    new Request('http://localhost/api/xapi', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${NAMA_COOKIE_PESERTA}=${token}`,
      },
      body: 'bukan json',
    }),
  );

  expect(res.status).toBe(400);
});

test('pernyataan yang memenuhi syarat mengisi score_raw, score_max, finished_at', async () => {
  const { token } = await siapkan();

  const res = await POST(permintaan(token, { statement: statement({ raw: 8, max: 10 }) }));
  expect(res.status).toBe(200);

  const p = await pesertaDariToken(token);
  expect(p?.score_raw).toBe(8);
  expect(p?.score_max).toBe(10);
  expect(p?.finished_at).toBeInstanceOf(Date);
});

test('pernyataan berikutnya dengan score.max lebih besar memperbarui nilai', async () => {
  const { token } = await siapkan();

  await POST(permintaan(token, { statement: statement({ raw: 3, max: 5 }) }));
  await POST(permintaan(token, { statement: statement({ raw: 6, max: 20 }) }));

  const p = await pesertaDariToken(token);
  expect(p?.score_raw).toBe(6);
  expect(p?.score_max).toBe(20);
});

test('pernyataan completed mengalahkan answered yang datang setelahnya', async () => {
  const { token } = await siapkan();

  await POST(permintaan(token, { statement: statement({ verb: 'completed', raw: 6, max: 10 }) }));
  await POST(permintaan(token, { statement: statement({ verb: 'answered', raw: 10, max: 10 }) }));

  const p = await pesertaDariToken(token);
  expect(p?.score_raw).toBe(6);
});

test('pernyataan tak memenuhi syarat disimpan tapi nilai peserta tidak berubah', async () => {
  const { token } = await siapkan();

  const res = await POST(permintaan(token, { statement: statement({ anak: true }) }));
  expect(res.status).toBe(200);

  expect(await query('select id from xapi_events')).toHaveLength(1);
  const p = await pesertaDariToken(token);
  expect(p?.score_raw).toBeNull();
  expect(p?.finished_at).toBeNull();
});

test('pernyataan dari sesi yang sudah ditutup tetap diterima kalau started_at di dalam jendela', async () => {
  const { token, sesi } = await siapkan();

  // Peserta sudah masuk secara sah, lalu penyelenggara menutup sesinya.
  await query('update quiz_sessions set closed_early_at = now() where id = $1', [sesi.id]);

  const res = await POST(permintaan(token, { statement: statement({ raw: 7, max: 10 }) }));

  expect(res.status).toBe(200);
  const p = await pesertaDariToken(token);
  expect(p?.score_raw).toBe(7);
});

test('durasi tidak pernah diambil dari badan permintaan walau dikirim', async () => {
  const { token } = await siapkan();

  await POST(
    permintaan(token, {
      statement: statement({ raw: 9, max: 10 }),
      durasi_ms: 1,
      started_at: new Date(2000, 0, 1).toISOString(),
      finished_at: new Date(2000, 0, 1).toISOString(),
    }),
  );

  const p = await pesertaDariToken(token);
  const durasi = p!.finished_at!.getTime() - p!.started_at.getTime();
  expect(durasi).toBeGreaterThanOrEqual(0);
  expect(durasi).toBeLessThan(60_000);
  expect(p!.started_at.getFullYear()).toBeGreaterThan(2020);
});

test('pernyataan pertama yang memenuhi syarat menandai kontennya scored', async () => {
  const { token, konten } = await siapkan();
  expect(konten.scoring).toBe('unknown');

  await POST(permintaan(token, { statement: statement() }));

  expect((await ambilKonten(konten.id))?.scoring).toBe('scored');
});

test('konten yang sudah ditandai unscored tidak ikut berubah kalau pernyataannya tak berskor', async () => {
  const { token, konten } = await siapkan({ mainLibrary: 'H5P.MemoryGame' });
  expect(konten.scoring).toBe('unscored');

  await POST(permintaan(token, { statement: statement({ anak: true }) }));

  expect((await ambilKonten(konten.id))?.scoring).toBe('unscored');
});

test('dua pernyataan serentak: completed yang menentukan, bukan yang kalah lomba', async () => {
  const { token } = await siapkan();

  // Dikirim bersamaan seperti yang dilakukan konten beruntun (mis. Interactive
  // Video). Tanpa transaksi, pembaca yang lebih awal bisa menimpa hasil yang
  // lebih benar.
  await Promise.all([
    POST(permintaan(token, { statement: statement({ verb: 'answered', raw: 3, max: 10 }) })),
    POST(permintaan(token, { statement: statement({ verb: 'completed', raw: 9, max: 10 }) })),
  ]);

  const p = await pesertaDariToken(token);
  expect(p?.score_raw).toBe(9);
});

test('skor di luar jangkauan integer tidak merusak nilai berikutnya', async () => {
  const { token } = await siapkan();

  const rusak = await POST(permintaan(token, { statement: statement({ raw: 1e12, max: 1e12 }) }));
  expect(rusak.status).toBe(200);

  const sah = await POST(permintaan(token, { statement: statement({ raw: 7, max: 10 }) }));
  expect(sah.status).toBe(200);

  const p = await pesertaDariToken(token);
  expect(p?.score_raw).toBe(7);
  expect(p?.score_max).toBe(10);
});

test('pernyataan tanpa kunci statement dibalas 400', async () => {
  const { token } = await siapkan();
  const res = await POST(permintaan(token, { bukan: 'statement' }));
  expect(res.status).toBe(400);
});
