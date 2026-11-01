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

      <label className="block space-y-1">
        <span className="text-sm">Nama kamu</span>
        <input
          name="nama"
          required
          maxLength={40}
          autoComplete="off"
          autoFocus
          className="w-full rounded-xl border border-black/20 px-4 py-3 text-lg dark:border-white/25"
        />
      </label>

      {keadaan.galat ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {keadaan.galat}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sedangKirim}
        className="w-full rounded-xl bg-black px-4 py-3 text-lg font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {sedangKirim ? 'Menyiapkan…' : 'Mulai'}
      </button>
    </form>
  );
}
