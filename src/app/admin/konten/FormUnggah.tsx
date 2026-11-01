'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type Hasil = {
  ok?: boolean;
  pesan?: string;
  judul?: string;
  hanyaPustaka?: boolean;
  pustakaTerpasang?: string[];
  pustakaKurang?: string[];
};

/**
 * Mengirim berkas ke /api/konten/unggah, bukan ke server action: server action
 * membatasi badan permintaan 1 MB dan menolaknya tanpa pesan, sementara berkas
 * H5P biasa berukuran megabyte.
 */
export default function FormUnggah() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);

  async function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    setSedangKirim(true);
    setHasil(null);

    try {
      const res = await fetch('/api/konten/unggah', { method: 'POST', body: data });
      const badan = (await res.json()) as Hasil;
      setHasil(badan);
      if (badan.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setHasil({
        ok: false,
        pesan: 'Unggahan terputus sebelum selesai. Periksa koneksi lalu coba lagi.',
      });
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={kirim} className="space-y-3">
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-black/25 p-6 text-center dark:border-white/25">
        <input type="file" name="berkas" accept=".h5p" className="sr-only" required />
        <span className="block font-medium">Pilih berkas .h5p</span>
        <span className="mt-1 block text-sm opacity-70">
          Pustaka tipe kontennya diunduh otomatis kalau belum ada di server.
        </span>
      </label>

      <button
        type="submit"
        disabled={sedangKirim}
        className="rounded-lg bg-black px-4 py-2 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {sedangKirim ? 'Memproses…' : 'Unggah'}
      </button>

      {sedangKirim ? (
        <p className="text-sm opacity-70">
          Memeriksa paket dan memasang pustaka yang belum ada. Pemasangan pertama
          bisa memakan beberapa menit karena pustakanya diunduh dari gudang H5P.
        </p>
      ) : null}

      {hasil && !hasil.ok ? (
        <div role="alert" className="space-y-1 text-sm">
          <p className="text-red-700 dark:text-red-400">
            {hasil.pesan ?? 'Unggahan gagal.'}
          </p>
          {hasil.pustakaKurang?.length ? (
            <p className="opacity-70">Pustaka yang kurang: {hasil.pustakaKurang.join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      {hasil?.ok ? (
        <div className="space-y-1 text-sm">
          <p className="text-green-700 dark:text-green-400">
            {hasil.hanyaPustaka
              ? 'Berkas ini berisi pustaka saja, bukan konten — pustakanya sudah dipasang.'
              : `"${hasil.judul}" siap dipakai.`}
          </p>
          {hasil.pustakaTerpasang?.length ? (
            <details className="opacity-70">
              <summary className="cursor-pointer">
                {hasil.pustakaTerpasang.length} pustaka dipasang dari gudang H5P
              </summary>
              <p className="mt-1 break-words">{hasil.pustakaTerpasang.join(', ')}</p>
            </details>
          ) : (
            <p className="opacity-70">Semua pustaka yang dibutuhkan sudah ada di server.</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
