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
    return (
      <p className="text-sm opacity-70">
        Belum ada yang menyelesaikan sesi ini.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-black/10 dark:divide-white/15">
      {baris.map((b) => {
        const saya = b.id === sorotiId;
        return (
          <li
            key={b.id}
            className={
              saya
                ? 'flex items-baseline gap-3 rounded-lg px-2 py-2 font-semibold outline outline-1 outline-black/40 dark:outline-white/40'
                : 'flex items-baseline gap-3 px-2 py-2'
            }
          >
            <span className="w-7 shrink-0 tabular-nums opacity-60">{b.peringkat}</span>
            <span className="min-w-0 flex-1 truncate">
              {b.alias}
              {saya ? <span className="ml-2 text-xs opacity-70">(kamu)</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">
              {b.score_raw}
              <span className="opacity-60">/{b.score_max}</span>
            </span>
            <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums opacity-70">
              {durasiSingkat(b.durasi_ms)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
