import { afterAll, beforeEach, expect, test } from 'vitest';
import { masuk } from '@/lib/auth';
import { pool, query } from '@/lib/db';
// Skrip seed dijalankan Node langsung, jadi diuji sebagai modul apa adanya.
import { buatAtauPerbaruiPenyelenggara } from '../scripts/seed-teacher.mjs';

beforeEach(async () => {
  await query(
    'truncate xapi_events, participants, quiz_sessions, contents, teachers restart identity cascade',
  );
});

afterAll(async () => {
  await pool.end();
});

test('seed membuat penyelenggara yang bisa langsung masuk', async () => {
  const id = await buatAtauPerbaruiPenyelenggara(pool, {
    email: 'guru@contoh.id',
    name: 'Bu Guru',
    kataSandi: 'sandi-rahasia-123',
  });

  expect(id).toBeGreaterThan(0);
  expect(await masuk('guru@contoh.id', 'sandi-rahasia-123')).toEqual({
    ok: true,
    teacherId: id,
  });
});

test('kata sandi tidak disimpan apa adanya', async () => {
  await buatAtauPerbaruiPenyelenggara(pool, {
    email: 'guru@contoh.id',
    name: 'Bu Guru',
    kataSandi: 'sandi-rahasia-123',
  });

  const [g] = await query<{ password_hash: string }>(
    'select password_hash from teachers where email = $1',
    ['guru@contoh.id'],
  );
  expect(g.password_hash).not.toContain('sandi-rahasia-123');
  expect(g.password_hash.startsWith('scrypt$')).toBe(true);
});

test('seed ulang pada email yang sama memperbarui kata sandi, bukan menduplikasi', async () => {
  const pertama = await buatAtauPerbaruiPenyelenggara(pool, {
    email: 'guru@contoh.id',
    name: 'Bu Guru',
    kataSandi: 'sandi-lama-123456',
  });
  const kedua = await buatAtauPerbaruiPenyelenggara(pool, {
    email: 'guru@contoh.id',
    name: 'Bu Guru',
    kataSandi: 'sandi-baru-123456',
  });

  expect(kedua).toBe(pertama);
  expect(await query('select id from teachers')).toHaveLength(1);
  expect(await masuk('guru@contoh.id', 'sandi-lama-123456')).toEqual({ ok: false });
  expect(await masuk('guru@contoh.id', 'sandi-baru-123456')).toEqual({
    ok: true,
    teacherId: pertama,
  });
});

test('kata sandi terlalu pendek ditolak', async () => {
  await expect(
    buatAtauPerbaruiPenyelenggara(pool, {
      email: 'guru@contoh.id',
      name: 'Bu Guru',
      kataSandi: 'pendek',
    }),
  ).rejects.toThrow(/kata sandi/i);
});

test('email tanpa tanda at ditolak', async () => {
  await expect(
    buatAtauPerbaruiPenyelenggara(pool, {
      email: 'bukan-email',
      name: 'Bu Guru',
      kataSandi: 'sandi-rahasia-123',
    }),
  ).rejects.toThrow(/email/i);
});
