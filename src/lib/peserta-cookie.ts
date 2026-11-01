import { cookies } from 'next/headers';
import { NAMA_COOKIE_PESERTA } from '@/lib/nama-cookie';
import { pesertaDariToken, type PesertaLengkap } from '@/lib/participant';

/** Cookie peserta, umurnya sependek jendela sesi yang masuk akal. */
const UMUR_DETIK = 30 * 24 * 60 * 60;

export async function simpanTokenPeserta(token: string): Promise<void> {
  const toko = await cookies();
  toko.set(NAMA_COOKIE_PESERTA, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: UMUR_DETIK,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function pesertaSekarang(): Promise<PesertaLengkap | null> {
  const toko = await cookies();
  return pesertaDariToken(toko.get(NAMA_COOKIE_PESERTA)?.value);
}
