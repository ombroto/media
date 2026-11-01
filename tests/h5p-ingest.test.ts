import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { beforeAll, describe, expect, test } from 'vitest';
import type { HasilTelan } from '@/lib/h5p-ingest';
import type { IUser } from '@lumieducation/h5p-server';

const AKAR = process.cwd();
const CROSSWORD = join(AKAR, 'konten', 'example-content-crossword-1209160.h5p');
const DIR_UJI = join(AKAR, 'data', 'h5p-test');
const CACHE_APLIKASI = join(AKAR, 'data', 'h5p', 'hub-cache');

let telanPaket: (b: Buffer, n: string, u: IUser) => Promise<HasilTelan>;
let pengguna: IUser;

beforeAll(async () => {
  // Pustaka dan konten dibersihkan supaya "pustaka apa yang baru terpasang"
  // bisa diuji; cache unduhan dipertahankan agar tes tidak mengunduh ulang.
  for (const sub of ['libraries', 'content', 'temp']) {
    rmSync(join(DIR_UJI, sub), { recursive: true, force: true });
  }
  mkdirSync(join(DIR_UJI, 'hub-cache'), { recursive: true });
  if (existsSync(CACHE_APLIKASI)) {
    cpSync(CACHE_APLIKASI, join(DIR_UJI, 'hub-cache'), {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  }

  // Impor setelah pembersihan: mesin H5P dibuat sekali per berkas uji.
  const mod = await import('@/lib/h5p-ingest');
  telanPaket = mod.telanPaket;
  pengguna = mod.H5P_USER_PENYELENGGARA;
});

async function paketTiruan(isi: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [nama, teks] of Object.entries(isi)) zip.file(nama, teks);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('paket cacat ditolak dengan pesan, bukan lemparan', () => {
  test('bukan zip ditolak', async () => {
    const h = await telanPaket(Buffer.from('ini jelas bukan zip'), 'palsu.h5p', pengguna);
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toMatch(/zip|arsip|rusak/i);
  });

  test('zip tanpa h5p.json ditolak', async () => {
    const buf = await paketTiruan({ 'content/content.json': '{}' });
    const h = await telanPaket(buf, 'tanpa-manifest.h5p', pengguna);
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toMatch(/h5p\.json/i);
  });

  test('h5p.json bukan JSON sah ditolak', async () => {
    const buf = await paketTiruan({
      'h5p.json': '{ bukan json',
      'content/content.json': '{}',
    });
    const h = await telanPaket(buf, 'json-rusak.h5p', pengguna);
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toMatch(/h5p\.json/i);
  });

  test('h5p.json tanpa mainLibrary maupun pustaka ditolak', async () => {
    const buf = await paketTiruan({
      'h5p.json': JSON.stringify({ title: 'Tanpa Pustaka Utama' }),
      'content/content.json': '{}',
    });
    const h = await telanPaket(buf, 'tanpa-main.h5p', pengguna);
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toMatch(/mainLibrary|pustaka/i);
  });

  test('berkas lebih dari 64 MB ditolak sebelum dibongkar', async () => {
    const terlalu = Buffer.alloc(64 * 1024 * 1024 + 1);
    const h = await telanPaket(terlalu, 'gendut.h5p', pengguna);
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toMatch(/64\s*MB|terlalu besar/i);
  });
});

describe('penelanan nyata terhadap konten pemilik', () => {
  test(
    'menelan crossword memasang pustaka dari hub dan menghasilkan contentId',
    async () => {
      const h = await telanPaket(
        readFileSync(CROSSWORD),
        'example-content-crossword-1209160.h5p',
        pengguna,
      );

      expect(h.ok).toBe(true);
      if (!h.ok) return;
      expect(h.mainLibrary).toBe('H5P.Crossword');
      expect(h.h5pContentId).toBeTruthy();
      expect(h.hanyaPustaka).toBe(false);
      expect(h.pustakaTerpasang).toContain('H5P.Crossword-0.5');
    },
    900000,
  );

  test(
    'sub-pustaka yang tidak dilayani gudang dijemput lewat tipe konten payung',
    async () => {
      // H5P.AdvancedText dibalas 403 oleh gudang, tapi dibawa H5P.Column.
      // Tes sebelumnya sudah menelan crossword, jadi di sini ia harus ada.
      const h = await telanPaket(readFileSync(CROSSWORD), 'ulang.h5p', pengguna);
      expect(h.ok).toBe(true);
      expect(existsSync(join(DIR_UJI, 'libraries', 'H5P.AdvancedText-1.1'))).toBe(true);
    },
    300000,
  );

  test(
    'menelan berkas yang sama kedua kali tidak memasang pustaka lagi',
    async () => {
      const h = await telanPaket(readFileSync(CROSSWORD), 'ulang-2.h5p', pengguna);

      expect(h.ok).toBe(true);
      if (!h.ok) return;
      expect(h.pustakaTerpasang).toEqual([]);
    },
    300000,
  );

  test(
    'versi yang tidak tersedia di gudang gagal dengan pustakaKurang terisi',
    async () => {
      const buf = await paketTiruan({
        'h5p.json': JSON.stringify({
          title: 'Crossword Masa Depan',
          language: 'en',
          mainLibrary: 'H5P.Crossword',
          embedTypes: ['iframe'],
          license: 'U',
          preloadedDependencies: [
            { machineName: 'H5P.Crossword', majorVersion: '99', minorVersion: '0' },
          ],
        }),
        'content/content.json': '{}',
      });

      const h = await telanPaket(buf, 'masa-depan.h5p', pengguna);

      expect(h.ok).toBe(false);
      if (h.ok) return;
      expect(h.pustakaKurang).toContain('H5P.Crossword 99.0');
      expect(h.pesan).toMatch(/H5P\.Crossword/);
      expect(h.pesan).toMatch(/99\.0/);
    },
    300000,
  );

  test(
    'paket yang hanya berisi pustaka dikenali sebagai pemasangan pustaka',
    async () => {
      const buf = await paketTiruan({
        'h5p.json': JSON.stringify({
          title: 'Hanya Pustaka',
          preloadedDependencies: [
            { machineName: 'H5P.Crossword', majorVersion: '0', minorVersion: '5' },
          ],
        }),
      });

      const h = await telanPaket(buf, 'hanya-pustaka.h5p', pengguna);

      expect(h.ok).toBe(true);
      if (!h.ok) return;
      expect(h.hanyaPustaka).toBe(true);
    },
    300000,
  );
});
