import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import {
  NAMA_COOKIE_GURU,
  bacaTokenSesi,
  buatTokenSesi,
  cookieDariRequest,
  hashKataSandi,
  masuk,
  penyelenggaraDariRequest,
  periksaKataSandi,
} from '@/lib/auth';
import { pool, query } from '@/lib/db';

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

async function buatGuru(email = 'guru@contoh.id', kataSandi = 'sandi-rahasia-123') {
  const hash = await hashKataSandi(kataSandi);
  const [g] = await query<{ id: number }>(
    `insert into teachers (email, password_hash, name)
     values ($1, $2, 'Bu Guru') returning id`,
    [email, hash],
  );
  return g.id;
}

function requestDenganCookie(nilai: string): Request {
  return new Request('http://localhost/uji', {
    headers: { cookie: `${NAMA_COOKIE_GURU}=${encodeURIComponent(nilai)}` },
  });
}

test('kata sandi yang benar cocok dengan hash-nya', async () => {
  const hash = await hashKataSandi('sandi-rahasia-123');
  expect(await periksaKataSandi('sandi-rahasia-123', hash)).toBe(true);
});

test('kata sandi yang salah tidak cocok', async () => {
  const hash = await hashKataSandi('sandi-rahasia-123');
  expect(await periksaKataSandi('sandi-rahasia-124', hash)).toBe(false);
});

test('kata sandi sama menghasilkan hash berbeda karena ada salt', async () => {
  const a = await hashKataSandi('sandi-rahasia-123');
  const b = await hashKataSandi('sandi-rahasia-123');
  expect(a).not.toBe(b);
});

test('hash yang rusak ditolak tanpa melempar', async () => {
  expect(await periksaKataSandi('apa pun', 'bukan-format-hash')).toBe(false);
  expect(await periksaKataSandi('apa pun', 'scrypt$x$y$z$aa$bb')).toBe(false);
});

test('token sesi bisa dibaca kembali', () => {
  const token = buatTokenSesi(7);
  expect(bacaTokenSesi(token)).toBe(7);
});

test('token yang dirusak tandanya ditolak', () => {
  const token = buatTokenSesi(7);
  const rusak = `${token.slice(0, -2)}xx`;
  expect(bacaTokenSesi(rusak)).toBeNull();
});

test('token dengan id yang ditukar ditolak karena tanda tangannya tak cocok', () => {
  const token = buatTokenSesi(7);
  const bagian = token.split('.');
  expect(bacaTokenSesi(`9.${bagian[1]}.${bagian[2]}`)).toBeNull();
});

test('token kedaluwarsa ditolak', () => {
  const token = buatTokenSesi(7, new Date(Date.now() - 1000));
  expect(bacaTokenSesi(token)).toBeNull();
});

test('token kosong atau asal ditolak', () => {
  expect(bacaTokenSesi(undefined)).toBeNull();
  expect(bacaTokenSesi('')).toBeNull();
  expect(bacaTokenSesi('a.b')).toBeNull();
});

test('masuk dengan kata sandi benar mengembalikan teacherId', async () => {
  const id = await buatGuru();
  expect(await masuk('guru@contoh.id', 'sandi-rahasia-123')).toEqual({
    ok: true,
    teacherId: id,
  });
});

test('masuk dengan kata sandi salah gagal', async () => {
  await buatGuru();
  expect(await masuk('guru@contoh.id', 'salah')).toEqual({ ok: false });
});

test('masuk dengan email tak terdaftar gagal dengan bentuk jawaban yang sama', async () => {
  await buatGuru();
  const tidakAda = await masuk('bukan@contoh.id', 'sandi-rahasia-123');
  const sandiSalah = await masuk('guru@contoh.id', 'salah');
  expect(tidakAda).toEqual(sandiSalah);
});

test('email dibandingkan tanpa pandang huruf besar dan spasi', async () => {
  const id = await buatGuru();
  expect(await masuk('  GURU@Contoh.ID ', 'sandi-rahasia-123')).toEqual({
    ok: true,
    teacherId: id,
  });
});

test('cookieDariRequest membaca cookie yang benar di antara beberapa cookie', () => {
  const req = new Request('http://localhost/uji', {
    headers: { cookie: `lain=1; ${NAMA_COOKIE_GURU}=abc; lagi=2` },
  });
  expect(cookieDariRequest(req, NAMA_COOKIE_GURU)).toBe('abc');
});

test('penyelenggaraDariRequest mengembalikan guru untuk cookie yang sah', async () => {
  const id = await buatGuru();
  const guru = await penyelenggaraDariRequest(requestDenganCookie(buatTokenSesi(id)));
  expect(guru).toMatchObject({ id, name: 'Bu Guru' });
});

test('penyelenggaraDariRequest mengembalikan null tanpa cookie', async () => {
  const req = new Request('http://localhost/uji');
  expect(await penyelenggaraDariRequest(req)).toBeNull();
});

test('penyelenggaraDariRequest menolak cookie palsu', async () => {
  await buatGuru();
  expect(await penyelenggaraDariRequest(requestDenganCookie('1.9999999999999.palsu'))).toBeNull();
});

test('token sah untuk guru yang sudah dihapus mengembalikan null', async () => {
  const id = await buatGuru();
  const token = buatTokenSesi(id);
  await query('delete from teachers where id = $1', [id]);
  expect(await penyelenggaraDariRequest(requestDenganCookie(token))).toBeNull();
});
