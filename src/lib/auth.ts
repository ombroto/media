import { createHmac, timingSafeEqual } from 'node:crypto';
import { query } from '@/lib/db';
import { NAMA_COOKIE_GURU } from '@/lib/nama-cookie';
// Format hash dipegang satu modul JavaScript biasa, supaya skrip seed yang
// dijalankan Node langsung memakai format yang sama persis.
import { hashKataSandi, periksaKataSandi } from '@/lib/password.mjs';

export { hashKataSandi, periksaKataSandi };
export { NAMA_COOKIE_GURU };

const UMUR_SESI_MS = 14 * 24 * 60 * 60 * 1000;

function rahasia(): string {
  const r = process.env.SESSION_SECRET;
  if (!r || r.length < 16) {
    throw new Error('SESSION_SECRET belum diatur atau terlalu pendek — lihat .env.example');
  }
  return r;
}

function tandaTangan(muatan: string): string {
  return createHmac('sha256', rahasia()).update(muatan).digest('base64url');
}

/** Token sesi penyelenggara: `<teacherId>.<kedaluwarsa>.<tanda tangan>`. */
export function buatTokenSesi(teacherId: number, kedaluwarsa?: Date): string {
  const exp = (kedaluwarsa ?? new Date(Date.now() + UMUR_SESI_MS)).getTime();
  const muatan = `${teacherId}.${exp}`;
  return `${muatan}.${tandaTangan(muatan)}`;
}

export function bacaTokenSesi(
  token: string | undefined,
  sekarang = new Date(),
): number | null {
  if (!token) return null;

  const bagian = token.split('.');
  if (bagian.length !== 3) return null;

  const diharap = Buffer.from(tandaTangan(`${bagian[0]}.${bagian[1]}`));
  const diberi = Buffer.from(bagian[2]);
  if (diberi.length !== diharap.length || !timingSafeEqual(diberi, diharap)) return null;

  const teacherId = Number(bagian[0]);
  const exp = Number(bagian[1]);
  if (!Number.isInteger(teacherId) || teacherId <= 0) return null;
  if (!Number.isFinite(exp) || exp <= sekarang.getTime()) return null;

  return teacherId;
}

export type Penyelenggara = { id: number; name: string; email: string };

/**
 * Memeriksa email dan kata sandi. Jawabannya tidak membedakan "email tak
 * terdaftar" dari "kata sandi salah", supaya halaman login tidak bisa dipakai
 * memeriksa siapa yang punya akun.
 */
export async function masuk(
  email: string,
  kataSandi: string,
): Promise<{ ok: true; teacherId: number } | { ok: false }> {
  const [guru] = await query<{ id: number; password_hash: string }>(
    'select id, password_hash from teachers where lower(email) = lower(btrim($1))',
    [email],
  );

  if (!guru) {
    // Tetap menjalankan scrypt sekali, supaya lama jawabannya tidak
    // membocorkan apakah emailnya terdaftar.
    await hashKataSandi(kataSandi);
    return { ok: false };
  }

  const cocok = await periksaKataSandi(kataSandi, guru.password_hash);
  return cocok ? { ok: true, teacherId: guru.id } : { ok: false };
}

export async function penyelenggaraDariToken(
  token: string | undefined,
): Promise<Penyelenggara | null> {
  const id = bacaTokenSesi(token);
  if (id === null) return null;

  const [guru] = await query<Penyelenggara>(
    'select id, name, email from teachers where id = $1',
    [id],
  );
  return guru ?? null;
}

/** Membaca satu cookie dari Request, tanpa bergantung pada next/headers. */
export function cookieDariRequest(req: Request, nama: string): string | undefined {
  const baris = req.headers.get('cookie');
  if (!baris) return undefined;

  for (const bagian of baris.split(';')) {
    const pisah = bagian.indexOf('=');
    if (pisah < 0) continue;
    if (bagian.slice(0, pisah).trim() === nama) {
      return decodeURIComponent(bagian.slice(pisah + 1).trim());
    }
  }
  return undefined;
}

export async function penyelenggaraDariRequest(
  req: Request,
): Promise<Penyelenggara | null> {
  return penyelenggaraDariToken(cookieDariRequest(req, NAMA_COOKIE_GURU));
}
