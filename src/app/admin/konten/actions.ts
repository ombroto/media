'use server';

import { revalidatePath } from 'next/cache';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { telanDanSimpan } from '@/lib/unggah-konten';

export type KeadaanUnggah = {
  galat?: string;
  berhasil?: string;
  pustakaTerpasang?: string[];
  pustakaKurang?: string[];
};

export async function aksiUnggahKonten(
  _sebelumnya: KeadaanUnggah,
  data: FormData,
): Promise<KeadaanUnggah> {
  const guru = await penyelenggaraSekarang();
  if (!guru) return { galat: 'Sesi Anda sudah berakhir. Masuk lagi untuk mengunggah.' };

  const berkas = data.get('berkas');
  if (!(berkas instanceof File) || berkas.size === 0) {
    return { galat: 'Pilih dulu berkas .h5p yang mau diunggah.' };
  }

  const hasil = await telanDanSimpan(guru.id, berkas);

  if (!hasil.ok) {
    return { galat: hasil.pesan, pustakaKurang: hasil.pustakaKurang };
  }

  revalidatePath('/admin/konten');

  return {
    berhasil: hasil.hanyaPustaka
      ? 'Berkas ini berisi pustaka saja, bukan konten — pustakanya sudah dipasang.'
      : `"${hasil.judul}" siap dipakai.`,
    pustakaTerpasang: hasil.pustakaTerpasang,
  };
}
