import Link from 'next/link';
import { notFound } from 'next/navigation';
import PemutarH5P from '@/components/PemutarH5P';

/**
 * Halaman uji coba untuk penyelenggara: memutar satu konten langsung dari
 * nomornya, tanpa sesi dan tanpa PIN. Dipakai untuk memastikan pemutarnya
 * benar-benar jalan; alur peserta ada di /play.
 */
export default async function HalamanUjiPutar({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  if (!/^\d+$/.test(contentId)) notFound();

  return (
    <main className="pita">
      <div className="wadah space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-garis pb-4">
          <div>
            <span className="kerlip">Pratinjau</span>
            <h1 className="mt-2 text-2xl">Uji putar konten</h1>
            <p className="text-sm text-abu">Nomor konten {contentId}</p>
          </div>
          <Link href="/admin/konten" className="tombol tombol-garis tombol-kecil">
            Pustaka konten
          </Link>
        </header>

        <PemutarH5P h5pContentId={contentId} />

        <p className="text-sm text-abu">
          Halaman ini hanya untuk memeriksa konten. Skor yang terkirim dari sini
          tidak dicatat karena belum ada peserta maupun sesi.
        </p>
      </div>
    </main>
  );
}
