'use client';

import { useEffect, useState } from 'react';

/**
 * Alat berbagi sesi: tautan yang bisa disalin, tombol bagikan bawaan
 * perangkat, dan kode QR yang bisa diunduh.
 *
 * Tautannya disusun di peramban, bukan di server. Server tidak tahu nama
 * domain publiknya sendiri dengan pasti — di Vercel permintaannya lewat
 * proksi — sementara peramban selalu tahu persis alamat yang sedang dibuka,
 * yang memang alamat yang akan dipakai peserta.
 */
export default function BerbagiSesi({
  sesiId,
  pin,
  judul,
}: {
  sesiId: number;
  pin: string;
  judul: string;
}) {
  const [tautan, setTautan] = useState('');
  const [tersalin, setTersalin] = useState(false);
  const [bisaBagikan, setBisaBagikan] = useState(false);
  const [qrTerbuka, setQrTerbuka] = useState(false);

  useEffect(() => {
    setTautan(`${window.location.origin}/j/${pin}`);
    setBisaBagikan(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, [pin]);

  useEffect(() => {
    if (!tersalin) return;
    const id = setTimeout(() => setTersalin(false), 2000);
    return () => clearTimeout(id);
  }, [tersalin]);

  async function salin() {
    try {
      await navigator.clipboard.writeText(tautan);
      setTersalin(true);
    } catch {
      // Clipboard API ditolak (konteks tidak aman, atau izin ditolak):
      // pilih teksnya supaya pemakai bisa menyalin sendiri.
      const isian = document.getElementById(`tautan-${sesiId}`) as HTMLInputElement | null;
      isian?.select();
    }
  }

  async function bagikan() {
    try {
      await navigator.share({
        title: judul,
        text: `Masuk ke "${judul}" dengan PIN ${pin}`,
        url: tautan,
      });
    } catch {
      // Dibatalkan pemakai atau tidak didukung — tidak perlu diapa-apakan.
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`tautan-${sesiId}`}
          readOnly
          value={tautan}
          onFocus={(e) => e.currentTarget.select()}
          className="isian min-w-0 flex-1 bg-white/5 font-mono text-sm text-white"
          aria-label="Tautan masuk sesi"
        />

        <button type="button" onClick={salin} className="tombol tombol-terang tombol-kecil tombol-polos">
          {tersalin ? 'Tersalin ✓' : 'Salin tautan'}
        </button>

        {bisaBagikan ? (
          <button
            type="button"
            onClick={bagikan}
            className="tombol tombol-terang tombol-kecil tombol-polos"
          >
            Bagikan
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setQrTerbuka((v) => !v)}
          className="tombol tombol-terang tombol-kecil tombol-polos"
          aria-expanded={qrTerbuka}
        >
          {qrTerbuka ? 'Sembunyikan QR' : 'Kode QR'}
        </button>
      </div>

      {qrTerbuka ? (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/15 bg-white/5 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/admin/sesi/${sesiId}/qr`}
            alt={`Kode QR untuk ${judul}`}
            width={160}
            height={160}
            className="rounded bg-white p-2"
          />

          <div className="space-y-2">
            <p className="text-sm text-white/70">
              Arahkan kamera ke kode ini untuk masuk langsung — peserta tidak perlu
              mengetik PIN.
            </p>
            <a
              href={`/admin/sesi/${sesiId}/qr?unduh=1`}
              download
              className="tombol tombol-terang tombol-kecil"
            >
              Unduh PNG
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
