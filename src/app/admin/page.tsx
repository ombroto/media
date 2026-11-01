import Link from 'next/link';
import { redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { daftarSesi } from '@/lib/repo/sessions';
import { jendela } from '@/lib/waktu';
import { aksiKeluar } from './login/actions';
import type { StatusSesi } from '@/lib/session-status';

export const metadata = { title: 'Sesi — Sesi H5P' };

const SARINGAN = [
  { kunci: 'semua', label: 'Semua' },
  { kunci: 'berjalan', label: 'Berjalan' },
  { kunci: 'terjadwal', label: 'Terjadwal' },
  { kunci: 'selesai', label: 'Selesai' },
] as const;

export default async function HalamanDaftarSesi({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const guru = await penyelenggaraSekarang();
  if (!guru) redirect('/admin/login?lanjut=/admin');

  const { status } = await searchParams;
  const saringan = SARINGAN.some((s) => s.kunci === status) ? status : 'semua';

  const semua = await daftarSesi(guru.id);
  const daftar =
    saringan === 'semua' ? semua : semua.filter((s) => s.status === (saringan as StatusSesi));

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Sesi</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin/konten" className="underline opacity-70">
            pustaka konten
          </Link>
          <form action={aksiKeluar}>
            <button type="submit" className="underline opacity-70">
              keluar
            </button>
          </form>
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-4 border-b border-black/15 pb-2 text-sm dark:border-white/20">
        {SARINGAN.map((s) => (
          <Link
            key={s.kunci}
            href={s.kunci === 'semua' ? '/admin' : `/admin?status=${s.kunci}`}
            className={
              saringan === s.kunci
                ? 'border-b-2 border-current pb-1 font-semibold'
                : 'opacity-70'
            }
          >
            {s.label}
          </Link>
        ))}
        <Link
          href="/admin/konten"
          className="ml-auto rounded-lg border border-black/25 px-3 py-1.5 text-xs font-semibold dark:border-white/30"
        >
          + Sesi baru
        </Link>
      </nav>

      {daftar.length === 0 ? (
        <p className="text-sm opacity-70">
          {semua.length === 0
            ? 'Belum ada sesi. Mulai dari pustaka konten, lalu "Buat sesi".'
            : 'Tidak ada sesi dengan status itu.'}
        </p>
      ) : (
        <ul className="divide-y divide-black/10 dark:divide-white/15">
          {daftar.map((s) => (
            <li key={s.id} className="space-y-2 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-medium">{s.title}</p>
                <span className="rounded-full border border-black/25 px-2 py-0.5 text-[10px] uppercase dark:border-white/30">
                  {s.status}
                </span>
                {s.scoring === 'unscored' ? (
                  <span className="text-[10px] uppercase opacity-60">tanpa peringkat</span>
                ) : null}
              </div>

              <p className="text-xs opacity-70">
                {s.judul_konten} · PIN{' '}
                <span className="font-mono tracking-widest">{s.pin}</span> ·{' '}
                {jendela(s.opens_at, s.closes_at)} ·{' '}
                {s.jumlah_ikut === 0
                  ? 'belum ada peserta'
                  : `${s.jumlah_ikut} ikut, ${s.jumlah_selesai} selesai`}
              </p>

              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  href={`/admin/sesi/${s.id}`}
                  className="rounded-lg border border-black/25 px-3 py-1.5 font-semibold dark:border-white/30"
                >
                  Pantau
                </Link>
                <Link
                  href={`/admin/sesi/${s.id}/ubah`}
                  className="rounded-lg border border-black/25 px-3 py-1.5 font-semibold dark:border-white/30"
                >
                  Ubah
                </Link>
                <Link
                  href={`/admin/sesi/${s.id}/ubah#hapus`}
                  className="rounded-lg border border-black/25 px-3 py-1.5 font-semibold dark:border-white/30"
                >
                  Hapus
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
