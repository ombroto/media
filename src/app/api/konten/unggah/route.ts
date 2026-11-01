import { penyelenggaraDariRequest } from '@/lib/auth';
import { telanDanSimpan } from '@/lib/unggah-konten';

/**
 * Unggah konten lewat route handler, bukan server action.
 *
 * Alasannya penting: server action di Next punya batas badan permintaan 1 MB
 * yang tidak bisa dinaikkan dari dalam kode kita, dan pelanggarannya menjadi
 * 413 tanpa pesan SEBELUM pemeriksaan apa pun berjalan. Dua dari sembilan
 * berkas pemilik berukuran 3,4 MB dan 8,5 MB, jadi lewat server action keduanya
 * mati tanpa penjelasan. Route handler tidak punya batas itu, sehingga seluruh
 * pemeriksaan di telanDanSimpan — termasuk batas 64 MB kita sendiri — benar-benar
 * berjalan dan pesannya tetap bahasa Indonesia.
 */
export async function POST(req: Request) {
  const guru = await penyelenggaraDariRequest(req);
  if (!guru) {
    return Response.json(
      { ok: false, pesan: 'Sesi Anda sudah berakhir. Masuk lagi untuk mengunggah.' },
      { status: 403 },
    );
  }

  let data: FormData;
  try {
    data = await req.formData();
  } catch {
    return Response.json(
      { ok: false, pesan: 'Unggahan tidak terbaca. Coba pilih berkasnya lagi.' },
      { status: 400 },
    );
  }

  const berkas = data.get('berkas');
  if (!(berkas instanceof File) || berkas.size === 0) {
    return Response.json(
      { ok: false, pesan: 'Pilih dulu berkas .h5p yang mau diunggah.' },
      { status: 400 },
    );
  }

  const hasil = await telanDanSimpan(guru.id, berkas);

  if (!hasil.ok) {
    return Response.json(
      { ok: false, pesan: hasil.pesan, pustakaKurang: hasil.pustakaKurang ?? [] },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    hanyaPustaka: hasil.hanyaPustaka,
    judul: hasil.judul,
    pustakaTerpasang: hasil.pustakaTerpasang,
  });
}
