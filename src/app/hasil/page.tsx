import Link from 'next/link';
import { redirect } from 'next/navigation';
import PapanPeringkat from '@/components/PapanPeringkat';
import { pesertaSekarang } from '@/lib/peserta-cookie';
import { urutkanPeringkat } from '@/lib/ranking';
import { peringkatSesi } from '@/lib/repo/peringkat';
import { durasiSingkat } from '@/lib/waktu';

export const metadata = { title: 'Hasil — Sesi H5P' };

export default async function HalamanHasil() {
  const peserta = await pesertaSekarang();
  if (!peserta) redirect('/');

  // Konten yang memang tidak pernah mengirim nilai tidak punya papan
  // peringkat (§5.5). Halaman ini tetap ada — bukan 404 — supaya peserta
  // mendapat penutup yang jelas.
  if (peserta.scoring === 'unscored') {
    return (
      <main className="mx-auto max-w-sm space-y-4 py-10 text-center">
        <h1 className="text-xl font-semibold">Selesai</h1>
        <p className="text-sm opacity-80">
          Terima kasih, {peserta.alias}. Kegiatan ini tidak memberi nilai, jadi
          sesi ini tidak punya papan peringkat.
        </p>
        <Link href="/" className="inline-block text-sm underline">
          kembali ke awal
        </Link>
      </main>
    );
  }

  if (!peserta.finished_at) {
    // Konten yang belum pernah terbukti memberi nilai ('unknown') mungkin
    // memang tak berskor. Kalau peserta hanya dipantulkan ke /play, ia
    // terjebak bolak-balik tanpa penutup, jadi di sini selalu ada jalan keluar.
    const mungkinTakBerskor = peserta.scoring !== 'scored';

    return (
      <main className="mx-auto max-w-sm space-y-4 py-10 text-center">
        <h1 className="text-xl font-semibold">Belum ada nilai</h1>
        <p className="text-sm opacity-80">
          {mungkinTakBerskor
            ? `Terima kasih, ${peserta.alias}. Kegiatan ini belum mengirimkan nilai apa pun — bisa jadi memang tidak memberi nilai.`
            : 'Nilai Anda belum masuk. Selesaikan dulu kontennya.'}
        </p>
        <p className="space-x-4">
          <Link href="/play" className="text-sm underline">
            kembali mengerjakan
          </Link>
          {mungkinTakBerskor ? (
            <Link href="/" className="text-sm underline opacity-70">
              sudah cukup, keluar
            </Link>
          ) : null}
        </p>
      </main>
    );
  }

  const baris = urutkanPeringkat(await peringkatSesi(peserta.session_id));
  const saya = baris.find((b) => b.id === peserta.id);

  return (
    <main className="mx-auto max-w-md space-y-6 py-8">
      <header className="space-y-1 text-center">
        <p className="text-sm opacity-70">{peserta.session_title}</p>
        <p className="text-5xl font-semibold tabular-nums">
          {peserta.score_raw}
          <span className="text-2xl opacity-60">/{peserta.score_max}</span>
        </p>
        <p className="text-sm opacity-70">
          selesai dalam{' '}
          {durasiSingkat(peserta.finished_at.getTime() - peserta.started_at.getTime())}
          {saya ? ` · peringkat ${saya.peringkat} dari ${baris.length}` : null}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Papan peringkat
        </h2>
        <PapanPeringkat baris={baris} sorotiId={peserta.id} />
      </section>

      <p className="text-center text-xs opacity-70">
        Ingin mencoba lagi? Masuk kembali dengan PIN yang sama memakai nama lain.
      </p>
      <p className="text-center">
        <Link href="/" className="text-sm underline">
          kembali ke awal
        </Link>
      </p>
    </main>
  );
}
