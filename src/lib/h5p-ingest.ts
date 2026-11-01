import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import yauzl from 'yauzl';
import { BATAS_UNGGAH, H5P_USER_PENYELENGGARA, dirHubCache, getH5P } from '@/lib/h5p';
import type { IUser } from '@lumieducation/h5p-server';

export { H5P_USER_PENYELENGGARA };

export type HasilTelan =
  | {
      ok: true;
      h5pContentId: string;
      title: string;
      mainLibrary: string;
      pustakaTerpasang: string[];
      hanyaPustaka: boolean;
    }
  | { ok: false; pesan: string; pustakaKurang?: string[] };

type Dependensi = { machineName: string; majorVersion: number; minorVersion: number };

type Manifest = {
  title: string;
  mainLibrary?: string;
  preloadedDependencies?: unknown;
};

const ENDPOINT_HUB = 'https://hub-api.h5p.org/v1/content-types/';

/**
 * Tipe konten yang membawa banyak sub-pustaka sekaligus, dipakai sebagai jalan
 * belakang untuk sub-pustaka yang tidak dilayani gudang secara langsung.
 * H5P.Column memuat 90 pustaka; H5P.CoursePresentation menambal sisanya.
 */
const PAYUNG_PUSTAKA = ['H5P.Column', 'H5P.CoursePresentation'] as const;

function angka(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Membaca satu berkas dari dalam arsip zip tanpa membongkar sisanya. */
async function bacaDariZip(buf: Buffer, nama: string): Promise<Buffer | null> {
  const zip = await new Promise<yauzl.ZipFile>((res, rej) =>
    yauzl.fromBuffer(buf, { lazyEntries: true }, (e, z) =>
      e || !z ? rej(e ?? new Error('zip tidak terbaca')) : res(z),
    ),
  );

  return new Promise<Buffer | null>((res, rej) => {
    let ketemu = false;
    zip.on('entry', (entry) => {
      if (entry.fileName !== nama) return zip.readEntry();
      ketemu = true;
      zip.openReadStream(entry, (e, aliran) => {
        if (e || !aliran) return rej(e ?? new Error('aliran gagal dibuka'));
        const bagian: Buffer[] = [];
        aliran.on('data', (d: Buffer) => bagian.push(d));
        aliran.on('end', () => res(Buffer.concat(bagian)));
        aliran.on('error', rej);
      });
    });
    zip.on('end', () => {
      if (!ketemu) res(null);
    });
    zip.on('error', rej);
    zip.readEntry();
  });
}

function bacaManifest(raw: Buffer): Manifest | null {
  try {
    const m = JSON.parse(raw.toString('utf8')) as Manifest;
    return typeof m === 'object' && m !== null ? m : null;
  } catch {
    return null;
  }
}

function dependensi(m: Manifest): Dependensi[] {
  const keluar: Dependensi[] = [];
  const daftar = Array.isArray(m.preloadedDependencies) ? m.preloadedDependencies : [];
  for (const d of daftar) {
    if (typeof d !== 'object' || d === null) continue;
    const o = d as Record<string, unknown>;
    const major = angka(o.majorVersion);
    const minor = angka(o.minorVersion);
    if (typeof o.machineName !== 'string' || major === null || minor === null) continue;
    keluar.push({ machineName: o.machineName, majorVersion: major, minorVersion: minor });
  }
  return keluar;
}

const nama = (d: Dependensi) => `${d.machineName} ${d.majorVersion}.${d.minorVersion}`;

/** "H5P.AdvancedText-1.1" → "H5P.AdvancedText" */
function machineNameDariUbername(ubername: string): string | null {
  const m = /^(.+)-\d+\.\d+$/.exec(ubername.trim());
  return m ? m[1] : null;
}

/**
 * Pustaka apa yang diadukan sebuah galat H5P. Daftar preloadedDependencies di
 * h5p.json tidak memuat seluruh pohon ketergantungan — paket hub Crossword,
 * misalnya, tidak membawa H5P.AdvancedText walau validator menuntutnya — jadi
 * pustaka yang muncul belakangan dijemput dari galatnya sendiri.
 */
function pustakaDariGalat(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return null;
  const g = e as { replacements?: Record<string, unknown> };
  const lib = g.replacements?.library;
  if (typeof lib !== 'string') return null;
  return machineNameDariUbername(lib) ?? lib;
}

async function terpasang(d: Dependensi): Promise<boolean> {
  const { editor } = getH5P();
  const meta = await editor.libraryManager.getLibrary({
    machineName: d.machineName,
    majorVersion: d.majorVersion,
    minorVersion: d.minorVersion,
  } as never).catch(() => null);
  return meta !== null && meta !== undefined;
}

/**
 * Mengunduh paket tipe konten dari gudang H5P dan menyimpannya di hub-cache,
 * supaya versi yang pernah berhasil tetap tersedia walau gudangnya bergerak maju
 * (§5.4 penangkal 1).
 */
async function ambilDariHub(machineName: string): Promise<Buffer | null> {
  const dir = dirHubCache();
  await mkdir(dir, { recursive: true });
  const berkas = join(dir, `${machineName}.h5p`);

  const adaCache = await stat(berkas).then(
    (s) => s.isFile() && s.size > 0,
    () => false,
  );
  if (adaCache) return readFile(berkas);

  const res = await fetch(`${ENDPOINT_HUB}${encodeURIComponent(machineName)}`);
  if (!res.ok || !res.body) return null;

  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(berkas));
  return readFile(berkas);
}

