import Link from 'next/link';
import { redirect } from 'next/navigation';
import PemutarH5P from '@/components/PemutarH5P';
import { pesertaSekarang } from '@/lib/peserta-cookie';
import { bolehMasuk } from '@/lib/session-status';
import PenghitungWaktu from './PenghitungWaktu';

export const metadata = { title: 'Mengerjakan — Sesi H5P' };

export default async function HalamanMengerjakan() {
  const peserta = await pesertaSekarang();
  if (!peserta) redirect('/');

  // Percobaan yang sudah selesai langsung ke halaman hasil.
  if (peserta.finished_at) redirect('/hasil');

  const boleh = bolehMasuk(peserta, new Date());

  return (
    <main className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{peserta.session_title}</h1>
          <p className="text-sm opacity-70">{peserta.alias}</p>
        </div>
        <PenghitungWaktu mulaiIso={peserta.started_at.toISOString()} />
      </header>

      {!boleh.ok ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Sesi ini sudah ditutup. Nilai yang sudah Anda kirim tetap dihitung,
          tapi kontennya tidak bisa dibuka lagi.
        </p>
      ) : (
        <PemutarH5P
          h5pContentId={peserta.h5p_content_id}
          judul={peserta.content_title}
        />
      )}

      {peserta.scoring === 'unscored' ? (
        // Konten tak berskor tidak pernah mengirim tanda selesai, jadi peserta
        // perlu jalan keluar. Tautan ini hanya berpindah halaman — ia tidak
        // mencatat apa pun, sesuai §5.5 yang melarang tombol "saya selesai".
        <p className="text-sm">
          <Link href="/hasil" className="underline">
            sudah selesai, tutup kegiatan ini
          </Link>
        </p>
      ) : (
        <p className="text-sm opacity-70">
          Nilainya tercatat sendiri begitu kontennya selesai — tidak ada tombol
          kirim.
        </p>
      )}
    </main>
  );
}
