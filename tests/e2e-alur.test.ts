import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { POST as kirimXapi } from '@/app/api/xapi/route';
import { pool, query } from '@/lib/db';
import { NAMA_COOKIE_PESERTA } from '@/lib/nama-cookie';
import { urutkanPeringkat } from '@/lib/ranking';
import { daftarKonten } from '@/lib/repo/contents';
import { peringkatSesi } from '@/lib/repo/peringkat';
import { mulaiPeserta, periksaPin } from '@/lib/repo/participants';
import { buatSesi, tutupSekarang } from '@/lib/repo/sessions';
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

const hari = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);

async function buatGuru() {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ('guru' || floor(random() * 1e9) || '@contoh.id', 'x', 'Bu Guru') returning id`,
  );
  return g.id;
}

function berkasCrossword(): File {
  return new File([new Uint8Array(readFileSync(CROSSWORD))], 'crossword.h5p');
}

async function setorNilai(token: string, raw: number, max = 10, verb = 'answered') {
  const res = await kirimXapi(
    new Request('http://localhost/api/xapi', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${NAMA_COOKIE_PESERTA}=${encodeURIComponent(token)}`,
      },
      body: JSON.stringify({
        statement: {
          verb: { display: { 'en-US': verb } },
          result: { score: { raw, max } },
        },
      }),
    }),
  );
  return res.status;
}

test(
  'unggah konten, buat sesi, dua peserta mengerjakan, peringkat benar',
  async () => {
    const guru = await buatGuru();

    // 1. Penyelenggara mengunggah berkas .h5p miliknya.
    const unggah = await telanDanSimpan(guru, berkasCrossword());
    expect(unggah.ok).toBe(true);
    if (!unggah.ok || unggah.kontenId === null) throw new Error('unggah gagal');

    const [konten] = await daftarKonten(guru);
    expect(konten.main_library).toBe('H5P.Crossword');

    // 2. Membuat sesi berjendela waktu dengan PIN.
    const sesi = await buatSesi(guru, {
      contentId: unggah.kontenId,
      title: 'Teka-teki Silang Bab 3',
      pin: '482917',
      opensAt: hari(-1),
      closesAt: hari(4),
    });
    if (!sesi.ok) throw new Error(sesi.pesan);

    // 3. Dua peserta masuk dengan PIN itu.
    const pintu = await periksaPin(' 482917 ');
    expect(pintu.ok).toBe(true);
    if (!pintu.ok) return;

    const budi = await mulaiPeserta(pintu.sesi.id, 'Budi');
    const rina = await mulaiPeserta(pintu.sesi.id, 'Rina');
    if (!budi.ok || !rina.ok) throw new Error('peserta gagal masuk');

    // 4. Keduanya menyetor nilai. Rina lebih tinggi; Budi lebih dulu selesai.
    expect(await setorNilai(budi.token, 8)).toBe(200);
    expect(await setorNilai(rina.token, 10)).toBe(200);

    // 5. Peringkat: skor menentukan lebih dulu.
    const urut = urutkanPeringkat(await peringkatSesi(pintu.sesi.id));
    expect(urut.map((b) => b.alias)).toEqual(['Rina', 'Budi']);
    expect(urut.map((b) => b.peringkat)).toEqual([1, 2]);
    expect(urut[0].score_raw).toBe(10);
  },
  900000,
);

test(
  'skor sama: yang lebih cepat selesai menang',
  async () => {
    const guru = await buatGuru();
    const unggah = await telanDanSimpan(guru, berkasCrossword());
    if (!unggah.ok || unggah.kontenId === null) throw new Error('unggah gagal');

    const sesi = await buatSesi(guru, {
      contentId: unggah.kontenId,
      title: 'Sesi',
      pin: '100100',
      opensAt: hari(-1),
      closesAt: hari(4),
    });
    if (!sesi.ok) throw new Error(sesi.pesan);

    const cepat = await mulaiPeserta(sesi.sesi.id, 'Cepat');
    const lambat = await mulaiPeserta(sesi.sesi.id, 'Lambat');
    if (!cepat.ok || !lambat.ok) throw new Error('peserta gagal');

    await setorNilai(cepat.token, 7);
    await setorNilai(lambat.token, 7);

    // Mundurkan started_at si Lambat supaya durasinya jelas lebih panjang.
    await query(
      `update participants set started_at = started_at - interval '10 minutes' where id = $1`,
      [lambat.participantId],
    );

    const urut = urutkanPeringkat(await peringkatSesi(sesi.sesi.id));
    expect(urut.map((b) => b.alias)).toEqual(['Cepat', 'Lambat']);
  },
  900000,
);

