import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import {
  H5PAjaxEndpoint,
  H5PConfig,
  H5PEditor,
  H5PPlayer,
  LaissezFairePermissionSystem,
  cacheImplementations,
  fsImplementations,
  type IUser,
} from '@lumieducation/h5p-server';

export const BATAS_UNGGAH = 64 * 1024 * 1024;

/**
 * Pengguna H5P untuk pekerjaan penyelenggara (unggah, pasang pustaka).
 * Izin sebenarnya dijaga di lapisan kita (§7.3), bukan di dalam h5p-server.
 */
export const H5P_USER_PENYELENGGARA: IUser = {
  id: 'penyelenggara',
  name: 'Penyelenggara',
  email: 'penyelenggara@lokal',
  type: 'local',
};

export type MesinH5P = {
  editor: H5PEditor;
  player: H5PPlayer;
  ajax: H5PAjaxEndpoint;
  config: H5PConfig;
};

declare global {
  // eslint-disable-next-line no-var
  var __mesinH5P: MesinH5P | undefined;
}

/**
 * Mencari direktori artefak H5P.
 *
 * Jalurnya tidak bisa ditebak dari satu sumber saja. Di pengembangan ia relatif
 * terhadap akar proyek; di Vercel berkas yang ikut dibawa mendarat di direktori
 * kerja fungsi, yang tidak dijamin sama dengan `process.cwd()`. Karena itu
 * beberapa kandidat dicoba dan yang pertama benar-benar berisi `libraries`
 * yang dipakai.
 *
 * Kalau tidak satu pun ketemu, lemparkan galat yang menyebutkan apa saja yang
 * sudah dicoba. Tanpa itu, kegagalannya muncul sebagai 500 berbadan kosong —
 * persis yang terjadi pada deploy pertama dan mahal sekali untuk dilacak,
 * karena FileLibraryStorage memanggil mkdirSync di konstruktornya dan disk
 * Vercel menolaknya dengan EROFS.
 */
/** Apakah artefak H5P hanya bisa dibaca (produksi tanpa penyimpanan objek). */
export function artefakHanyaBaca(): boolean {
  return Boolean(process.env.VERCEL);
}

let akarTersimpan: string | null = null;

function dirData(): string {
  if (akarTersimpan) return akarTersimpan;

  // Setelan eksplisit menang mutlak. Tanpa aturan ini, pengujian yang sengaja
  // mengosongkan direktorinya akan jatuh ke direktori aplikasi yang asli dan
  // diam-diam menguji data yang salah.
  const eksplisit = process.env.H5P_DATA_DIR_ABS ?? process.env.H5P_DATA_DIR;
  if (eksplisit) {
    akarTersimpan = isAbsolute(eksplisit) ? eksplisit : join(process.cwd(), eksplisit);
    return akarTersimpan;
  }

  // Tanpa setelan, jalurnya ditebak: di produksi berkas yang ikut dibawa
  // mendarat di direktori kerja fungsi, yang tidak dijamin sama dengan
  // process.cwd().
  const dicoba = [join(process.cwd(), 'data', 'h5p'), join('/var/task', 'data', 'h5p')];
  for (const abs of dicoba) {
    if (existsSync(join(abs, 'libraries'))) {
      akarTersimpan = abs;
      return abs;
    }
  }

  // Di disk yang bisa ditulis, direktorinya boleh belum ada — penyimpanan H5P
  // akan membuatnya sendiri.
  if (!artefakHanyaBaca()) {
    akarTersimpan = dicoba[0];
    return dicoba[0];
  }

  // Di produksi ini harus berisik: konstruktor penyimpanan H5P memanggil
  // mkdirSync, dan di disk hanya-baca galatnya muncul sebagai 500 berbadan
  // kosong yang tidak menyebutkan apa pun.
  throw new Error(
    `Direktori pustaka H5P tidak ditemukan. Dicoba: ${dicoba.join(' | ')}. cwd: ${process.cwd()}`,
  );
}

/**
 * Area kerja sementara. Di Vercel hanya /tmp yang bisa ditulis, dan isinya
 * hilang tiap permintaan — tidak masalah, karena berkas sementara memang hanya
 * hidup selama satu penelanan paket.
 */
function dirTemp(): string {
  return process.env.VERCEL ? join(tmpdir(), 'h5p-temp') : join(dirData(), 'temp');
}

function buatMesin(): MesinH5P {
  const akar = dirData();
  const dir = {
    libraries: join(akar, 'libraries'),
    content: join(akar, 'content'),
    temp: dirTemp(),
    hubCache: join(akar, 'hub-cache'),
  };
  // Direktorinya dibuat di luar bundel — lihat next.config.ts dan tests/setup.ts.

  const config = new H5PConfig(undefined, {
    // Bawaan h5p-server sudah pas: /h5p/core, /h5p/libraries, /h5p/ajax, dan
    // berkas konten di /h5p/content/<id>. Semuanya dilayani route handler kita.
    baseUrl: '/h5p',
    // h5p-server 10.0.4 mengaku core API 1.27, sementara pustaka yang dilayani
    // gudang H5P hari ini menuntut 1.28 dan akan ditolak validatornya. Aset
    // inti yang kita sajikan diambil dari plugin mod_hvp yang memang 1.28
    // (lihat scripts/copy-h5p-core.mjs), jadi angka ini diselaraskan dengan
    // yang benar-benar dijalankan di peramban.
    coreApiVersion: { major: 1, minor: 28 },
    // Tidak ada pengarangan di situs ini, jadi editor dan hub konten dimatikan.
    contentHubEnabled: false,
    setFinishedEnabled: false,
    maxFileSize: BATAS_UNGGAH,
    maxTotalSize: BATAS_UNGGAH,
    contentWhitelist: 'json png jpg jpeg gif bmp tif tiff svg eot ttf woff woff2 otf webm mp4 ogg mp3 m4a wav txt pdf rtf doc docx xls xlsx ppt pptx odt ods odp xml csv diff patch swf md textile vtt webvtt',
  });

  const libraryStorage = new cacheImplementations.CachedLibraryStorage(
    new fsImplementations.FileLibraryStorage(dir.libraries),
  );
  const contentStorage = new fsImplementations.FileContentStorage(dir.content);
  const temporaryStorage = new fsImplementations.DirectoryTemporaryFileStorage(dir.temp);
  const permissionSystem = new LaissezFairePermissionSystem();

  const editor = new H5PEditor(
    new fsImplementations.InMemoryStorage(),
    config,
    libraryStorage,
    contentStorage,
    temporaryStorage,
    undefined,
    undefined,
    { permissionSystem },
  );

  const player = new H5PPlayer(
    libraryStorage,
    contentStorage,
    config,
    undefined,
    undefined,
    undefined,
    { permissionSystem },
    // contentUserDataStorage sengaja dikosongkan: keadaan peserta tidak
    // disimpan, sesuai keputusan §7.4 ("mulai ulang, jam tetap jalan").
  );

  const ajax = new H5PAjaxEndpoint(editor);

  return { editor, player, ajax, config };
}

/** Satu mesin untuk seluruh proses; mode dev Next.js memuat ulang modul. */
export function getH5P(): MesinH5P {
  globalThis.__mesinH5P ??= buatMesin();
  return globalThis.__mesinH5P;
}

export function dirHubCache(): string {
  return join(dirData(), 'hub-cache');
}
