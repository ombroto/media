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
    <main className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{sesi.title}</h1>
          <p className="text-sm opacity-70">
            {konten?.title ?? 'Konten'} · {status}
          </p>
        </div>
        <Link href="/admin" className="text-sm underline opacity-70">
          daftar sesi
        </Link>
      </header>

      {baru ? (
        <p className="rounded-lg border border-green-600/40 bg-green-600/10 p-3 text-sm">
          Sesi dibuat. Bagikan PIN di bawah ini ke peserta.
        </p>
      ) : null}

      <section className="rounded-xl border border-black/15 p-4 dark:border-white/20">
        <p className="text-xs uppercase tracking-wide opacity-60">PIN</p>
        <p className="font-mono text-4xl tracking-[0.3em]">{sesi.pin}</p>
        <p className="mt-2 break-all text-sm opacity-70">
          Tautan langsung: <code>/j/{sesi.pin}</code>
        </p>
        <p className="mt-1 text-sm opacity-70">
          Dibuka {waktuPanjang(sesi.opens_at)} · ditutup {waktuPanjang(sesi.closes_at)}
          {sesi.closed_early_at
            ? ` · ditutup lebih cepat ${waktuPanjang(sesi.closed_early_at)}`
            : ''}
        </p>
      </section>

      <section className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <p>
          <strong>{ringkas.jumlah_ikut}</strong> ikut
        </p>
        {berskor ? (
          <>
            <p>
              <strong>{ringkas.jumlah_selesai}</strong> selesai
            </p>
            <p>
              rata-rata{' '}
              <strong>
                {ringkas.rata_rata === null
                  ? '—'
                  : ringkas.rata_rata.toLocaleString('id-ID', {
                      maximumFractionDigits: 1,
                    })}
              </strong>
            </p>
          </>
        ) : (
          <p className="opacity-70">kegiatan ini tidak memberi nilai</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          {berskor ? 'Peringkat' : 'Sudah membuka'}
        </h2>

        {berskor ? (
          <PapanPeringkat baris={peringkat} />
        ) : pembuka.length === 0 ? (
          <p className="text-sm opacity-70">Belum ada yang membuka.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/15">
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
      </section>

      {berskor && ringkas.belum_selesai.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Belum selesai
          </h2>
          <ul className="divide-y divide-black/10 dark:divide-white/15">
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
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-2 border-t border-black/15 pt-4 text-sm dark:border-white/20">
        {berskor ? (
          <a
            href={`/admin/sesi/${sesi.id}/csv`}
            className="rounded-lg border border-black/25 px-3 py-1.5 font-semibold dark:border-white/30"
          >
            Unduh CSV
          </a>
        ) : null}

        {status !== 'selesai' ? (
          <form action={aksiTutupSekarang}>
            <input type="hidden" name="sesiId" value={sesi.id} />
            <button
              type="submit"
              className="rounded-lg border border-black/25 px-3 py-1.5 font-semibold dark:border-white/30"
            >
              Tutup sekarang
            </button>
          </form>
        ) : null}

        <Link href={`/admin/sesi/${sesi.id}/ubah`} className="underline opacity-70">
          ubah sesi
        </Link>
      </section>

      {status !== 'selesai' ? (
        <p className="text-xs opacity-70">
          Menutup lebih cepat hanya mengunci pintu masuk. Peserta yang sedang
          mengerjakan tetap bisa menyetorkan nilainya.
        </p>
      ) : null}
    </main>
  );
}
