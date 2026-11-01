import { expect, test } from 'vitest';
import { buatCsvHasil } from '@/lib/csv';
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

const csv = (b: BarisPeringkat[]) => buatCsvHasil(urutkanPeringkat(b));

test('csv diawali BOM UTF-8', () => {
  const teks = csv([baris(1, 'Rina', 8, 0, 3)]);
  expect(teks.charCodeAt(0)).toBe(0xfeff);
});

test('baris judul memuat kolom yang dijanjikan', () => {
  const teks = csv([]);
  const kepala = teks.replace(/^﻿/, '').split('\r\n')[0];
  expect(kepala).toBe('peringkat,nama,skor,maksimum,durasi_detik,selesai_pada');
});

test('nama dengan koma dikutip', () => {
  const teks = csv([baris(1, 'Rina, S.Pd', 8, 0, 3)]);
  expect(teks).toContain('"Rina, S.Pd"');
});

test('nama dengan tanda kutip ganda di-escape menjadi dua tanda kutip', () => {
  const teks = csv([baris(1, 'Si "Jago"', 8, 0, 3)]);
  expect(teks).toContain('"Si ""Jago"""');
});

test('nama dengan baris baru tetap dalam satu sel', () => {
  const teks = csv([baris(1, 'Rina\nBudi', 8, 0, 3)]);
  expect(teks).toContain('"Rina\nBudi"');
});

test('nama biasa tidak dikutip tanpa perlu', () => {
  const teks = csv([baris(1, 'Rina', 8, 0, 3)]);
  expect(teks).toContain(',Rina,');
});

test('durasi ditulis dalam detik bulat', () => {
  const teks = csv([baris(1, 'Rina', 8, 2, 5, 41)]);
  const kolom = teks.replace(/^﻿/, '').split('\r\n')[1].split(',');
  expect(kolom[4]).toBe('221');
});

test('baris mengikuti urutan peringkat', () => {
  const teks = csv([
    baris(1, 'Doni', 8, 0, 9),
    baris(2, 'Budi', 10, 0, 5),
    baris(3, 'Rina', 8, 0, 4),
  ]);
  const nama = teks
    .replace(/^﻿/, '')
    .split('\r\n')
    .slice(1)
    .filter((b) => b.length > 0)
    .map((b) => b.split(',')[1]);

  expect(nama).toEqual(['Budi', 'Rina', 'Doni']);
});

test('nomor peringkat ikut tertulis', () => {
  const teks = csv([baris(1, 'Budi', 10, 0, 5), baris(2, 'Rina', 8, 0, 4)]);
  const baris2 = teks.replace(/^﻿/, '').split('\r\n');
  expect(baris2[1].split(',')[0]).toBe('1');
  expect(baris2[2].split(',')[0]).toBe('2');
});

test('daftar kosong tetap menghasilkan baris judul', () => {
  const teks = csv([]);
  expect(teks.replace(/^﻿/, '').trim().split('\r\n')).toHaveLength(1);
});