/**
 * Menelan satu paket .h5p: periksa manifestnya, pasang pustaka yang hilang dari
 * gudang H5P, lalu simpan kontennya. Urutannya mengikuti §5.4 — manifest dibaca
 * lebih dulu supaya pustaka yang hilang bisa dipasang sebelum validator berjalan.
 */
export async function telanPaket(
  berkas: Buffer,
  namaBerkas: string,
  user: IUser,
): Promise<HasilTelan> {
  if (berkas.byteLength > BATAS_UNGGAH) {
    return { ok: false, pesan: 'Berkas terlalu besar — batasnya 64 MB.' };
  }

  let mentah: Buffer | null;
  try {
    mentah = await bacaDariZip(berkas, 'h5p.json');
  } catch {
    return {
      ok: false,
      pesan: 'Berkas ini bukan arsip zip yang sah, jadi bukan paket H5P. Pastikan berkasnya berakhiran .h5p dan tidak rusak.',
    };
  }

  if (!mentah) {
    return {
      ok: false,
      pesan: 'Paket ini tidak memuat h5p.json, jadi bukan paket H5P yang sah.',
    };
  }

  const manifest = bacaManifest(mentah);
  if (!manifest) {
    return { ok: false, pesan: 'Berkas h5p.json di dalam paket ini rusak dan tidak bisa dibaca.' };
  }

  const { editor } = getH5P();
  const hanyaPustaka = !manifest.mainLibrary;
  const deps = dependensi(manifest);

  if (hanyaPustaka && deps.length === 0) {
    return {
      ok: false,
      pesan: 'Paket ini tidak menyebut mainLibrary maupun pustaka apa pun, jadi tidak ada yang bisa dipasang.',
    };
  }

  // Pustaka utama ikut diperiksa walau tidak tercantum di preloadedDependencies.
  const perlu = [...deps];
  if (manifest.mainLibrary && !perlu.some((d) => d.machineName === manifest.mainLibrary)) {
    const utama = deps.find((d) => d.machineName === manifest.mainLibrary);
    if (utama) perlu.push(utama);
  }

  const pustakaTerpasang: string[] = [];
  const kurang: string[] = [];

  const payungDipakai = new Set<string>();

  /** Mengunduh satu tipe konten dari hub dan memasang seluruh pustaka di dalamnya. */
  async function pasangBundel(machineName: string): Promise<boolean> {
    const paketHub = await ambilDariHub(machineName);
    if (!paketHub) return false;
    try {
      const hasil = await editor.uploadPackage(paketHub, user, {
        onlyInstallLibraries: true,
      });
      for (const l of hasil.installedLibraries) {
        if (l.newVersion) {
          pustakaTerpasang.push(
            `${l.newVersion.machineName}-${l.newVersion.majorVersion}.${l.newVersion.minorVersion}`,
          );
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gudang H5P hanya melayani *tipe konten*; sub-pustaka seperti
   * H5P.AdvancedText dibalas 403 walau banyak konten menuntutnya. Sub-pustaka
   * seperti itu dijemput lewat tipe konten "payung" yang membawanya — H5P.Column
   * sendiri memuat 90 pustaka, termasuk hampir semua sub-pustaka yang umum.
   */
  async function pasangDariHub(machineName: string): Promise<boolean> {
    if (await pasangBundel(machineName)) return true;

    for (const payung of PAYUNG_PUSTAKA) {
      if (payungDipakai.has(payung)) continue;
      payungDipakai.add(payung);
      if (await pasangBundel(payung)) return true;
    }
    return false;
  }

  for (const d of perlu) {
    if (await terpasang(d)) continue;
    const berhasil = await pasangDariHub(d.machineName);
    if (!berhasil || !(await terpasang(d))) kurang.push(nama(d));
  }

  if (kurang.length) {
    const terpasangSekarang = pustakaTerpasang.length
      ? ` Yang berhasil dipasang: ${pustakaTerpasang.join(', ')}.`
      : '';
    return {
      ok: false,
      pustakaKurang: kurang,
      pesan:
        `Pustaka yang diminta konten ini tidak tersedia di gudang H5P: ${kurang.join(', ')}.` +
        terpasangSekarang +
        ' Gudang H5P hanya menyediakan versi terbaru, jadi kalau konten ini meminta versi lama,' +
        ' unduh ulang kontennya dalam bentuk yang menyertakan pustaka ("export with libraries")' +
        ' lalu unggah lagi, atau unggah berkas pustakanya langsung di kotak unggah ini.',
    };
  }

  if (hanyaPustaka) {
    return {
      ok: true,
      h5pContentId: '',
      title: namaBerkas,
      mainLibrary: '',
      pustakaTerpasang,
      hanyaPustaka: true,
    };
  }

  // Pustaka yang kurang bisa baru tersingkap saat validator berjalan, jadi
  // pemasangan diulang sambil menjemput pustaka yang diadukan galatnya.
  const sudahDijemput = new Set<string>();
  const BATAS_PERCOBAAN = 12;

  for (let percobaan = 0; percobaan < BATAS_PERCOBAAN; percobaan++) {
    try {
      const diunggah = await editor.uploadPackage(berkas, user);
      if (!diunggah.metadata || !diunggah.parameters) {
        return { ok: false, pesan: 'Paket terbaca tapi tidak memuat konten yang bisa disimpan.' };
      }

      const meta = diunggah.metadata;
      const utama = (meta.preloadedDependencies ?? []).find(
        (d) => d.machineName === meta.mainLibrary,
      );
      if (!utama) {
        return {
          ok: false,
          pesan: `Paket tidak menyebut versi pustaka utamanya (${meta.mainLibrary}), jadi kontennya tidak bisa disimpan.`,
        };
      }

      const contentId = await editor.saveOrUpdateContent(
        undefined as never,
        diunggah.parameters,
        meta,
        `${utama.machineName} ${utama.majorVersion}.${utama.minorVersion}`,
        user,
      );

      return {
        ok: true,
        h5pContentId: String(contentId),
        title: meta.title ?? manifest.title ?? namaBerkas,
        mainLibrary: meta.mainLibrary,
        pustakaTerpasang,
        hanyaPustaka: false,
      };
    } catch (e) {
      const machineName = pustakaDariGalat(e);
      const pesanAsli = e instanceof Error ? e.message : String(e);

      if (!machineName || sudahDijemput.has(machineName)) {
        return {
          ok: false,
          pesan: `Paket gagal dipasang: ${pesanAsli}`,
          ...(machineName ? { pustakaKurang: [machineName] } : {}),
        };
      }

      sudahDijemput.add(machineName);
      if (!(await pasangDariHub(machineName))) {
        return {
          ok: false,
          pustakaKurang: [machineName],
          pesan:
            `Konten ini memerlukan pustaka ${machineName}, tapi pustaka itu tidak tersedia di gudang H5P.` +
            ' Unduh ulang kontennya dalam bentuk yang menyertakan pustaka ("export with libraries")' +
            ' lalu unggah lagi, atau unggah berkas pustakanya langsung di kotak unggah ini.',
        };
      }
    }
  }

  return {
    ok: false,
    pesan: `Paket ini masih meminta pustaka baru setelah ${BATAS_PERCOBAAN} kali penjemputan dari gudang H5P; pemasangannya dihentikan.`,
  };
}
