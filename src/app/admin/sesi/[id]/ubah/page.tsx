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
    <main className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Ubah sesi</h1>
        <Link href={`/admin/sesi/${sesi.id}`} className="text-sm underline opacity-70">
          pantau sesi
        </Link>
      </header>

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

      <section id="hapus" className="space-y-3 border-t border-black/15 pt-6 dark:border-white/20">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Hapus sesi
        </h2>
        <p className="text-sm opacity-70">
          Seluruh nilai {peserta === 0 ? 'peserta' : `${peserta} peserta`} di sesi ini
          akan hilang. Kontennya tetap ada di pustaka.
        </p>
        <FormHapus sesiId={sesi.id} judul={sesi.title} />
      </section>
    </main>
  );
}
