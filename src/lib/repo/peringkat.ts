import { query } from '@/lib/db';
import type { BarisPeringkat } from '@/lib/ranking';

/**
 * Peserta yang diperingkat: hanya yang `finished_at`-nya terisi (§5.6).
 * Pengurutannya tidak dilakukan di SQL — itu tugas urutkanPeringkat, supaya
 * aturan pemecah serinya hanya hidup di satu tempat yang teruji.
 */
export async function peringkatSesi(sessionId: number): Promise<BarisPeringkat[]> {
  return query<BarisPeringkat>(
    `select id, alias, score_raw, score_max, started_at, finished_at
       from participants
      where session_id = $1
        and finished_at is not null
        and score_raw is not null
        and score_max is not null`,
    [sessionId],
  );
}

export type PesertaBelumSelesai = { id: number; alias: string; started_at: Date };

export type RingkasanSesi = {
  jumlah_ikut: number;
  jumlah_selesai: number;
  rata_rata: number | null;
  belum_selesai: PesertaBelumSelesai[];
};

export async function ringkasanSesi(sessionId: number): Promise<RingkasanSesi> {
  const [hitung] = await query<{
    jumlah_ikut: number;
    jumlah_selesai: number;
    rata_rata: string | null;
  }>(
    `select count(*)::int                                          as jumlah_ikut,
            count(*) filter (where finished_at is not null)::int   as jumlah_selesai,
            avg(score_raw) filter (where finished_at is not null)  as rata_rata
       from participants
      where session_id = $1`,
    [sessionId],
  );

  const belum = await query<PesertaBelumSelesai>(
    `select id, alias, started_at
       from participants
      where session_id = $1 and finished_at is null
      order by started_at`,
    [sessionId],
  );

  return {
    jumlah_ikut: hitung?.jumlah_ikut ?? 0,
    jumlah_selesai: hitung?.jumlah_selesai ?? 0,
    rata_rata: hitung?.rata_rata === null || hitung?.rata_rata === undefined
      ? null
      : Number(hitung.rata_rata),
    belum_selesai: belum,
  };
}

export async function pesertaSudahMembuka(
  sessionId: number,
): Promise<{ id: number; alias: string; started_at: Date }[]> {
  return query('select id, alias, started_at from participants where session_id = $1 order by started_at', [
    sessionId,
  ]);
}
