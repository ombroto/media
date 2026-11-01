'use client';

import { useActionState } from 'react';
import { aksiMulai, type KeadaanNama } from './actions';

export default function FormNama({ pin }: { pin: string }) {
  const [keadaan, kirim, sedangKirim] = useActionState<KeadaanNama, FormData>(
    aksiMulai,
    {},
  );

  return (
    <form action={kirim} className="space-y-4">
      <input type="hidden" name="pin" value={pin} />

      <div>
        <label htmlFor="nama" className="label-isian">
          Nama kamu
        </label>
        <input
          id="nama"
          name="nama"
          required
          maxLength={40}
          autoComplete="off"
          autoFocus
          className="isian text-lg"
        />
      </div>

      {keadaan.galat ? (
        <p role="alert" className="pesan pesan-galat">
          {keadaan.galat}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sedangKirim}
        className="tombol tombol-utama w-full py-3 text-base"
      >
        {sedangKirim ? 'Menyiapkan…' : 'Mulai'}
      </button>
    </form>
  );
}
