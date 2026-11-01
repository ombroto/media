import Link from 'next/link';
import { redirect } from 'next/navigation';
import { periksaPin } from '@/lib/repo/participants';
import { ambilKonten } from '@/lib/repo/contents';
import { pesertaSekarang } from '@/lib/peserta-cookie';
import { waktuPanjang } from '@/lib/waktu';
import FormNama from './FormNama';

export const metadata = { title: 'Mulai — Sesi H5P' };

export default async function HalamanMasukSesi({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  const hasil = await periksaPin(pin);

  if (!hasil.ok) {
    const pesan =
      hasil.alasan === 'format'
        ? 'PIN terdiri dari enam angka.'
        : hasil.alasan === 'tidak_ada'
          ? 'PIN itu tidak ada. Periksa lagi angkanya.'
          : hasil.alasan === 'belum_dibuka'
            ? `Sesi ini belum dibuka. Baru bisa dikerjakan mulai ${
                hasil.sesi ? waktuPanjang(hasil.sesi.opens_at) : 'nanti'
              }.`
            : `Sesi ini sudah ditutup${
                hasil.sesi ? ` pada ${waktuPanjang(hasil.sesi.closes_at)}` : ''
              }.`;

    return (
      <main className="mx-auto max-w-sm space-y-5 py-10 text-center">
        <h1 className="text-xl font-semibold">Belum bisa masuk</h1>
        <p className="text-sm opacity-80">{pesan}</p>
        <Link href="/" className="inline-block text-sm underline">
          coba PIN lain
        </Link>
      </main>
    );
  }

  // Sudah pernah mulai di sesi ini dari peramban yang sama? Lanjutkan saja.
  const peserta = await pesertaSekarang();
  if (peserta && peserta.session_id === hasil.sesi.id) {
    redirect(peserta.finished_at ? '/hasil' : '/play');
  }

  const konten = await ambilKonten(hasil.sesi.content_id);

  return (
    <main className="mx-auto max-w-sm space-y-6 py-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{hasil.sesi.title}</h1>
        <p className="text-sm opacity-70">
          {konten?.title ?? 'Konten interaktif'} · ditutup{' '}
          {waktuPanjang(hasil.sesi.closes_at)}
        </p>
      </header>

      <FormNama pin={hasil.sesi.pin} />

      <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <p className="font-semibold">Kerjakan sekali jalan</p>
        <p>
          Kalau halaman ini ditutup atau dimuat ulang di tengah jalan, kontennya
          mulai dari awal lagi sementara waktu pengerjaan Anda terus berjalan.
        </p>
        <p className="opacity-80">
          Nama hanya bisa dipakai sekali di sesi ini. Kalau ingin mengerjakan
          lagi, gunakan nama lain.
        </p>
      </div>
    </main>
  );
}
