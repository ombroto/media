'use client';

import { useState } from 'react';
import { aksiHapusSesi } from '../../actions';

export default function FormHapus({ sesiId, judul }: { sesiId: number; judul: string }) {
  const [ketikan, setKetikan] = useState('');
  const cocok = ketikan.trim() === judul.trim();

  return (
    <form action={aksiHapusSesi} className="space-y-3">
      <input type="hidden" name="sesiId" value={sesiId} />

      <label className="block space-y-1">
        <span className="text-sm">
          Ketik judul sesinya untuk menegaskan: <strong>{judul}</strong>
        </span>
        <input
          name="konfirmasi"
          value={ketikan}
          onChange={(e) => setKetikan(e.target.value)}
          className="w-full rounded-lg border border-black/20 px-3 py-2 dark:border-white/25"
        />
      </label>

      <button
        type="submit"
        disabled={!cocok}
        className="rounded-lg border border-red-600 px-4 py-2 font-semibold text-red-700 disabled:opacity-40 dark:border-red-400 dark:text-red-400"
      >
        Hapus sesi beserta nilainya
      </button>
    </form>
  );
}
