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
      <main className="pita">
        <div className="wadah-sempit text-center">
          <span className="kerlip">Selesai</span>
          <h1 className="judul-seksi mt-3">Terima kasih, {peserta.alias}</h1>
          <p className="mt-3 text-sm leading-relaxed text-abu">
            Kegiatan ini tidak memberi nilai, jadi sesi ini tidak punya papan
            peringkat.
          </p>
          <Link href="/" className="tombol tombol-garis mt-6">
            Kembali ke awal
          </Link>
        </div>
      </main>
    );
  }

  if (!peserta.finished_at) {
    // Konten yang belum pernah terbukti memberi nilai ('unknown') mungkin
    // memang tak berskor. Kalau peserta hanya dipantulkan ke /play, ia
    // terjebak bolak-balik tanpa penutup, jadi di sini selalu ada jalan keluar.
    const mungkinTakBerskor = peserta.scoring !== 'scored';

    return (
      <main className="pita">
        <div className="wadah-sempit text-center">
          <span className="kerlip">Belum ada nilai</span>
          <h1 className="judul-seksi mt-3">Nilai Anda belum masuk</h1>
          <p className="mt-3 text-sm leading-relaxed text-abu">
            {mungkinTakBerskor
              ? `Terima kasih, ${peserta.alias}. Kegiatan ini belum mengirimkan nilai apa pun — bisa jadi memang tidak memberi nilai.`
              : 'Selesaikan dulu kontennya.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/play" className="tombol tombol-utama">
              Kembali mengerjakan
            </Link>
            {mungkinTakBerskor ? (
              <Link href="/" className="tombol tombol-garis">
                Sudah cukup
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const baris = urutkanPeringkat(await peringkatSesi(peserta.session_id));
  const saya = baris.find((b) => b.id === peserta.id);

  return (
    <main>
      <section className="pita-gelap py-12">
        <div className="wadah-sempit text-center">
          <span className="kerlip">{peserta.session_title}</span>
          <p className="mt-4 font-judul text-6xl font-bold tabular-nums text-white">
            {peserta.score_raw}
            <span className="text-3xl text-white/50">/{peserta.score_max}</span>
          </p>
          <p className="mt-3 text-sm text-white/70">
            selesai dalam{' '}
            {durasiSingkat(peserta.finished_at.getTime() - peserta.started_at.getTime())}
            {saya ? ` · peringkat ${saya.peringkat} dari ${baris.length}` : null}
          </p>
        </div>
      </section>

      <section className="pita">
        <div className="wadah-sempit space-y-4">
          <div className="text-center">
            <span className="kerlip">Papan peringkat</span>
          </div>

          <PapanPeringkat baris={baris} sorotiId={peserta.id} />

          <p className="text-center text-sm text-abu">
            Ingin mencoba lagi? Masuk kembali dengan PIN yang sama memakai nama lain.
          </p>
          <p className="text-center">
            <Link href="/" className="tombol tombol-garis">
              Kembali ke awal
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
