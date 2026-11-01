import { cookieDariRequest, penyelenggaraDariRequest } from '@/lib/auth';
import { NAMA_COOKIE_PESERTA } from '@/lib/nama-cookie';
import { pesertaDariToken } from '@/lib/participant';
import { bolehMasuk } from '@/lib/session-status';

export type AksesH5P =
  | { jenis: 'penyelenggara'; teacherId: number }
  | { jenis: 'peserta'; participantId: number; sessionId: number; h5pContentId: string }
  | null;

/**
 * Siapa yang boleh mengambil berkas konten H5P (§7.3).
 *
 * Menolak secara bawaan: tanpa kredensial yang sah, jawabannya `null` dan rute
 * pemanggil wajib membalas 403. Kalau berkas konten boleh diambil anonim, siapa
 * pun yang menebak nomor konten bisa membaca kuisnya sebelum sesinya dibuka,
 * dan PIN kehilangan artinya.
 */
export async function periksaAksesH5P(
  req: Request,
  h5pContentId: string,
): Promise<AksesH5P> {
  const guru = await penyelenggaraDariRequest(req);
  if (guru) return { jenis: 'penyelenggara', teacherId: guru.id };

  const peserta = await pesertaDariToken(
    cookieDariRequest(req, NAMA_COOKIE_PESERTA),
  );
  if (!peserta) return null;

  // Hanya konten milik sesinya sendiri, dan hanya selama jendelanya terbuka.
  if (peserta.h5p_content_id !== h5pContentId) return null;
  if (!bolehMasuk(peserta, new Date()).ok) return null;

  return {
    jenis: 'peserta',
    participantId: peserta.id,
    sessionId: peserta.session_id,
    h5pContentId: peserta.h5p_content_id,
  };
}
