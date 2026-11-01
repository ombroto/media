'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FormPin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const bersih = pin.replace(/\s+/g, '');
    if (!/^[0-9]{6}$/.test(bersih)) {
      setGalat('PIN terdiri dari enam angka.');
      return;
    }
    setGalat(null);
    router.push(`/j/${bersih}`);
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        aria-label="PIN"
        placeholder="______"
        className="isian text-center font-judul text-3xl tracking-[0.35em]"
      />

      {galat ? (
        <p role="alert" className="pesan pesan-galat">
          {galat}
        </p>
      ) : null}

      <button type="submit" className="tombol tombol-utama w-full py-3 text-base">
        Lanjut
      </button>
    </form>
  );
}
