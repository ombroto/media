import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { ambilSesi } from '@/lib/repo/sessions';
import { waktuPanjang } from '@/lib/waktu';

export default async function HalamanPantauSesi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guru = await penyelenggaraSekarang();
  const { id } = await params;
  const sesiId = Number(id);
  if (!guru) redirect(`/admin/login?lanjut=/admin/sesi/${id}`);
  if (!Number.isInteger(sesiId)) notFound();

  const sesi = await ambilSesi(sesiId);
  if (!sesi || sesi.owner_id !== guru.id) notFound();

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{sesi.title}</h1>
        <Link href="/admin" className="text-sm underline opacity-70">
          daftar sesi
        </Link>
      </header>

      <div className="rounded-xl border border-black/15 p-4 dark:border-white/20">
        <p className="text-xs uppercase tracking-wide opacity-60">PIN</p>
        <p className="font-mono text-3xl tracking-[0.3em]">{sesi.pin}</p>
        <p className="mt-2 text-sm opacity-70">
          Dibuka {waktuPanjang(sesi.opens_at)} · ditutup {waktuPanjang(sesi.closes_at)}
        </p>
      </div>

      <p className="text-sm opacity-70">
        Peringkat, daftar yang belum selesai, unduh CSV, dan tombol tutup lebih
        cepat menyusul di Tugas 11.
      </p>

      <Link href={`/admin/sesi/${sesi.id}/ubah`} className="text-sm underline">
        ubah sesi
      </Link>
    </main>
  );
}
