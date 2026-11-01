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
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate">{alias}</p>
        {keterangan ? <p className="text-xs text-abu">{keterangan}</p> : null}
      </div>

      {tanya ? (
        <form action={aksiHapusPeserta} className="flex items-center gap-2">
          <input type="hidden" name="sesiId" value={sesiId} />
          <input type="hidden" name="pesertaId" value={pesertaId} />
          <button type="submit" className="tombol tombol-bahaya tombol-kecil tombol-polos">
            Ya, hapus
          </button>
          <button
            type="button"
            onClick={() => setTanya(false)}
            className="text-xs text-abu underline"
          >
            batal
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setTanya(true)}
          className="text-xs text-abu underline hover:text-tinta"
        >
          hapus
        </button>
      )}
    </li>
  );
}
