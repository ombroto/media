export type Pernyataan = { statement: unknown; received_at: Date };

export type NilaiResmi = {
  score_raw: number;
  score_max: number;
  finished_at: Date;
};

type Layak = NilaiResmi & { completed: boolean };

function objek(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

/**
 * Syarat kelayakan §4.2: verb `answered` atau `completed`, tanpa induk di
 * contextActivities, dan membawa skor berupa angka.
 */
function layak(p: Pernyataan): Layak | null {
  const s = objek(p.statement);
  if (!s) return null;

  const verb = objek(s.verb);
  const display = verb && objek(verb.display);
  const kata = display?.['en-US'];
  if (kata !== 'answered' && kata !== 'completed') return null;

  const context = objek(s.context);
  const aktivitas = context && objek(context.contextActivities);
  const induk = aktivitas?.parent;
  if (Array.isArray(induk) && induk.length > 0) return null;

  const result = objek(s.result);
  const score = result && objek(result.score);
  if (!score) return null;

  const raw = score.raw;
  const max = score.max;
  if (typeof raw !== 'number' || typeof max !== 'number') return null;
  if (!Number.isFinite(raw) || !Number.isFinite(max)) return null;

  return {
    score_raw: raw,
    score_max: max,
    finished_at: p.received_at,
    completed: kata === 'completed',
  };
}

/**
 * Nilai resmi seorang peserta dari seluruh pernyataan xAPI-nya.
 *
 * Utamakan `completed` yang terakhir; kalau tak ada, ambil `score.max`
 * terbesar — yaitu pernyataan dengan cakupan soal terluas — dan kalau masih
 * seri, yang terakhir masuk. `null` berarti belum ada nilai yang sah; untuk
 * konten tak berskor itu keadaan tetapnya, bukan kesalahan.
 */
export function pilihNilaiResmi(ps: Pernyataan[]): NilaiResmi | null {
  const kandidat = ps
    .map(layak)
    .filter((k): k is Layak => k !== null)
    .sort((a, b) => a.finished_at.getTime() - b.finished_at.getTime());

  if (kandidat.length === 0) return null;

  const selesai = kandidat.filter((k) => k.completed);
  const terpilih = selesai.length
    ? selesai[selesai.length - 1]
    : kandidat.reduce((a, b) => (b.score_max >= a.score_max ? b : a));

  return {
    score_raw: terpilih.score_raw,
    score_max: terpilih.score_max,
    finished_at: terpilih.finished_at,
  };
}
