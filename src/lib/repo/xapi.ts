import { pool } from '@/lib/db';
import { pilihNilaiResmi, type Pernyataan } from '@/lib/scoring';
import { tandaiScoring } from '@/lib/repo/contents';

/**
 * Menyimpan satu pernyataan xAPI lalu menghitung ulang nilai resmi peserta
 * dari SELURUH pernyataannya.
 *
 * Dihitung ulang, bukan ditambal, karena aturannya (utamakan `completed`
 * terakhir, kalau tidak ada ambil `score.max` terbesar) bergantung pada
 * kumpulannya. Aturannya hidup di src/lib/scoring.ts dan tidak disalin ke SQL.
 *
 * Seluruhnya dalam satu transaksi dengan baris peserta dikunci lebih dulu:
 * konten beruntun seperti Interactive Video mengirim beberapa pernyataan nyaris
 * bersamaan, dan tanpa kunci itu pembaca yang lebih awal bisa menimpa hasil
 * yang lebih benar — peserta lalu diperingkat dengan nilai separuh.
 */
export async function catatPernyataan(
  participantId: number,
  statement: unknown,
): Promise<{ berskor: boolean }> {
  const klien = await pool.connect();

  try {
    await klien.query('begin');

    // Kunci dulu, supaya dua pernyataan yang datang bersamaan diproses berurutan.
    const terkunci = await klien.query<{ id: number }>(
      'select id from participants where id = $1 for update',
      [participantId],
    );
    if (terkunci.rows.length === 0) {
      await klien.query('rollback');
      return { berskor: false };
    }

    await klien.query(
      'insert into xapi_events (participant_id, statement) values ($1, $2::jsonb)',
      [participantId, JSON.stringify(statement)],
    );

    const semua = await klien.query<{ statement: unknown; received_at: Date }>(
      'select statement, received_at from xapi_events where participant_id = $1 order by received_at, id',
      [participantId],
    );

    const nilai = pilihNilaiResmi(semua.rows as Pernyataan[]);
    if (!nilai) {
      await klien.query('commit');
      return { berskor: false };
    }

    await klien.query(
      `update participants
          set score_raw = $2, score_max = $3, finished_at = $4
        where id = $1`,
      [participantId, nilai.score_raw, nilai.score_max, nilai.finished_at],
    );

    const konten = await klien.query<{ content_id: number }>(
      `select s.content_id
         from participants p
         join quiz_sessions s on s.id = p.session_id
        where p.id = $1`,
      [participantId],
    );

    await klien.query('commit');

    if (konten.rows[0]) await tandaiScoring(konten.rows[0].content_id, 'scored');

    return { berskor: true };
  } catch (e) {
    await klien.query('rollback').catch(() => {});
    throw e;
  } finally {
    klien.release();
  }
}

export async function pernyataanPeserta(participantId: number): Promise<Pernyataan[]> {
  const { rows } = await pool.query(
    'select statement, received_at from xapi_events where participant_id = $1 order by received_at, id',
    [participantId],
  );
  return rows as Pernyataan[];
}
