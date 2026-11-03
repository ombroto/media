import { expect, test } from 'vitest';
import { namaBerkasCsv } from '@/lib/csv';
import { namaBerkasAman } from '@/lib/nama-berkas';

test('membuang karakter yang dilarang nama berkas Windows', () => {
  expect(namaBerkasAman('Bab 1/2: "uji" <coba>?|*')).not.toMatch(/[\\/:*?"<>|]/);
});

test('spasi menjadi tanda hubung tunggal', () => {
  expect(namaBerkasAman('Teka-teki   Silang  Bab 3')).toBe('Teka-teki-Silang-Bab-3');
});

test('tidak diawali atau diakhiri tanda hubung', () => {
  expect(namaBerkasAman('  : Bab 3 :  ')).toBe('Bab-3');
});

test('teks yang seluruhnya terlarang menghasilkan nama cadangan', () => {
  expect(namaBerkasAman('///***')).toBe('berkas');
});

test('dipotong pada batas panjang', () => {
  expect(namaBerkasAman('x'.repeat(200)).length).toBeLessThanOrEqual(60);
});

test('karakter kendali dibuang', () => {
  expect(namaBerkasAman('Bab\u00013')).toBe('Bab3');
});

test('nama berkas CSV tetap seperti semula', () => {
  expect(namaBerkasCsv('Teka-teki Silang Bab 3', '482917')).toBe(
    'hasil-Teka-teki-Silang-Bab-3-482917.csv',
  );
});

test('judul sesi kosong tetap menghasilkan nama CSV yang sah', () => {
  expect(namaBerkasCsv('   ', '100001')).toBe('hasil-sesi-100001.csv');
});

test('nama cadangan bisa disesuaikan pemanggilnya', () => {
  expect(namaBerkasAman('///', 60, 'sesi')).toBe('sesi');
});
