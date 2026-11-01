import pg, { Pool } from 'pg';

// node-postgres membaca int8/bigserial sebagai string demi ketelitian 64-bit.
// Id di aplikasi ini tidak akan mendekati 2^53, dan id bertipe string akan
// membuat seluruh perbandingan id (peringkat, pemilik, sesi) salah tanpa suara,
// jadi dibaca sebagai angka.
pg.types.setTypeParser(20, (v) => Number(v));

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL belum diatur — lihat .env.example');
}

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Mode dev Next.js memuat ulang modul; satu pool dipakai bersama agar
// koneksi tidak menumpuk setiap kali berkas berubah.
export const pool: Pool = globalThis.__pgPool ?? new Pool({ connectionString: url });
globalThis.__pgPool = pool;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const hasil = await pool.query(sql, params as never);
  return hasil.rows as T[];
}
