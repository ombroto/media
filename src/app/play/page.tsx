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

      {peserta.scoring !== 'scored' ? (
        // Konten tak berskor tidak pernah mengirim tanda selesai, dan konten
        // yang belum pernah terbukti berskor ('unknown') bisa jadi sama. Tanpa
        // jalan keluar, pesertanya terjebak. Tautan ini hanya berpindah halaman
        // — ia tidak mencatat apa pun, sesuai §5.5 yang melarang tombol "saya
        // selesai".
        <p className="space-y-1 text-sm">
          <span className="block opacity-70">
            Kalau kegiatan ini memang tidak memberi nilai, nilainya tidak akan
            muncul.
          </span>
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
