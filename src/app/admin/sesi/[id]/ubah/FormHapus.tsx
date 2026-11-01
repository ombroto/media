'use client';

import { useState } from 'react';
import { aksiHapusSesi } from '../../actions';

export default function FormHapus({ sesiId, judul }: { sesiId: number; judul: string }) {
  const [ketikan, setKetikan] = useState('');
  const cocok = ketikan.trim() === judul.trim();

  return (
    <form action={aksiHapusSesi} className="kartu space-y-4 p-5">
      <input type="hidden" name="sesiId" value={sesiId} />

      <div>
        <label htmlFor="konfirmasi" className="label-isian">
          Ketik judul sesinya untuk menegaskan
        </label>
        <p className="mb-2 text-sm font-semibold">{judul}</p>
        <input
          id="konfirmasi"
          name="konfirmasi"
          value={ketikan}
          onChange={(e) => setKetikan(e.target.value)}
          className="isian"
        />
      </div>

      <button type="submit" disabled={!cocok} className="tombol tombol-bahaya tombol-polos">
        Hapus sesi beserta nilainya
      </button>
    </form>
  );
}
