import Link from 'next/link';
import { redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { daftarKonten } from '@/lib/repo/contents';
import FormUnggah from './FormUnggah';
import { aksiTandaiTanpaSkor } from './actions';

export const metadata = { title: 'Pustaka konten — Sesi H5P' };

export default async function HalamanPustakaKonten() {
  const guru = await penyelenggaraSekarang();
  if (!guru) redirect('/admin/login?lanjut=/admin/konten');

  const daftar = await daftarKonten(guru.id);

  return (
    <main>
      <section className="pita-gelap py-10">
        <div className="wadah flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="kerlip">Pustaka</span>
            <h1 className="mt-2 text-3xl text-white">Konten H5P</h1>
            <p className="mt-1 max-w-md text-sm text-white/60">
              Unggah sekali, pakai untuk banyak sesi. Pustaka tipe kontennya
              diunduh otomatis kalau belum ada di server.
            </p>
          </div>
          <Link href="/admin" className="tombol tombol-terang tombol-kecil">
            Daftar sesi
          </Link>
        </div>
      </section>

      <section className="pita">
        <div className="wadah space-y-8">
          <FormUnggah />

          <div className="space-y-4">
            <span className="kerlip">Konten Anda</span>

            {daftar.length === 0 ? (
              <p className="text-sm text-abu">
                Belum ada konten. Unggah satu berkas .h5p untuk mulai.
              </p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {daftar.map((k) => (
                  <li key={k.id} className="kartu flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg leading-snug">{k.title}</h2>
                      {k.scoring === 'unscored' ? (
                        <span className="lencana">tanpa peringkat</span>
                      ) : null}
                    </div>

                    <p className="text-xs text-abu">
                      {k.main_library}
                      {' · '}
                      {k.jumlah_sesi === 0 ? 'belum dipakai' : `${k.jumlah_sesi} sesi`}
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                      <Link
                        href={`/admin/sesi/baru?konten=${k.id}`}
                        className="tombol tombol-utama tombol-kecil"
                      >
                        Buat sesi
                      </Link>
                      <Link
                        href={`/dev/play/${k.h5p_content_id}`}
                        className="tombol tombol-garis tombol-kecil"
                      >
                        Pratinjau
                      </Link>
                      {k.scoring === 'unknown' ? (
                        <form action={aksiTandaiTanpaSkor}>
                          <input type="hidden" name="kontenId" value={k.id} />
                          <button
                            type="submit"
                            className="text-xs text-abu underline hover:text-tinta"
                          >
                            tandai tanpa skor
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {daftar.some((k) => k.scoring === 'unscored') ? (
              <p className="text-xs text-abu">
                Konten bertanda &quot;tanpa peringkat&quot; memang tidak pernah mengirim
                nilai, jadi sesinya hanya menampilkan siapa yang sudah membuka.
              </p>
            ) : null}

            {daftar.some((k) => k.scoring === 'unknown') ? (
              <p className="text-xs text-abu">
                Kalau sebuah konten ternyata tidak memberi nilai sama sekali, tandai
                lewat &quot;tandai tanpa skor&quot; — pesertanya akan mendapat halaman
                penutup, bukan tercatat belum selesai.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
