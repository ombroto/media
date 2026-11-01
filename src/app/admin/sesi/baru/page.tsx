import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { buatPinBaru } from '@/lib/pin';
import { ambilKonten } from '@/lib/repo/contents';
import { untukInput } from '@/lib/waktu';
import { aksiBuatSesi } from '../actions';
import FormSesi from '../FormSesi';

export const metadata = { title: 'Sesi baru — Sesi H5P' };

export default async function HalamanSesiBaru({
  searchParams,
}: {
  searchParams: Promise<{ konten?: string }>;
}) {
  const guru = await penyelenggaraSekarang();
  if (!guru) redirect('/admin/login?lanjut=/admin/sesi/baru');

  const { konten: kontenParam } = await searchParams;
  const kontenId = Number(kontenParam);
  if (!Number.isInteger(kontenId)) notFound();

  const konten = await ambilKonten(kontenId);
  if (!konten || konten.owner_id !== guru.id) notFound();

  const sekarang = new Date();
  const seminggu = new Date(sekarang.getTime() + 7 * 24 * 3600 * 1000);

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Sesi baru</h1>
        <Link href="/admin" className="text-sm underline opacity-70">
          daftar sesi
        </Link>
      </header>

      {konten.scoring === 'unscored' ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Tipe konten ini tidak pernah mengirim nilai, jadi sesinya tidak punya
          papan peringkat. Yang terlihat hanya siapa saja yang sudah membuka.
        </p>
      ) : null}

      <FormSesi
        aksi={aksiBuatSesi}
        kontenId={konten.id}
        judulKonten={konten.title}
        labelTombol="Simpan & tampilkan PIN"
        awal={{
          judul: konten.title,
          pin: await buatPinBaru(),
          dibuka: untukInput(sekarang),
          ditutup: untukInput(seminggu),
        }}
      />
    </main>
  );
}
