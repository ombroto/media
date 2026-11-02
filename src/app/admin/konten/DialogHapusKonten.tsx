'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { aksiHapusKonten, type KeadaanHapusKonten } from './actions';
import type { SesiRingkas } from '@/lib/repo/contents';

/**
 * Dialog persetujuan untuk menghapus konten.
 *
 * Menyebutkan sesi mana saja yang ikut terhapus beserta jumlah pesertanya —
 * bukan sekadar "N sesi" — karena yang hilang bersamanya adalah seluruh nilai
 * peserta di sesi itu, dan tidak ada cara mengembalikannya. Judul kontennya
 * harus diketik ulang sebelum tombolnya hidup.
 */
export default function DialogHapusKonten({
  kontenId,
  judul,
  sesi,
}: {
  kontenId: number;
  judul: string;
  sesi: SesiRingkas[];
}) {
  const [terbuka, setTerbuka] = useState(false);
  const [ketikan, setKetikan] = useState('');
  const [keadaan, kirim, sedangKirim] = useActionState<KeadaanHapusKonten, FormData>(
    aksiHapusKonten,
    {},
  );
  const isianRef = useRef<HTMLInputElement>(null);

  const cocok = ketikan.trim() === judul.trim();
  const totalPeserta = sesi.reduce((n, s) => n + s.jumlah_ikut, 0);

  useEffect(() => {
    if (terbuka) isianRef.current?.focus();
  }, [terbuka]);

  useEffect(() => {
    if (!terbuka) return;
    function tutupDenganEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setTerbuka(false);
    }
    window.addEventListener('keydown', tutupDenganEsc);
    return () => window.removeEventListener('keydown', tutupDenganEsc);
  }, [terbuka]);

  if (!terbuka) {
    return (
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="text-xs text-abu underline hover:text-tinta"
      >
        hapus
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Hapus ${judul}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setTerbuka(false);
      }}
    >
      <div className="kartu max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
        <span className="kerlip">Hapus konten</span>
        <h2 className="mt-3 text-xl">{judul}</h2>

        {sesi.length === 0 ? (
          <p className="mt-3 text-sm text-abu">
            Konten ini belum dipakai sesi mana pun. Berkas H5P-nya akan dihapus dari
            server.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm">
              Konten ini dipakai <strong>{sesi.length} sesi</strong>. Semuanya akan
              ikut terhapus
              {totalPeserta > 0 ? (
                <>
                  , beserta nilai <strong>{totalPeserta} peserta</strong> di dalamnya
                </>
              ) : null}
              .
            </p>

            <ul className="mt-3 divide-y divide-garis border-y border-garis">
              {sesi.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
                  <span className="font-judul text-sm tracking-[0.2em] text-oranye">
                    {s.pin}
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-abu">
                    {s.jumlah_ikut === 0 ? 'tanpa peserta' : `${s.jumlah_ikut} peserta`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-3 text-sm text-abu">
          Tindakan ini tidak bisa dibatalkan.
        </p>

        <form action={kirim} className="mt-4 space-y-3">
          <input type="hidden" name="kontenId" value={kontenId} />

          <div>
            <label htmlFor={`konfirmasi-${kontenId}`} className="label-isian">
              Ketik judul kontennya untuk menegaskan
            </label>
            <p className="mb-2 text-sm font-semibold">{judul}</p>
            <input
              id={`konfirmasi-${kontenId}`}
              ref={isianRef}
              name="konfirmasi"
              value={ketikan}
              onChange={(e) => setKetikan(e.target.value)}
              autoComplete="off"
              className="isian"
            />
          </div>

          {keadaan.galat ? (
            <p role="alert" className="pesan pesan-galat">
              {keadaan.galat}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!cocok || sedangKirim}
              className="tombol tombol-bahaya tombol-polos"
            >
              {sedangKirim
                ? 'Menghapus…'
                : sesi.length === 0
                  ? 'Hapus konten'
                  : `Hapus konten & ${sesi.length} sesi`}
            </button>
            <button
              type="button"
              onClick={() => setTerbuka(false)}
              className="tombol tombol-garis tombol-polos"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
