import { expect, test } from 'vitest';
import { buatCsvHasil } from '@/lib/csv';
import { urutkanPeringkat, type BarisPeringkat } from '@/lib/ranking';

const BOM = '﻿';

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
const tanpaBom = (teks: string) => teks.replace(/^﻿/, '');
const barisKe = (teks: string, i: number) => tanpaBom(teks).split('\r\n')[i];

test('csv diawali BOM UTF-8', () => {
  expect(csv([baris(1, 'Rina', 8, 0, 3)]).startsWith(BOM)).toBe(true);
});

/**
 * Excel di Windows ber-locale Indonesia memakai titik koma sebagai pemisah
 * daftar; CSV berkoma akan terbuka menumpuk di satu kolom. Spesifikasi §7.6
 * menuntut pemisah yang aman dibuka Excel Indonesia.
 */
test('kolom dipisah titik koma', () => {
  expect(barisKe(csv([]), 0)).toBe(
    'peringkat;nama;skor;maksimum;durasi_detik;selesai_pada',
  );
});

test('nama dengan titik koma dikutip', () => {
  expect(csv([baris(1, 'Rina; Budi', 8, 0, 3)])).toContain('"Rina; Budi"');
});

test('nama dengan koma tetap dikutip', () => {
  expect(csv([baris(1, 'Rina, S.Pd', 8, 0, 3)])).toContain('"Rina, S.Pd"');
});

test('nama dengan tanda kutip ganda di-escape menjadi dua tanda kutip', () => {
  expect(csv([baris(1, 'Si "Jago"', 8, 0, 3)])).toContain('"Si ""Jago"""');
});

test('nama dengan baris baru tetap dalam satu sel', () => {
  expect(csv([baris(1, 'Rina\nBudi', 8, 0, 3)])).toContain('"Rina\nBudi"');
});

test('nama biasa tidak dikutip tanpa perlu', () => {
  expect(csv([baris(1, 'Rina', 8, 0, 3)])).toContain(';Rina;');
});

test('nama yang diawali tanda sama dengan tidak jadi rumus di Excel', () => {
  const teks = csv([baris(1, '=HYPERLINK("http://jahat")', 8, 0, 3)]);
  expect(teks).not.toMatch(/;=HYPERLINK/);
  expect(teks).toContain("'=HYPERLINK");
});

test('nama yang diawali tambah, kurang, atau at juga dinetralkan', () => {
  for (const awalan of ['+', '-', '@']) {
    const teks = csv([baris(1, `${awalan}SUM(A1)`, 8, 0, 3)]);
    expect(teks).toContain(`'${awalan}SUM(A1)`);
  }
});

test('durasi ditulis dalam detik bulat', () => {
  expect(barisKe(csv([baris(1, 'Rina', 8, 2, 5, 41)]), 1).split(';')[4]).toBe('221');
});

test('selesai_pada ditulis dalam waktu lokal, bukan UTC berakhiran Z', () => {
  const kolom = barisKe(csv([baris(1, 'Rina', 8, 0, 3)]), 1).split(';');
  expect(kolom[5]).not.toMatch(/Z$/);
  expect(kolom[5]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('baris mengikuti urutan peringkat', () => {
  const teks = csv([
    baris(1, 'Doni', 8, 0, 9),
    baris(2, 'Budi', 10, 0, 5),
    baris(3, 'Rina', 8, 0, 4),
  ]);

  const nama = tanpaBom(teks)
    .split('\r\n')
    .slice(1)
    .filter((b) => b.length > 0)
    .map((b) => b.split(';')[1]);

  expect(nama).toEqual(['Budi', 'Rina', 'Doni']);
});

test('nomor peringkat ikut tertulis', () => {
  const teks = csv([baris(1, 'Budi', 10, 0, 5), baris(2, 'Rina', 8, 0, 4)]);
  expect(barisKe(teks, 1).split(';')[0]).toBe('1');
  expect(barisKe(teks, 2).split(';')[0]).toBe('2');
});

test('daftar kosong tetap menghasilkan baris judul', () => {
  expect(tanpaBom(csv([])).trim().split('\r\n')).toHaveLength(1);
});
