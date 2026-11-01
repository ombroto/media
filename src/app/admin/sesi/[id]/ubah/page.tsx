import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { ambilKonten } from '@/lib/repo/contents';
import { ambilSesi, jumlahPeserta } from '@/lib/repo/sessions';
import { untukInput } from '@/lib/waktu';
import { aksiUbahSesi } from '../../actions';
import FormSesi from '../../FormSesi';
import FormHapus from './FormHapus';

export const metadata = { title: 'Ubah sesi — Sesi H5P' };

export default async function HalamanUbahSesi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guru = await penyelenggaraSekarang();
  const { id } = await params;
  const sesiId = Number(id);
  if (!guru) redirect(`/admin/login?lanjut=/admin/sesi/${id}/ubah`);
  if (!Number.isInteger(sesiId)) notFound();

  const sesi = await ambilSesi(sesiId);
  if (!sesi || sesi.owner_id !== guru.id) notFound();

  const konten = await ambilKonten(sesi.content_id);
  const peserta = await jumlahPeserta(sesi.id);

  return (
    <main>
      <section className="pita-gelap py-10">
        <div className="wadah flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="kerlip">Ubah sesi</span>
            <h1 className="mt-2 text-3xl text-white">{sesi.title}</h1>
          </div>
          <Link href={`/admin/sesi/${sesi.id}`} className="tombol tombol-terang tombol-kecil">
            Pantau sesi
          </Link>
        </div>
      </section>

      <section className="pita">
        <div className="wadah max-w-2xl space-y-8">
          <FormSesi
            aksi={aksiUbahSesi}
            sesiId={sesi.id}
            judulKonten={konten?.title ?? '(konten tidak ditemukan)'}
            adaPeserta={peserta > 0}
            labelTombol="Simpan perubahan"
            awal={{
              judul: sesi.title,
              pin: sesi.pin,
              dibuka: untukInput(sesi.opens_at),
              ditutup: untukInput(sesi.closes_at),
            }}
          />

          <div id="hapus" className="space-y-3 border-t border-garis pt-6">
            <span className="kerlip">Hapus sesi</span>
            <p className="text-sm text-abu">
              Seluruh nilai {peserta === 0 ? 'peserta' : `${peserta} peserta`} di sesi
              ini akan hilang. Kontennya tetap ada di pustaka.
            </p>
            <FormHapus sesiId={sesi.id} judul={sesi.title} />
          </div>
        </div>
      </section>
    </main>
  );
}
