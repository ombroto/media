import { H5P_USER_PENYELENGGARA, artefakHanyaBaca, getH5P } from '@/lib/h5p';
import { ambilKonten, hapusKonten, type HasilHapusKonten } from '@/lib/repo/contents';

export type HasilHapus =
  | ({ ok: true; judul: string } & HasilHapusKonten)
  | { ok: false; pesan: string };

/**
 * Menghapus satu konten: berkas H5P-nya, barisnya di basis data, dan seluruh
 * sesi yang memakainya.
 *
 * Urutannya disengaja — basis data dulu, berkas belakangan. Kalau berkasnya
 * yang duluan dihapus lalu transaksi gagal, kita punya baris konten yang
 * menunjuk berkas tidak ada: persis keadaan yang dulu membuat satu konten
 * selalu gagal dimuat tanpa ada cara membereskannya dari antarmuka.
 */
export async function hapusKontenLengkap(
  ownerId: number,
  contentId: number,
): Promise<HasilHapus> {
  if (artefakHanyaBaca()) {
    return {
      ok: false,
      pesan:
        'Konten tidak bisa dihapus dari situs yang sudah ter-deploy, karena berkasnya ikut dibawa dalam deployment. Hapus di komputer Anda, lalu commit dan push.',
    };
  }

  const konten = await ambilKonten(contentId);
  if (!konten || konten.owner_id !== ownerId) {
    return { ok: false, pesan: 'Konten tidak ditemukan di pustaka Anda.' };
  }

  const hasil = await hapusKonten(contentId);

  // Berkas H5P dihapus setelah basis datanya bersih. Kegagalan di sini hanya
  // menyisakan berkas yatim di disk — mengganggu, tapi tidak merusak apa pun
  // yang dilihat pemakai.
  try {
    const { editor } = getH5P();
    await editor.deleteContent(konten.h5p_content_id, H5P_USER_PENYELENGGARA);
  } catch {
    // Berkasnya memang bisa saja sudah tidak ada sejak awal.
  }

  return { ok: true, judul: konten.title, ...hasil };
}
