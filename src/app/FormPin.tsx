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
        className="w-full rounded-xl border border-black/20 px-4 py-4 text-center font-mono text-3xl tracking-[0.35em] dark:border-white/25"
      />

      {galat ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {galat}
        </p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-xl bg-black px-4 py-3 text-lg font-semibold text-white dark:bg-white dark:text-black"
      >
        Lanjut
      </button>
    </form>
  );
}
