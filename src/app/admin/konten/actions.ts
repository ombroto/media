'use server';

import { revalidatePath } from 'next/cache';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { ambilKonten, tandaiScoring } from '@/lib/repo/contents';
import { hapusKontenLengkap } from '@/lib/hapus-konten';

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

export type KeadaanHapusKonten = { galat?: string };

/**
 * Menghapus konten beserta seluruh sesinya.
 *
 * Judul kontennya harus diketik ulang. Itu bukan basa-basi: yang hilang bukan
 * cuma kontennya, melainkan setiap sesi yang memakainya beserta seluruh nilai
 * pesertanya — dan tidak ada cara mengembalikannya.
 */
export async function aksiHapusKonten(
  _sebelumnya: KeadaanHapusKonten,
  data: FormData,
): Promise<KeadaanHapusKonten> {
  const guru = await penyelenggaraSekarang();
  if (!guru) return { galat: 'Sesi Anda sudah berakhir. Masuk lagi.' };

  const kontenId = Number(data.get('kontenId'));
  if (!Number.isInteger(kontenId)) return { galat: 'Konten tidak ditemukan.' };

  const konten = await ambilKonten(kontenId);
  if (!konten || konten.owner_id !== guru.id) {
    return { galat: 'Konten tidak ditemukan di pustaka Anda.' };
  }

  const ketikan = String(data.get('konfirmasi') ?? '').trim();
  if (ketikan !== konten.title.trim()) {
    return { galat: 'Judul yang diketik belum cocok. Konten tidak jadi dihapus.' };
  }

  const hasil = await hapusKontenLengkap(guru.id, kontenId);
  if (!hasil.ok) return { galat: hasil.pesan };

  revalidatePath('/admin/konten');
  revalidatePath('/admin');
  return {};
}
