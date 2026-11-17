import { expect, test } from 'vitest';
import { bacaKonten } from '../scripts/daftar-konten.mjs';
import { scoringAwal } from '@/lib/scoring-awal.mjs';
import { scoringAwal as scoringAwalRepo } from '@/lib/repo/contents';

// Artefak ini ikut dilacak git, jadi ada di tiap salinan proyek — termasuk di
// mesin build. Ia yang dibaca skrip pendaftaran di produksi.
const CONTOH = '1732613268';

test('membaca judul dan pustaka utama dari h5p.json', () => {
  const k = bacaKonten(CONTOH);
  expect(k).toMatchObject({
    h5pContentId: CONTOH,
    title: 'Babak 1: Warisan dan Asalnya',
    mainLibrary: 'H5P.ImagePair',
  });
});

test('nama berkas sumber disusun dari judulnya', () => {
  expect(bacaKonten(CONTOH)?.sourceFilename).toBe('Babak 1: Warisan dan Asalnya.h5p');
});

test('folder yang bukan konten H5P diabaikan', () => {
  expect(bacaKonten('folder-yang-tidak-ada')).toBeNull();
});

test('skrip dan aplikasi memakai aturan skor yang sama', () => {
  // Kalau keduanya berbeda, konten yang didaftarkan lewat skrip akan punya
  // status skor yang tidak cocok dengan hasil unggahan lewat aplikasi.
  expect(scoringAwal).toBe(scoringAwalRepo);
  expect(scoringAwal('H5P.Column')).toBe('unscored');
  expect(scoringAwal('H5P.ImagePair')).toBe('unknown');
});
