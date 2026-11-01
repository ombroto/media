'use client';

import { useState } from 'react';
import { aksiHapusPeserta } from '../actions';

/**
 * Satu baris peserta dengan tombol hapus. Konfirmasinya dua langkah supaya
 * nilai orang tidak hilang karena salah sentuh di ponsel.
 */
export default function BarisPesertaBisaHapus({
  sesiId,
  pesertaId,
  alias,
  keterangan,
}: {
  sesiId: number;
  pesertaId: number;
  alias: string;
  keterangan?: string;
}) {
  const [tanya, setTanya] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate">{alias}</p>
        {keterangan ? <p className="text-xs opacity-60">{keterangan}</p> : null}
      </div>

      {tanya ? (
        <form action={aksiHapusPeserta} className="flex items-center gap-2">
          <input type="hidden" name="sesiId" value={sesiId} />
          <input type="hidden" name="pesertaId" value={pesertaId} />
          <button
            type="submit"
            className="rounded-lg border border-red-600 px-2 py-1 text-xs font-semibold text-red-700 dark:border-red-400 dark:text-red-400"
          >
            Ya, hapus
          </button>
          <button
            type="button"
            onClick={() => setTanya(false)}
            className="text-xs underline opacity-70"
          >
            batal
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setTanya(true)}
          className="text-xs underline opacity-60"
        >
          hapus
        </button>
      )}
    </li>
  );
}
