import { query } from '@/lib/db';
import { pilihNilaiResmi, type Pernyataan } from '@/lib/scoring';
import { tandaiScoring } from '@/lib/repo/contents';

/**
 * Menyimpan satu pernyataan xAPI lalu menghitung ulang nilai resmi peserta
 * dari SELURUH pernyataannya.
 *
 * Dihitung ulang, bukan ditambal, karena aturannya (utamakan `completed`
 * terakhir, kalau tidak ada ambil `score.max` terbesar) bergantung pada
 * kumpulannya. Aturannya hidup di src/lib/scoring.ts dan tidak disalin ke SQL.
 */
export async function catatPernyataan(
  participantId: number,
  statement: unknown,
): Promise<{ berskor: boolean }> {
  await query(
    'insert into xapi_events (participant_id, statement) values ($1, $2::jsonb)',
    [participantId, JSON.stringify(statement)],
  );

  const baris = await query<{ statement: unknown; received_at: Date }>(
    'select statement, received_at from xapi_events where participant_id = $1 order by received_at, id',
    [participantId],
  );

  const nilai = pilihNilaiResmi(baris as Pernyataan[]);
  if (!nilai) return { berskor: false };

  await query(
    `update participants
        set score_raw = $2, score_max = $3, finished_at = $4
      where id = $1`,
    [participantId, nilai.score_raw, nilai.score_max, nilai.finished_at],
  );

  const [konten] = await query<{ content_id: number }>(
    `select s.content_id
       from participants p
       join quiz_sessions s on s.id = p.session_id
      where p.id = $1`,
    [participantId],
  );
  if (konten) await tandaiScoring(konten.content_id, 'scored');

  return { berskor: true };
}

export async function pernyataanPeserta(participantId: number): Promise<Pernyataan[]> {
  return query<Pernyataan>(
    'select statement, received_at from xapi_events where participant_id = $1 order by received_at, id',
    [participantId],
  );
}
