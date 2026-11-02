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

  const berjalan = semua.filter((s) => s.status === 'berjalan').length;
  const peserta = semua.reduce((n, s) => n + s.jumlah_ikut, 0);
  const selesai = semua.reduce((n, s) => n + s.jumlah_selesai, 0);

  return (
    <main>
      <section className="pita-gelap py-10">
        <div className="wadah">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="kerlip">Penyelenggara</span>
              <h1 className="mt-2 text-3xl text-white">Sesi</h1>
              <p className="mt-1 text-sm text-white/60">Masuk sebagai {guru.name}.</p>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/admin/konten" className="tombol tombol-terang tombol-kecil">
                Pustaka konten
              </Link>
              <form action={aksiKeluar}>
                <button
                  type="submit"
                  className="text-xs uppercase tracking-[0.12em] text-white/60 hover:text-white"
                >
                  keluar
                </button>
              </form>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
            {[
              ['Sesi', semua.length],
              ['Berjalan', berjalan],
              ['Peserta', peserta],
              ['Selesai', selesai],
            ].map(([label, nilai]) => (
              <div key={String(label)}>
                <dd className="angka-besar">{nilai}</dd>
                <dt className="mt-1 text-xs uppercase tracking-[0.12em] text-white/50">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="pita">
        <div className="wadah space-y-5">
          <nav className="flex flex-wrap items-center gap-4 border-b border-garis pb-3 text-sm">
            {SARINGAN.map((s) => (
              <Link
                key={s.kunci}
                href={s.kunci === 'semua' ? '/admin' : `/admin?status=${s.kunci}`}
                className={
                  saringan === s.kunci
                    ? 'border-b-2 border-oranye pb-2 font-semibold text-oranye'
                    : 'pb-2 text-abu hover:text-tinta'
                }
              >
                {s.label}
              </Link>
            ))}
            <Link href="/admin/konten" className="tombol tombol-utama tombol-kecil ml-auto">
              Sesi baru
            </Link>
          </nav>

          {daftar.length === 0 ? (
            <p className="text-sm text-abu">
              {semua.length === 0
                ? 'Belum ada sesi. Mulai dari pustaka konten, lalu "Buat sesi".'
                : 'Tidak ada sesi dengan status itu.'}
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {daftar.map((s) => (
                <li key={s.id} className="kartu flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg leading-snug">{s.title}</h2>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {s.scoring === 'unscored' ? (
                        <span className="lencana">tanpa nilai</span>
                      ) : null}
                      <span
                        className={`lencana ${
                          s.status === 'berjalan' ? 'lencana-berjalan' : 'lencana-selesai'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </div>

                  <p className="font-judul text-2xl tracking-[0.2em] text-oranye">
                    {s.pin}
                  </p>

                  <p className="text-xs text-abu">
                    {s.judul_konten} · {jendela(s.opens_at, s.closes_at)}
                  </p>

                  <p className="text-xs text-abu">
                    {s.jumlah_ikut === 0
                      ? 'belum ada peserta'
                      : s.scoring === 'unscored'
                        ? `${s.jumlah_ikut} sudah membuka`
                        : `${s.jumlah_ikut} ikut, ${s.jumlah_selesai} selesai`}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link
                      href={`/admin/sesi/${s.id}`}
                      className="tombol tombol-utama tombol-kecil"
                    >
                      Pantau
                    </Link>
                    <Link
                      href={`/admin/sesi/${s.id}/ubah`}
                      className="tombol tombol-garis tombol-kecil"
                    >
                      Ubah
                    </Link>
                    <Link
                      href={`/admin/sesi/${s.id}/ubah#hapus`}
                      className="tombol tombol-garis tombol-kecil"
                    >
                      Hapus
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {daftar.some((s) => s.scoring === 'unscored') ? (
            <p className="border-t border-garis pt-4 text-xs text-abu">
              Sesi bertanda <strong>tanpa nilai</strong> memakai tipe konten yang
              memang tidak pernah mengirimkan skor — seperti Memory Game atau
              Dialog Cards. Sesi itu tetap bisa dibagikan lewat PIN dan dikerjakan
              peserta, tapi tidak punya papan peringkat: yang terlihat hanya siapa
              saja yang sudah membukanya. Pesertanya juga diberi tahu hal ini
              sebelum mereka mulai.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
