import Link from 'next/link';
import { redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { daftarKonten } from '@/lib/repo/contents';
import FormUnggah from './FormUnggah';

export const metadata = { title: 'Pustaka konten — Sesi H5P' };

export default async function HalamanPustakaKonten() {
  const guru = await penyelenggaraSekarang();
  if (!guru) redirect('/admin/login?lanjut=/admin/konten');

  const daftar = await daftarKonten(guru.id);

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Pustaka konten</h1>
        <Link href="/admin" className="text-sm underline opacity-70">
          daftar sesi
        </Link>
      </header>

      <FormUnggah />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Konten Anda
        </h2>

        {daftar.length === 0 ? (
          <p className="text-sm opacity-70">
            Belum ada konten. Unggah satu berkas .h5p untuk mulai.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/15">
            {daftar.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{k.title}</p>
                  <p className="text-xs opacity-70">
                    {k.main_library}
                    {' · '}
                    {k.jumlah_sesi === 0 ? 'belum dipakai' : `${k.jumlah_sesi} sesi`}
                    {k.scoring === 'unscored' ? ' · tanpa skor' : ''}
                  </p>
                </div>

                {k.scoring === 'unscored' ? (
                  <span className="rounded-full border border-black/25 px-2 py-0.5 text-[10px] uppercase dark:border-white/30">
                    tanpa peringkat
                  </span>
                ) : null}

                <Link
                  href={`/admin/sesi/baru?konten=${k.id}`}
                  className="rounded-lg border border-black/25 px-3 py-1.5 text-xs font-semibold dark:border-white/30"
                >
                  Buat sesi
                </Link>
                <Link
                  href={`/dev/play/${k.h5p_content_id}`}
                  className="text-xs underline opacity-70"
                >
                  pratinjau
                </Link>
              </li>
            ))}
          </ul>
        )}

        {daftar.some((k) => k.scoring === 'unscored') ? (
          <p className="text-xs opacity-70">
            Konten bertanda &quot;tanpa peringkat&quot; memang tidak pernah mengirim
            nilai, jadi sesinya hanya menampilkan siapa yang sudah membuka.
          </p>
        ) : null}
      </section>
    </main>
  );
}
