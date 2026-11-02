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
    <main className="pita">
      <div className="wadah space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-garis pb-4">
          <div>
            <span className="kerlip">Sedang dikerjakan</span>
            <h1 className="mt-2 text-xl">{peserta.session_title}</h1>
            <p className="text-sm text-abu">{peserta.alias}</p>
          </div>
          <PenghitungWaktu mulaiIso={peserta.started_at.toISOString()} />
        </header>

        {!boleh.ok ? (
          <p className="pesan pesan-ingat">
            Sesi ini sudah ditutup. Nilai yang sudah Anda kirim tetap dihitung,
            tapi kontennya tidak bisa dibuka lagi.
          </p>
        ) : (
          <>
            <PemutarH5P
              h5pContentId={peserta.h5p_content_id}
              judul={peserta.content_title}
            />
            {peserta.scoring === 'unscored' ? (
              <p className="text-sm text-abu">
                Kegiatan ini tidak memberi nilai, jadi tidak ada papan peringkat.
                Kalau sudah selesai, tekan <strong>Kirim jawaban</strong> di bawah
                kontennya untuk menutup kegiatan.
              </p>
            ) : (
              <p className="text-sm text-abu">
                Kerjakan sampai selesai, lalu tekan <strong>Kirim jawaban</strong> di
                bawah kontennya. Setelah itu Anda langsung diarahkan ke papan
                peringkat.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
