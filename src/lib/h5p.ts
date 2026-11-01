import { mkdirSync } from 'node:fs';
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

function dirData(): string {
  const dari = process.env.H5P_DATA_DIR ?? './data/h5p';
  return isAbsolute(dari) ? dari : join(process.cwd(), dari);
}

function buatMesin(): MesinH5P {
  const akar = dirData();
  const dir = {
    libraries: join(akar, 'libraries'),
    content: join(akar, 'content'),
    temp: join(akar, 'temp'),
    hubCache: join(akar, 'hub-cache'),
  };
  for (const d of Object.values(dir)) mkdirSync(d, { recursive: true });

  const config = new H5PConfig(undefined, {
    baseUrl: '/h5p',
    coreUrl: '/h5p-core',
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
