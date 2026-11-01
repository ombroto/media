import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { getH5P } from '@/lib/h5p';
import { periksaAksesH5P } from '@/lib/h5p-access';

const DIR_INTI = join(process.cwd(), 'public', 'h5p-core');

const TIPE: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',
};

function tipeDari(nama: string): string {
  const titik = nama.lastIndexOf('.');
  return (titik >= 0 ? TIPE[nama.slice(titik).toLowerCase()] : undefined) ?? 'application/octet-stream';
}

/** Menolak ".." dan jalur absolut sebelum menyentuh berkas apa pun. */
function jalurAman(dasar: string, relatif: string): string | null {
  const gabung = normalize(join(dasar, relatif));
  return gabung.startsWith(dasar + sep) ? gabung : null;
}

function tolak(status: number, pesan: string): Response {
  return new Response(pesan, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

async function sajikanInti(sisa: string[]): Promise<Response> {
  const berkas = jalurAman(DIR_INTI, sisa.join('/'));
  if (!berkas) return tolak(400, 'Jalur berkas tidak sah.');

  const info = await stat(berkas).catch(() => null);
  if (!info?.isFile()) {
    return tolak(
      404,
      'Aset inti H5P belum disalin. Jalankan: npm run h5p:core',
    );
  }

  return new Response(Readable.toWeb(createReadStream(berkas)) as ReadableStream, {
    headers: {
      'content-type': tipeDari(berkas),
      'content-length': String(info.size),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const [bagian, ...sisa] = path ?? [];
  const { ajax } = getH5P();

  // Aset inti: dilayani dari public/h5p-core, tanpa pemeriksaan izin — ia sama
  // untuk semua orang dan tidak membocorkan isi kuis.
  if (bagian === 'core') return sajikanInti(sisa);

  // Berkas pustaka: kode tipe konten, sama untuk semua, jadi juga terbuka (§7.3).
  if (bagian === 'libraries') {
    const [ubername, ...berkas] = sisa;
    if (!ubername || berkas.length === 0) return tolak(400, 'Permintaan pustaka tidak lengkap.');
    try {
      const hasil = await ajax.getLibraryFile(ubername, berkas.join('/'));
      return new Response(Readable.toWeb(hasil.stream) as ReadableStream, {
        headers: {
          'content-type': tipeDari(berkas.join('/')),
          'content-length': String(hasil.stats.size),
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return tolak(404, 'Berkas pustaka tidak ditemukan.');
    }
  }

  // Berkas konten: TIDAK anonim.
  if (bagian === 'content') {
    const [contentId, ...berkas] = sisa;
    if (!contentId || berkas.length === 0) return tolak(400, 'Permintaan konten tidak lengkap.');

    const akses = await periksaAksesH5P(req, contentId);
    if (!akses) return tolak(403, 'Berkas konten ini hanya untuk peserta sesi yang sedang terbuka.');

    try {
      const hasil = await ajax.getContentFile(contentId, berkas.join('/'), {
        id: 'akses',
        name: 'Akses',
        email: 'akses@lokal',
        type: 'local',
      });
      return new Response(Readable.toWeb(hasil.stream) as ReadableStream, {
        headers: {
          'content-type': hasil.mimetype ?? tipeDari(berkas.join('/')),
          'content-length': String(hasil.stats.size),
          'cache-control': 'private, max-age=3600',
        },
      });
    } catch {
      return tolak(404, 'Berkas konten tidak ditemukan.');
    }
  }

  return tolak(404, 'Jalur H5P tidak dikenal.');
}
