'use client';

import { useActionState } from 'react';
import type { KeadaanSesi } from './actions';

export default function FormSesi({
  aksi,
  kontenId,
  sesiId,
  judulKonten,
  awal,
  adaPeserta,
  labelTombol,
}: {
  aksi: (keadaan: KeadaanSesi, data: FormData) => Promise<KeadaanSesi>;
  kontenId?: number;
  sesiId?: number;
  judulKonten: string;
  awal: { judul: string; pin: string; dibuka: string; ditutup: string };
  adaPeserta?: boolean;
  labelTombol: string;
}) {
  const [keadaan, kirim, sedangKirim] = useActionState<KeadaanSesi, FormData>(aksi, {});

  return (
    <form action={kirim} className="space-y-4">
      {kontenId ? <input type="hidden" name="kontenId" value={kontenId} /> : null}
      {sesiId ? <input type="hidden" name="sesiId" value={sesiId} /> : null}

      <p className="text-sm opacity-70">Konten: <strong>{judulKonten}</strong></p>

      <label className="block space-y-1">
        <span className="text-sm">Judul sesi</span>
        <input
          name="judul"
          defaultValue={awal.judul}
          required
          maxLength={200}
          className="w-full rounded-lg border border-black/20 px-3 py-2 dark:border-white/25"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm">Dibuka</span>
          <input
            type="datetime-local"
            name="dibuka"
            defaultValue={awal.dibuka}
            required
            className="w-full rounded-lg border border-black/20 px-3 py-2 dark:border-white/25"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Ditutup</span>
          <input
            type="datetime-local"
            name="ditutup"
            defaultValue={awal.ditutup}
            required
            className="w-full rounded-lg border border-black/20 px-3 py-2 dark:border-white/25"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm">PIN</span>
        <input
          name="pin"
          defaultValue={awal.pin}
          required
          inputMode="numeric"
          pattern="[0-9]{6}"
          className="w-40 rounded-lg border border-black/20 px-3 py-2 font-mono text-lg tracking-widest dark:border-white/25"
        />
        <span className="block text-xs opacity-70">
          Enam angka. Boleh diganti selama belum dipakai sesi lain.
        </span>
      </label>

      {adaPeserta ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Sesi ini sudah punya peserta. Kalau PIN-nya diganti, PIN lama langsung
          tidak berlaku dan peserta yang belum masuk harus diberi PIN baru.
        </p>
      ) : null}

      {keadaan.galat ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {keadaan.galat}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sedangKirim}
        className="rounded-lg bg-black px-4 py-2 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {sedangKirim ? 'Menyimpan…' : labelTombol}
      </button>
    </form>
  );
}
