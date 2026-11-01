import { penyelenggaraDariRequest } from '@/lib/auth';

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
 *
 * Cabang peserta ditambahkan di Tugas 8; tanda tangan fungsi ini tidak berubah
 * supaya rute tidak perlu disentuh lagi.
 */
export async function periksaAksesH5P(
  req: Request,
  h5pContentId: string,
): Promise<AksesH5P> {
  const guru = await penyelenggaraDariRequest(req);
  if (guru) return { jenis: 'penyelenggara', teacherId: guru.id };

  void h5pContentId;
  return null;
}
