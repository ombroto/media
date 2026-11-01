import { expect, test } from 'vitest';
import { pilihNilaiResmi, type Pernyataan } from '@/lib/scoring';

const T = (menit: number) => new Date(Date.UTC(2026, 10, 1, 8, menit, 0));

type OpsiPernyataan = {
  verb?: string;
  raw?: number;
  max?: number;
  tanpaSkor?: boolean;
  anak?: boolean;
};

function pernyataan(menit: number, o: OpsiPernyataan = {}): Pernyataan {
  const statement: Record<string, unknown> = {
    verb: { display: { 'en-US': o.verb ?? 'answered' } },
  };
  if (!o.tanpaSkor) {
    statement.result = { score: { raw: o.raw ?? 1, max: o.max ?? 1 } };
  }
  if (o.anak) {
    statement.context = {
      contextActivities: { parent: [{ id: 'http://induk' }] },
    };
  }
  return { statement, received_at: T(menit) };
}

test('tanpa pernyataan sama sekali menghasilkan null', () => {
  expect(pilihNilaiResmi([])).toBeNull();
});

test('mengabaikan pernyataan anak', () => {
  expect(pilihNilaiResmi([pernyataan(1, { anak: true })])).toBeNull();
});

test('mengabaikan verb selain answered dan completed', () => {
  expect(pilihNilaiResmi([pernyataan(1, { verb: 'attempted' })])).toBeNull();
  expect(pilihNilaiResmi([pernyataan(2, { verb: 'progressed' })])).toBeNull();
});

test('satu pernyataan answered dipakai', () => {
  const hasil = pilihNilaiResmi([pernyataan(5, { raw: 8, max: 10 })]);
  expect(hasil).toEqual({ score_raw: 8, score_max: 10, finished_at: T(5) });
});

test('completed menang atas answered walau answered datang lebih akhir', () => {
  const hasil = pilihNilaiResmi([
    pernyataan(1, { verb: 'completed', raw: 6, max: 10 }),
    pernyataan(9, { verb: 'answered', raw: 10, max: 10 }),
  ]);
  expect(hasil?.score_raw).toBe(6);
  expect(hasil?.finished_at).toEqual(T(1));
});

test('completed terakhir yang dipakai kalau completed ada beberapa', () => {
  const hasil = pilihNilaiResmi([
    pernyataan(1, { verb: 'completed', raw: 4, max: 10 }),
    pernyataan(7, { verb: 'completed', raw: 9, max: 10 }),
  ]);
  expect(hasil?.score_raw).toBe(9);
  expect(hasil?.finished_at).toEqual(T(7));
});

test('tanpa completed, score.max terbesar yang dipakai', () => {
  const hasil = pilihNilaiResmi([
    pernyataan(1, { raw: 3, max: 5 }),
    pernyataan(4, { raw: 6, max: 20 }),
  ]);
  expect(hasil).toEqual({ score_raw: 6, score_max: 20, finished_at: T(4) });
});

test('score.max terbesar menang walau datang lebih awal', () => {
  const hasil = pilihNilaiResmi([
    pernyataan(1, { raw: 6, max: 20 }),
    pernyataan(4, { raw: 5, max: 5 }),
  ]);
  expect(hasil?.score_max).toBe(20);
  expect(hasil?.finished_at).toEqual(T(1));
});

test('score.max seri, yang terakhir masuk yang dipakai', () => {
  const hasil = pilihNilaiResmi([
    pernyataan(1, { raw: 3, max: 10 }),
    pernyataan(6, { raw: 7, max: 10 }),
  ]);
  expect(hasil?.score_raw).toBe(7);
  expect(hasil?.finished_at).toEqual(T(6));
});

test('pernyataan tanpa result.score diabaikan, bukan menghasilkan NaN', () => {
  expect(pilihNilaiResmi([pernyataan(1, { tanpaSkor: true })])).toBeNull();

  const hasil = pilihNilaiResmi([
    pernyataan(1, { tanpaSkor: true }),
    pernyataan(2, { raw: 4, max: 9 }),
  ]);
  expect(hasil).toEqual({ score_raw: 4, score_max: 9, finished_at: T(2) });
  expect(Number.isNaN(hasil!.score_raw)).toBe(false);
  expect(Number.isNaN(hasil!.score_max)).toBe(false);
});

test('score.max nol diterima apa adanya tanpa pembagian', () => {
  const hasil = pilihNilaiResmi([pernyataan(3, { raw: 0, max: 0 })]);
  expect(hasil).toEqual({ score_raw: 0, score_max: 0, finished_at: T(3) });
});

test('skor bukan angka diabaikan', () => {
  const rusak: Pernyataan = {
    statement: {
      verb: { display: { 'en-US': 'answered' } },
      result: { score: { raw: 'delapan', max: null } },
    },
    received_at: T(1),
  };
  expect(pilihNilaiResmi([rusak])).toBeNull();
});

test('pernyataan yang bukan objek tidak melempar', () => {
  const sampah: Pernyataan[] = [
    { statement: null, received_at: T(1) },
    { statement: 'bukan objek', received_at: T(2) },
    { statement: 42, received_at: T(3) },
  ];
  expect(pilihNilaiResmi(sampah)).toBeNull();
});

test('skor pecahan diabaikan — kolomnya integer', () => {
  const pecahan: Pernyataan = {
    statement: {
      verb: { display: { 'en-US': 'answered' } },
      result: { score: { raw: 1.5, max: 3 } },
    },
    received_at: T(1),
  };
  expect(pilihNilaiResmi([pecahan])).toBeNull();
});

test('skor di luar jangkauan integer 32-bit diabaikan', () => {
  const kebesaran: Pernyataan = {
    statement: {
      verb: { display: { 'en-US': 'answered' } },
      result: { score: { raw: 1e12, max: 1e12 } },
    },
    received_at: T(1),
  };
  expect(pilihNilaiResmi([kebesaran])).toBeNull();
});

test('skor negatif diabaikan', () => {
  const negatif: Pernyataan = {
    statement: {
      verb: { display: { 'en-US': 'answered' } },
      result: { score: { raw: -5, max: 10 } },
    },
    received_at: T(1),
  };
  expect(pilihNilaiResmi([negatif])).toBeNull();
});

test('pernyataan berskor sah tetap dipakai walau ada yang di luar jangkauan', () => {
  const rusak: Pernyataan = {
    statement: {
      verb: { display: { 'en-US': 'answered' } },
      result: { score: { raw: 1e12, max: 1e12 } },
    },
    received_at: T(1),
  };
  const sah = pernyataan(2, { raw: 4, max: 9 });
  expect(pilihNilaiResmi([rusak, sah])).toEqual({
    score_raw: 4,
    score_max: 9,
    finished_at: T(2),
  });
});

test('masukan tidak diubah urutannya oleh pemilih', () => {
  const ps = [pernyataan(5, { raw: 1, max: 5 }), pernyataan(1, { raw: 2, max: 9 })];
  const salinan = [...ps];
  pilihNilaiResmi(ps);
  expect(ps).toEqual(salinan);
});
