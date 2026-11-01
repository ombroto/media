'use server';

import { revalidatePath } from 'next/cache';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { ambilKonten, tandaiScoring } from '@/lib/repo/contents';

/**
 * Menandai sebuah konten sebagai tidak memberi nilai.
 *
 * Daftar tipe tak berskor yang dibawa kode tidak mungkin lengkap — H5P punya
 * puluhan tipe. Tanpa jalan ini, konten tak berskor yang tidak ada di daftar
 * akan selamanya berstatus "unknown": pesertanya tercatat "belum selesai"
 * padahal sudah selesai, dan sesinya tetap menjanjikan papan peringkat yang
 * tidak akan pernah terisi.
 */
export async function aksiTandaiTanpaSkor(data: FormData): Promise<void> {
  const guru = await penyelenggaraSekarang();
  if (!guru) return;

  const kontenId = Number(data.get('kontenId'));
  if (!Number.isInteger(kontenId)) return;

  const konten = await ambilKonten(kontenId);
  if (!konten || konten.owner_id !== guru.id) return;

  await tandaiScoring(kontenId, 'unscored');
  revalidatePath('/admin/konten');
  revalidatePath('/admin');
}
