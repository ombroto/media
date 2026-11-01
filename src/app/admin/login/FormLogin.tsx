'use client';

import { useActionState } from 'react';
import { aksiMasuk, type KeadaanLogin } from './actions';

export default function FormLogin({ lanjut }: { lanjut: string }) {
  const [keadaan, kirim, sedangKirim] = useActionState<KeadaanLogin, FormData>(
    aksiMasuk,
    {},
  );

  return (
    <form action={kirim} className="space-y-4">
      <input type="hidden" name="lanjut" value={lanjut} />

      <label className="block space-y-1">
        <span className="text-sm">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-black/20 px-3 py-2 dark:border-white/25"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm">Kata sandi</span>
        <input
          name="kataSandi"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-black/20 px-3 py-2 dark:border-white/25"
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
        className="w-full rounded-lg bg-black px-3 py-2 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {sedangKirim ? 'Memeriksa…' : 'Masuk'}
      </button>
    </form>
  );
}
