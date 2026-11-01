import { expect, test } from 'vitest';
import { urutkanPeringkat, type BarisPeringkat } from '@/lib/ranking';

const T = (menit: number, detik = 0) =>
  new Date(Date.UTC(2026, 10, 1, 8, menit, detik));

function baris(
  id: number,
  alias: string,
  score_raw: number,
  mulaiMenit: number,
  selesaiMenit: number,
  selesaiDetik = 0,
): BarisPeringkat {
  return {
    id,
    alias,
    score_raw,
    score_max: 10,
    started_at: T(mulaiMenit),
    finished_at: T(selesaiMenit, selesaiDetik),
  };
}

test('skor lebih tinggi lebih dulu', () => {
  const hasil = urutkanPeringkat([baris(1, 'Rina', 8, 0, 5), baris(2, 'Budi', 10, 0, 9)]);
  expect(hasil.map((b) => b.alias)).toEqual(['Budi', 'Rina']);
});

test('skor sama, durasi lebih singkat lebih dulu', () => {
  const hasil = urutkanPeringkat([
    baris(1, 'Doni', 8, 0, 9),
    baris(2, 'Rina', 8, 0, 4),
  ]);
  expect(hasil.map((b) => b.alias)).toEqual(['Rina', 'Doni']);
});

test('skor dan durasi sama, finished_at lebih awal lebih dulu', () => {
  const hasil = urutkanPeringkat([
    baris(1, 'Kedua', 8, 10, 14),
    baris(2, 'Pertama', 8, 2, 6),
  ]);
  expect(hasil.map((b) => b.alias)).toEqual(['Pertama', 'Kedua']);
});

test('durasi dihitung dari started_at dan finished_at', () => {
  const [b] = urutkanPeringkat([baris(1, 'Rina', 8, 2, 5, 41)]);
  expect(b.durasi_ms).toBe((3 * 60 + 41) * 1000);
});

test('peringkat bernomor urut mulai dari satu', () => {
  const hasil = urutkanPeringkat([
    baris(1, 'C', 6, 0, 3),
    baris(2, 'A', 10, 0, 2),
    baris(3, 'B', 8, 0, 4),
  ]);
  expect(hasil.map((b) => b.peringkat)).toEqual([1, 2, 3]);
  expect(hasil.map((b) => b.alias)).toEqual(['A', 'B', 'C']);
});

test('peserta dengan skor dan durasi identik tetap mendapat nomor berbeda', () => {
  const hasil = urutkanPeringkat([
    baris(1, 'Kembar A', 8, 0, 5),
    baris(2, 'Kembar B', 8, 0, 5),
  ]);
  expect(hasil.map((b) => b.peringkat)).toEqual([1, 2]);
});

test('daftar kosong menghasilkan daftar kosong', () => {
  expect(urutkanPeringkat([])).toEqual([]);
});

test('masukan tidak diubah urutannya', () => {
  const masuk = [baris(1, 'Rina', 8, 0, 5), baris(2, 'Budi', 10, 0, 9)];
  const salinan = [...masuk];
  urutkanPeringkat(masuk);
  expect(masuk).toEqual(salinan);
});
