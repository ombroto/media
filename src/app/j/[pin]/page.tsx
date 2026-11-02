import Link from 'next/link';
import { redirect } from 'next/navigation';
import { periksaPin } from '@/lib/repo/participants';
import { akhirEfektif } from '@/lib/session-status';
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
                // akhirEfektif, bukan closes_at: sesi yang ditutup lebih cepat
                // akan menyebut tanggal di masa depan kalau memakai jadwalnya.
                hasil.sesi ? ` pada ${waktuPanjang(akhirEfektif(hasil.sesi))}` : ''
              }.`;

    return (
      <main className="pita">
        <div className="wadah-sempit text-center">
          <span className="kerlip">Belum bisa masuk</span>
          <h1 className="judul-seksi mt-3">PIN ini tidak bisa dipakai</h1>
          <p className="mt-3 text-sm leading-relaxed text-abu">{pesan}</p>
          <Link href="/" className="tombol tombol-utama mt-6">
            Coba PIN lain
          </Link>
        </div>
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
    <main className="pita">
      <div className="wadah-sempit space-y-6">
        <header className="space-y-2">
          <span className="kerlip">Sesi terbuka</span>
          <h1 className="text-2xl">{hasil.sesi.title}</h1>
          <p className="text-sm text-abu">
            {konten?.title ?? 'Konten interaktif'} · ditutup{' '}
            {waktuPanjang(hasil.sesi.closes_at)}
          </p>
        </header>

        {konten?.scoring === 'unscored' ? (
          // Peserta harus tahu sebelum mengisi nama, bukan setelah selesai:
          // kegiatan ini tidak memberi nilai, jadi tidak ada yang diperingkat.
          <div className="pesan space-y-1">
            <p className="font-semibold">Kegiatan ini tanpa nilai</p>
            <p className="opacity-80">
              {konten.title} tidak mengirimkan nilai, jadi sesi ini tidak punya
              papan peringkat. Yang tercatat hanya bahwa Anda sudah membukanya.
            </p>
          </div>
        ) : null}

        <div className="kartu p-6">
          <FormNama pin={hasil.sesi.pin} />
        </div>

        <div className="pesan pesan-ingat space-y-2">
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
      </div>
    </main>
  );
}
