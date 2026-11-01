import { createHash, randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import type { Scoring } from '@/lib/repo/contents';

/**
 * Token peserta. Nilainya acak dan hanya hash-nya yang disimpan, supaya
 * basis data yang terbaca orang lain tidak langsung memberi akses ke sesi
 * siapa pun.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function buatToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}

export type PesertaLengkap = {
  id: number;
  session_id: number;
  alias: string;
  started_at: Date;
  finished_at: Date | null;
  score_raw: number | null;
  score_max: number | null;
  /* dari sesinya */
  session_title: string;
  opens_at: Date;
  closes_at: Date;
  closed_early_at: Date | null;
  /* dari kontennya */
  content_id: number;
  h5p_content_id: string;
  content_title: string;
  scoring: Scoring;
};

export async function pesertaDariToken(
  token: string | undefined | null,
): Promise<PesertaLengkap | null> {
  if (!token) return null;

  const [baris] = await query<PesertaLengkap>(
    `select p.id, p.session_id, p.alias, p.started_at, p.finished_at,
            p.score_raw, p.score_max,
            s.title as session_title, s.opens_at, s.closes_at, s.closed_early_at,
            c.id as content_id, c.h5p_content_id, c.title as content_title, c.scoring
       from participants p
       join quiz_sessions s on s.id = p.session_id
       join contents c on c.id = s.content_id
      where p.token_hash = $1`,
    [hashToken(token)],
  );

  return baris ?? null;
}
