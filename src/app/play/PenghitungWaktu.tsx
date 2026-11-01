'use client';

import { useEffect, useState } from 'react';

/** Jam berjalan untuk peserta. Hanya tampilan — durasi resmi dihitung server. */
export default function PenghitungWaktu({ mulaiIso }: { mulaiIso: string }) {
  const mulai = new Date(mulaiIso).getTime();
  const [sekarang, setSekarang] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const detik = Math.max(0, Math.floor((sekarang - mulai) / 1000));
  const menit = Math.floor(detik / 60);

  return (
    <p
      className="rounded border border-garis bg-white px-3 py-1.5 font-judul text-lg tabular-nums"
      aria-live="off"
    >
      {menit}:{String(detik % 60).padStart(2, '0')}
    </p>
  );
}
