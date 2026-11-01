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
  const [namaBerkas, setNamaBerkas] = useState<string | null>(null);
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
        setNamaBerkas(null);
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
    <form ref={formRef} onSubmit={kirim} className="kartu space-y-4 p-6">
      <label className="block cursor-pointer rounded border-2 border-dashed border-garis bg-krem px-6 py-8 text-center transition-colors hover:border-oranye">
        <input
          type="file"
          name="berkas"
          accept=".h5p"
          className="sr-only"
          required
          onChange={(e) => setNamaBerkas(e.target.files?.[0]?.name ?? null)}
        />
        <span className="block font-judul text-lg">
          {namaBerkas ?? 'Pilih berkas .h5p'}
        </span>
        <span className="mt-1 block text-sm text-abu">
          Maksimal 64 MB. Pustaka yang belum ada diunduh otomatis dari gudang H5P.
        </span>
      </label>

      <button type="submit" disabled={sedangKirim} className="tombol tombol-utama">
        {sedangKirim ? 'Memproses…' : 'Unggah'}
      </button>

      {sedangKirim ? (
        <p className="text-sm text-abu">
          Memeriksa paket dan memasang pustaka yang belum ada. Pemasangan pertama
          bisa memakan beberapa menit karena pustakanya diunduh dari gudang H5P.
        </p>
      ) : null}

      {hasil && !hasil.ok ? (
        <div role="alert" className="pesan pesan-galat space-y-1">
          <p>{hasil.pesan ?? 'Unggahan gagal.'}</p>
          {hasil.pustakaKurang?.length ? (
            <p className="opacity-80">
              Pustaka yang kurang: {hasil.pustakaKurang.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasil?.ok ? (
        <div className="pesan pesan-baik space-y-1">
          <p>
            {hasil.hanyaPustaka
              ? 'Berkas ini berisi pustaka saja, bukan konten — pustakanya sudah dipasang.'
              : `"${hasil.judul}" siap dipakai.`}
          </p>
          {hasil.pustakaTerpasang?.length ? (
            <details className="opacity-80">
              <summary className="cursor-pointer">
                {hasil.pustakaTerpasang.length} pustaka dipasang dari gudang H5P
              </summary>
              <p className="mt-1 break-words">{hasil.pustakaTerpasang.join(', ')}</p>
            </details>
          ) : (
            <p className="opacity-80">Semua pustaka yang dibutuhkan sudah ada di server.</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
