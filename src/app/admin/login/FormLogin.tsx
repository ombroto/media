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

      <div>
        <label htmlFor="email" className="label-isian">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="isian"
        />
      </div>

      <div>
        <label htmlFor="kataSandi" className="label-isian">
          Kata sandi
        </label>
        <input
          id="kataSandi"
          name="kataSandi"
          type="password"
          autoComplete="current-password"
          required
          className="isian"
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
        className="tombol tombol-utama w-full py-3"
      >
        {sedangKirim ? 'Memeriksa…' : 'Masuk'}
      </button>
    </form>
  );
}
