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
    <main>
      <section className="pita-gelap py-10">
        <div className="wadah flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="kerlip">Sesi baru</span>
            <h1 className="mt-2 text-3xl text-white">{konten.title}</h1>
          </div>
          <Link href="/admin" className="tombol tombol-terang tombol-kecil">
            Daftar sesi
          </Link>
        </div>
      </section>

      <section className="pita">
        <div className="wadah max-w-2xl space-y-5">
          {konten.scoring === 'unscored' ? (
            <p className="pesan pesan-ingat">
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
        </div>
      </section>
    </main>
  );
}
