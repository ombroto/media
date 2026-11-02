import { BATAS_UNGGAH, H5P_USER_PENYELENGGARA, artefakHanyaBaca } from '@/lib/h5p';
import { telanPaket } from '@/lib/h5p-ingest';
import { simpanKonten } from '@/lib/repo/contents';

export type HasilUnggah =
  | {
      ok: true;
      hanyaPustaka: boolean;
      judul: string;
      kontenId: number | null;
      pustakaTerpasang: string[];
    }
  | { ok: false; pesan: string; pustakaKurang?: string[] };

/**
 * Menelan satu berkas unggahan lalu mencatatnya sebagai konten.
 *
 * Dipisah dari server action supaya seluruh jalurnya bisa diuji tanpa konteks
 * permintaan Next; action-nya tinggal memeriksa siapa yang masuk lalu memanggil
 * ini.
 */
export async function telanDanSimpan(ownerId: number, berkas: File): Promise<HasilUnggah> {
  if (artefakHanyaBaca()) {
    // Di Vercel, pustaka dan konten ikut dibawa dalam bundel dan disknya tidak
    // bisa ditulis. Unggahan dikerjakan di mesin lokal lalu di-deploy ulang.
    return {
      ok: false,
      pesan:
        'Unggahan tidak bisa dilakukan dari situs yang sudah ter-deploy. Unggah di komputer Anda, lalu commit dan push — konten barunya ikut terbawa pada deploy berikutnya.',
    };
  }

  if (berkas.size === 0) {
    return { ok: false, pesan: 'Berkasnya kosong — pilih berkas .h5p yang benar.' };
  }
  if (berkas.size > BATAS_UNGGAH) {
    return { ok: false, pesan: 'Berkas terlalu besar — batasnya 64 MB.' };
  }

  const hasil = await telanPaket(
    Buffer.from(await berkas.arrayBuffer()),
    berkas.name,
    H5P_USER_PENYELENGGARA,
  );

  if (!hasil.ok) {
    return { ok: false, pesan: hasil.pesan, pustakaKurang: hasil.pustakaKurang };
  }

  if (hasil.hanyaPustaka) {
    return {
      ok: true,
      hanyaPustaka: true,
      judul: hasil.title,
      kontenId: null,
      pustakaTerpasang: hasil.pustakaTerpasang,
    };
  }

  const konten = await simpanKonten(ownerId, {
    title: hasil.title,
    mainLibrary: hasil.mainLibrary,
    h5pContentId: hasil.h5pContentId,
    sourceFilename: berkas.name,
  });

  return {
    ok: true,
    hanyaPustaka: false,
    judul: konten.title,
    kontenId: konten.id,
    pustakaTerpasang: hasil.pustakaTerpasang,
  };
}
