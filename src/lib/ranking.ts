export type BarisPeringkat = {
  id: number;
  alias: string;
  score_raw: number;
  score_max: number;
  started_at: Date;
  finished_at: Date;
};

export type BarisTerperingkat = BarisPeringkat & {
  peringkat: number;
  durasi_ms: number;
};

/**
 * Urutan peringkat §5.6: skor menurun, lalu durasi menaik, lalu yang lebih
 * dulu selesai. Durasi selalu dihitung di sini dari cap waktu server.
 */
export function urutkanPeringkat(b: BarisPeringkat[]): BarisTerperingkat[] {
  return b
    .map((x) => ({
      ...x,
      durasi_ms: x.finished_at.getTime() - x.started_at.getTime(),
    }))
    .sort(
      (a, z) =>
        z.score_raw - a.score_raw ||
        a.durasi_ms - z.durasi_ms ||
        a.finished_at.getTime() - z.finished_at.getTime(),
    )
    .map((x, i) => ({ ...x, peringkat: i + 1 }));
}
