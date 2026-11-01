import { cookies } from 'next/headers';
import {
  NAMA_COOKIE_GURU,
  buatTokenSesi,
  penyelenggaraDariToken,
  type Penyelenggara,
} from '@/lib/auth';

/**
 * Pembungkus cookie yang memakai next/headers. Dipisah dari auth.ts supaya
 * logika autentikasinya tetap bisa diuji di luar konteks permintaan Next.
 */

const UMUR_DETIK = 14 * 24 * 60 * 60;

export async function buatSesiPenyelenggara(teacherId: number): Promise<void> {
  const toko = await cookies();
  toko.set(NAMA_COOKIE_GURU, buatTokenSesi(teacherId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: UMUR_DETIK,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function keluar(): Promise<void> {
  const toko = await cookies();
  toko.delete(NAMA_COOKIE_GURU);
}

export async function penyelenggaraSekarang(): Promise<Penyelenggara | null> {
  const toko = await cookies();
  return penyelenggaraDariToken(toko.get(NAMA_COOKIE_GURU)?.value);
}
