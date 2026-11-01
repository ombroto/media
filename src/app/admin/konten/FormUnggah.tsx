'use client';

import { useActionState } from 'react';
import { aksiUnggahKonten, type KeadaanUnggah } from './actions';

export default function FormUnggah() {
  const [keadaan, kirim, sedangKirim] = useActionState<KeadaanUnggah, FormData>(
    aksiUnggahKonten,
    {},
  );

  return (
    <form action={kirim} className="space-y-3">
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

      {keadaan.galat ? (
        <div role="alert" className="space-y-1 text-sm">
          <p className="text-red-700 dark:text-red-400">{keadaan.galat}</p>
          {keadaan.pustakaKurang?.length ? (
            <p className="opacity-70">Pustaka yang kurang: {keadaan.pustakaKurang.join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      {keadaan.berhasil ? (
        <div className="space-y-1 text-sm">
          <p className="text-green-700 dark:text-green-400">{keadaan.berhasil}</p>
          {keadaan.pustakaTerpasang?.length ? (
            <details className="opacity-70">
              <summary className="cursor-pointer">
                {keadaan.pustakaTerpasang.length} pustaka dipasang dari gudang H5P
              </summary>
              <p className="mt-1 break-words">{keadaan.pustakaTerpasang.join(', ')}</p>
            </details>
          ) : (
            <p className="opacity-70">Semua pustaka yang dibutuhkan sudah ada di server.</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
