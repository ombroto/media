import { notFound } from 'next/navigation';
import PemutarH5P from '@/components/PemutarH5P';

/**
 * Halaman uji coba untuk penyelenggara: memutar satu konten langsung dari
 * nomornya, tanpa sesi dan tanpa PIN. Dipakai untuk memastikan pemutarnya
 * benar-benar jalan; alur peserta ada di /play/[token].
 */
export default async function HalamanUjiPutar({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  if (!/^\d+$/.test(contentId)) notFound();

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Uji putar konten</h1>
        <p className="text-sm opacity-70">Nomor konten {contentId}</p>
      </header>

      <PemutarH5P h5pContentId={contentId} />

      <p className="text-sm opacity-70">
        Halaman ini hanya untuk memeriksa konten. Skor yang terkirim dari sini
        tidak dicatat karena belum ada peserta maupun sesi.
      </p>
    </main>
  );
}