test('nama yang sama di sesi yang sama ditolak, alias lain diterima', async () => {
  const guru = await buatGuru();
  const [k] = await query<{ id: number }>(
    `insert into contents (owner_id, title, main_library, h5p_content_id, source_filename)
     values ($1, 'Crossword', 'H5P.Crossword', '101', 'a.h5p') returning id`,
    [guru],
  );
  const sesi = await buatSesi(guru, {
    contentId: k.id,
    title: 'Sesi',
    pin: '200200',
    opensAt: hari(-1),
    closesAt: hari(4),
  });
  if (!sesi.ok) throw new Error(sesi.pesan);

  expect((await mulaiPeserta(sesi.sesi.id, 'Rina')).ok).toBe(true);

  const ulang = await mulaiPeserta(sesi.sesi.id, 'rina');
  expect(ulang.ok).toBe(false);
  if (!ulang.ok) expect(ulang.alasan).toBe('nama_terpakai');

  expect((await mulaiPeserta(sesi.sesi.id, 'Rina-2')).ok).toBe(true);
});

test('setelah tutupSekarang, peserta baru tidak bisa masuk tapi yang sedang jalan masih bisa menyetor nilai', async () => {
  const guru = await buatGuru();
  const [k] = await query<{ id: number }>(
    `insert into contents (owner_id, title, main_library, h5p_content_id, source_filename)
     values ($1, 'Crossword', 'H5P.Crossword', '101', 'a.h5p') returning id`,
    [guru],
  );
  const sesi = await buatSesi(guru, {
    contentId: k.id,
    title: 'Sesi',
    pin: '300300',
    opensAt: hari(-1),
    closesAt: hari(4),
  });
  if (!sesi.ok) throw new Error(sesi.pesan);

  const sedangJalan = await mulaiPeserta(sesi.sesi.id, 'Sedang');
  if (!sedangJalan.ok) throw new Error('peserta gagal');

  await tutupSekarang(sesi.sesi.id);

  // Pintu masuk terkunci.
  const pintu = await periksaPin('300300');
  expect(pintu.ok).toBe(false);
  if (!pintu.ok) expect(pintu.alasan).toBe('sudah_ditutup');
  expect((await mulaiPeserta(sesi.sesi.id, 'Terlambat')).ok).toBe(false);

  // Tapi yang sudah masuk tetap bisa menyetor, dan ikut diperingkat.
  expect(await setorNilai(sedangJalan.token, 9)).toBe(200);

  const urut = urutkanPeringkat(await peringkatSesi(sesi.sesi.id));
  expect(urut.map((b) => b.alias)).toEqual(['Sedang']);
});

test('menghapus sesi menghapus nilainya tapi konten tetap bisa dipakai sesi baru', async () => {
  const guru = await buatGuru();
  const [k] = await query<{ id: number }>(
    `insert into contents (owner_id, title, main_library, h5p_content_id, source_filename)
     values ($1, 'Crossword', 'H5P.Crossword', '101', 'a.h5p') returning id`,
    [guru],
  );

  const pertama = await buatSesi(guru, {
    contentId: k.id,
    title: 'Kelas 8A',
    pin: '400400',
    opensAt: hari(-1),
    closesAt: hari(4),
  });
  if (!pertama.ok) throw new Error(pertama.pesan);

  const p = await mulaiPeserta(pertama.sesi.id, 'Rina');
  if (!p.ok) throw new Error('peserta gagal');
  await setorNilai(p.token, 8);

  await query('delete from quiz_sessions where id = $1', [pertama.sesi.id]);

  expect(await query('select id from participants')).toHaveLength(0);
  expect(await query('select id from xapi_events')).toHaveLength(0);

  // Konten masih ada, dan bisa dipakai sesi baru dengan PIN lain.
  const kedua = await buatSesi(guru, {
    contentId: k.id,
    title: 'Kelas 8B',
    pin: '400401',
    opensAt: hari(-1),
    closesAt: hari(4),
  });
  expect(kedua.ok).toBe(true);
});
