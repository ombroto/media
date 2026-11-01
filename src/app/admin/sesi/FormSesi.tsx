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
    <form action={kirim} className="kartu space-y-5 p-6">
      {kontenId ? <input type="hidden" name="kontenId" value={kontenId} /> : null}
      {sesiId ? <input type="hidden" name="sesiId" value={sesiId} /> : null}

      <p className="text-sm text-abu">
        Konten: <strong className="text-tinta">{judulKonten}</strong>
      </p>

      <div>
        <label htmlFor="judul" className="label-isian">
          Judul sesi
        </label>
        <input
          id="judul"
          name="judul"
          defaultValue={awal.judul}
          required
          maxLength={200}
          className="isian"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dibuka" className="label-isian">
            Dibuka
          </label>
          <input
            id="dibuka"
            type="datetime-local"
            name="dibuka"
            defaultValue={awal.dibuka}
            required
            className="isian"
          />
        </div>
        <div>
          <label htmlFor="ditutup" className="label-isian">
            Ditutup
          </label>
          <input
            id="ditutup"
            type="datetime-local"
            name="ditutup"
            defaultValue={awal.ditutup}
            required
            className="isian"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pin" className="label-isian">
          PIN
        </label>
        <input
          id="pin"
          name="pin"
          defaultValue={awal.pin}
          required
          inputMode="numeric"
          pattern="[0-9]{6}"
          className="isian w-44 font-judul text-2xl tracking-[0.25em]"
        />
        <span className="mt-1 block text-xs text-abu">
          Enam angka. Boleh diganti selama belum dipakai sesi lain.
        </span>
      </div>

      {adaPeserta ? (
        <p className="pesan pesan-ingat">
          Sesi ini sudah punya peserta. Kalau PIN-nya diganti, PIN lama langsung
          tidak berlaku dan peserta yang belum masuk harus diberi PIN baru.
        </p>
      ) : null}

      {keadaan.galat ? (
        <p role="alert" className="pesan pesan-galat">
          {keadaan.galat}
        </p>
      ) : null}

      <button type="submit" disabled={sedangKirim} className="tombol tombol-utama">
        {sedangKirim ? 'Menyimpan…' : labelTombol}
      </button>
    </form>
  );
}
