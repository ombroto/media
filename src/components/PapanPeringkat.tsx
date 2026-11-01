import { durasiSingkat } from '@/lib/waktu';
import type { BarisTerperingkat } from '@/lib/ranking';

/**
 * Papan peringkat lengkap — semua peserta, bukan hanya sepuluh teratas (§5.6).
 * Baris peserta sendiri ditandai lewat `sorotiId`.
 */
export default function PapanPeringkat({
  baris,
  sorotiId,
}: {
  baris: BarisTerperingkat[];
  sorotiId?: number;
}) {
  if (baris.length === 0) {
    return <p className="text-sm text-abu">Belum ada yang menyelesaikan sesi ini.</p>;
  }

  return (
    <ol className="kartu divide-y divide-garis overflow-hidden">
      {baris.map((b) => {
        const saya = b.id === sorotiId;
        return (
          <li
            key={b.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              saya ? 'bg-oranye/8 font-semibold' : ''
            }`}
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded font-judul text-sm ${
                b.peringkat <= 3 ? 'bg-oranye text-white' : 'bg-krem-2 text-abu'
              }`}
            >
              {b.peringkat}
            </span>

            <span className="min-w-0 flex-1 truncate">
              {b.alias}
              {saya ? <span className="ml-2 text-xs text-oranye">(kamu)</span> : null}
            </span>

            <span className="shrink-0 font-judul tabular-nums">
              {b.score_raw}
              <span className="text-abu">/{b.score_max}</span>
            </span>

            <span className="w-14 shrink-0 text-right text-sm tabular-nums text-abu">
              {durasiSingkat(b.durasi_ms)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
