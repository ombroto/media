import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import PapanPeringkat from '@/components/PapanPeringkat';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { urutkanPeringkat } from '@/lib/ranking';
import { ambilKonten } from '@/lib/repo/contents';
import { peringkatSesi, pesertaSudahMembuka, ringkasanSesi } from '@/lib/repo/peringkat';
import { ambilSesi } from '@/lib/repo/sessions';
import { statusSesi } from '@/lib/session-status';
import { waktuPanjang } from '@/lib/waktu';
import { aksiTutupSekarang } from '../actions';
import BarisPesertaBisaHapus from './BarisPesertaBisaHapus';

export default async function HalamanPantauSesi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baru?: string }>;
}) {
  const guru = await penyelenggaraSekarang();
  const { id } = await params;
  const { baru } = await searchParams;
  const sesiId = Number(id);
  if (!guru) redirect(`/admin/login?lanjut=/admin/sesi/${id}`);
  if (!Number.isInteger(sesiId)) notFound();

  const sesi = await ambilSesi(sesiId);
  if (!sesi || sesi.owner_id !== guru.id) notFound();

  const konten = await ambilKonten(sesi.content_id);
  const status = statusSesi(sesi, new Date());
  const berskor = konten?.scoring !== 'unscored';

  const ringkas = await ringkasanSesi(sesi.id);
  const peringkat = berskor ? urutkanPeringkat(await peringkatSesi(sesi.id)) : [];
  const pembuka = berskor ? [] : await pesertaSudahMembuka(sesi.id);

  return (
    <main>
      <section className="pita-gelap py-10">
        <div className="wadah space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="kerlip">{konten?.title ?? 'Konten'}</span>
              <h1 className="mt-2 text-3xl text-white">{sesi.title}</h1>
            </div>
            <Link href="/admin" className="tombol tombol-terang tombol-kecil">
              Daftar sesi
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            <div className="rounded-lg border border-white/15 bg-white/5 px-6 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">PIN</p>
              <p className="font-judul text-4xl tracking-[0.25em] text-oranye">
                {sesi.pin}
              </p>
              <p className="mt-1 text-xs text-white/50">/j/{sesi.pin}</p>
            </div>

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dd className="angka-besar">{ringkas.jumlah_ikut}</dd>
                <dt className="text-xs uppercase tracking-[0.12em] text-white/50">Ikut</dt>
              </div>

              {berskor ? (
                <>
                  <div>
                    <dd className="angka-besar">{ringkas.jumlah_selesai}</dd>
                    <dt className="text-xs uppercase tracking-[0.12em] text-white/50">
                      Selesai
                    </dt>
                  </div>
                  <div>
                    <dd className="angka-besar">
                      {ringkas.rata_rata === null
                        ? '—'
                        : ringkas.rata_rata.toLocaleString('id-ID', {
                            maximumFractionDigits: 1,
                          })}
                    </dd>
                    <dt className="text-xs uppercase tracking-[0.12em] text-white/50">
                      Rata-rata
                    </dt>
                  </div>
                </>
              ) : (
                <div className="col-span-2 self-center">
                  <p className="text-sm text-white/60">
                    <strong className="text-white">Tanpa nilai.</strong>{' '}
                    {konten?.main_library ?? 'Tipe konten ini'} tidak pernah
                    mengirimkan skor, jadi sesi ini tidak punya peringkat maupun
                    rata-rata.
                  </p>
                </div>
              )}
            </dl>
          </div>

          <p className="text-sm text-white/50">
            {status} · dibuka {waktuPanjang(sesi.opens_at)} · ditutup{' '}
            {waktuPanjang(sesi.closes_at)}
            {sesi.closed_early_at
              ? ` · ditutup lebih cepat ${waktuPanjang(sesi.closed_early_at)}`
              : ''}
          </p>
        </div>
      </section>

      <section className="pita">
        <div className="wadah space-y-6">
          {baru ? (
            <p className="pesan pesan-baik">Sesi dibuat. Bagikan PIN di atas ke peserta.</p>
          ) : null}

          <div className="space-y-3">
            <span className="kerlip">{berskor ? 'Peringkat' : 'Sudah membuka'}</span>

            {berskor ? (
              <PapanPeringkat baris={peringkat} />
            ) : pembuka.length === 0 ? (
              <p className="text-sm text-abu">Belum ada yang membuka.</p>
            ) : (
              <ul className="kartu divide-y divide-garis">
                {pembuka.map((p) => (
                  <BarisPesertaBisaHapus
                    key={p.id}
                    sesiId={sesi.id}
                    pesertaId={p.id}
                    alias={p.alias}
                    keterangan={waktuPanjang(p.started_at)}
                  />
                ))}
              </ul>
            )}
          </div>

          {!berskor ? (
            <p className="pesan">
              Daftar di atas hanya mencatat siapa yang sudah membuka kegiatan ini.
              Tidak ada nilai, waktu pengerjaan, maupun peringkat yang bisa
              dihitung — tipe kontennya memang tidak mengirimkan skor. Peserta
              diberi tahu hal ini di halaman sebelum mereka mengisi nama, dan
              setelah selesai mereka mendapat halaman penutup, bukan papan
              peringkat kosong.
            </p>
          ) : null}

          {berskor && ringkas.belum_selesai.length > 0 ? (
            <div className="space-y-3">
              <span className="kerlip">Belum selesai</span>
              <ul className="kartu divide-y divide-garis">
                {ringkas.belum_selesai.map((p) => (
                  <BarisPesertaBisaHapus
                    key={p.id}
                    sesiId={sesi.id}
                    pesertaId={p.id}
                    alias={p.alias}
                    keterangan={`mulai ${waktuPanjang(p.started_at)}`}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-garis pt-5">
            {berskor ? (
              <a
                href={`/admin/sesi/${sesi.id}/csv`}
                className="tombol tombol-utama tombol-kecil"
              >
                Unduh CSV
              </a>
            ) : null}

            {status !== 'selesai' ? (
              <form action={aksiTutupSekarang}>
                <input type="hidden" name="sesiId" value={sesi.id} />
                <button type="submit" className="tombol tombol-garis tombol-kecil">
                  Tutup sekarang
                </button>
              </form>
            ) : null}

            <Link
              href={`/admin/sesi/${sesi.id}/ubah`}
              className="text-sm text-abu underline hover:text-tinta"
            >
              ubah sesi
            </Link>
          </div>

          {status !== 'selesai' ? (
            <p className="text-xs text-abu">
              Menutup lebih cepat hanya mengunci pintu masuk. Peserta yang sedang
              mengerjakan tetap bisa menyetorkan nilainya.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
