/**
 * Rute diagnosis untuk kegagalan pemuatan modul H5P.
 *
 * Tidak mengimpor apa pun di tingkat modul — semuanya diimpor dinamis di dalam
 * penanganan permintaan dan dibungkus try/catch. Dengan begitu rute ini sendiri
 * dijamin bisa dimuat, bahkan ketika rute H5P lain jatuh sebelum sempat
 * membalas apa pun.
 *
 * Dipasang karena di Vercel seluruh rute /h5p/* membalas 500 berbadan kosong:
 * fungsinya terpanggil (X-Matched-Path cocok) tapi gagal sebelum baris pertama
 * kode kita jalan, dan tidak ada satu pun petunjuk yang sampai ke peramban.
 */
export const dynamic = 'force-dynamic';

type Langkah = { langkah: string; ok: boolean; pesan?: string; info?: unknown };

async function coba(
  nama: string,
  fn: () => Promise<unknown> | unknown,
): Promise<Langkah> {
  try {
    const info = await fn();
    return { langkah: nama, ok: true, info };
  } catch (e) {
    return {
      langkah: nama,
      ok: false,
      pesan: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      info:
        e && typeof e === 'object' && 'code' in e
          ? { code: (e as { code?: unknown }).code }
          : undefined,
    };
  }
}

export async function GET() {
  const hasil: Langkah[] = [];

  hasil.push(
    await coba('lingkungan', () => ({
      cwd: process.cwd(),
      vercel: process.env.VERCEL ?? null,
      region: process.env.VERCEL_REGION ?? null,
      H5P_DATA_DIR: process.env.H5P_DATA_DIR ?? null,
      H5P_DATA_DIR_ABS: process.env.H5P_DATA_DIR_ABS ?? null,
      punyaDatabaseUrl: Boolean(process.env.DATABASE_URL),
      punyaSessionSecret: Boolean(process.env.SESSION_SECRET),
    })),
  );

  hasil.push(
    await coba('baca direktori kerja', async () => {
      const { readdirSync } = await import('node:fs');
      return readdirSync(process.cwd()).slice(0, 30);
    }),
  );

  hasil.push(
    await coba('cari data/h5p/libraries', async () => {
      const { existsSync, readdirSync } = await import('node:fs');
      const { join } = await import('node:path');
      const kandidat = [
        join(process.cwd(), 'data', 'h5p'),
        join('/var/task', 'data', 'h5p'),
      ];
      return kandidat.map((k) => ({
        jalur: k,
        ada: existsSync(k),
        adaLibraries: existsSync(join(k, 'libraries')),
        jumlahPustaka: existsSync(join(k, 'libraries'))
          ? readdirSync(join(k, 'libraries')).length
          : 0,
      }));
    }),
  );

  hasil.push(
    await coba('impor @lumieducation/h5p-server', async () => {
      const m = await import('@lumieducation/h5p-server');
      return { jumlahEkspor: Object.keys(m).length };
    }),
  );

  hasil.push(
    await coba('impor src/lib/h5p', async () => {
      const m = await import('@/lib/h5p');
      return { jumlahEkspor: Object.keys(m).length };
    }),
  );

  hasil.push(
    await coba('siapkan mesin H5P', async () => {
      const { getH5P } = await import('@/lib/h5p');
      const mesin = getH5P();
      return { siap: Boolean(mesin.ajax && mesin.player) };
    }),
  );

  return Response.json(
    { waktu: new Date().toISOString(), hasil },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  );
}
