import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { NAMA_COOKIE_GURU, buatTokenSesi, hashKataSandi } from '@/lib/auth';
import { pool, query } from '@/lib/db';
import { periksaAksesH5P } from '@/lib/h5p-access';

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

async function buatGuru() {
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ('guru@contoh.id', $1, 'Bu Guru') returning id`,
    [await hashKataSandi('sandi-rahasia-123')],
  );
  return g.id;
}

const reqKosong = () => new Request('http://localhost/h5p/content/1/gambar.png');

const reqGuru = (token: string) =>
  new Request('http://localhost/h5p/content/1/gambar.png', {
    headers: { cookie: `${NAMA_COOKIE_GURU}=${encodeURIComponent(token)}` },
  });

test('permintaan tanpa kredensial apa pun menghasilkan null', async () => {
  expect(await periksaAksesH5P(reqKosong(), '1')).toBeNull();
});

test('cookie penyelenggara yang sah menghasilkan jenis penyelenggara', async () => {
  const id = await buatGuru();
  const akses = await periksaAksesH5P(reqGuru(buatTokenSesi(id)), '1');
  expect(akses).toEqual({ jenis: 'penyelenggara', teacherId: id });
});

test('cookie penyelenggara palsu menghasilkan null', async () => {
  await buatGuru();
  expect(await periksaAksesH5P(reqGuru('1.9999999999999.palsu'), '1')).toBeNull();
});

test('cookie penyelenggara kedaluwarsa menghasilkan null', async () => {
  const id = await buatGuru();
  const token = buatTokenSesi(id, new Date(Date.now() - 1000));
  expect(await periksaAksesH5P(reqGuru(token), '1')).toBeNull();
});

test('penyelenggara boleh mengambil berkas konten mana pun miliknya', async () => {
  const id = await buatGuru();
  const akses = await periksaAksesH5P(reqGuru(buatTokenSesi(id)), '99887766');
  expect(akses).toMatchObject({ jenis: 'penyelenggara' });
});
