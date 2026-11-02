import { query } from '@/lib/db';

export type Scoring = 'scored' | 'unscored' | 'unknown';

export type Konten = {
  id: number;
  owner_id: number;
  title: string;
  main_library: string;
  h5p_content_id: string;
  scoring: Scoring;
  source_filename: string;
  created_at: Date;
};

/**
 * Tipe konten yang memang tidak pernah mengirim skor. Sesi dari konten seperti
 * ini tetap boleh dibuat, tapi tanpa papan peringkat (§5.5).
 *
 * Daftar ini hanya berisi tipe yang sudah diperiksa isinya — tidak punya
 * getScore/getMaxScore/getXAPIData maupun setScoredResult. H5P.MemoryGame
 * sempat ada di sini dan itu keliru: ia mengimplementasikan ketiganya.
 * Kalau ragu, biarkan 'unknown'; penyelenggara bisa menandainya sendiri dari
 * halaman pustaka konten.
 */
const TAK_BERSKOR = new Set([
  'H5P.Dialogcards',
  'H5P.DialogCards',
  'H5P.AdvancedText',
  'H5P.Image',
  'H5P.Audio',
  'H5P.Video',
  'H5P.Collage',
  'H5P.Timeline',
  'H5P.Accordion',
  'H5P.Table',
  'H5P.IFrameEmbed',
  'H5P.ImageHotspots',
  'H5P.Link',
  'H5P.Column',
]);

export function scoringAwal(mainLibrary: string): Scoring {
  return TAK_BERSKOR.has(mainLibrary) ? 'unscored' : 'unknown';
}

export async function simpanKonten(
  ownerId: number,
  k: {
    title: string;
    mainLibrary: string;
    h5pContentId: string;
    sourceFilename: string;
  },
): Promise<Konten> {
  const [baris] = await query<Konten>(
    `insert into contents (owner_id, title, main_library, h5p_content_id, source_filename, scoring)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      ownerId,
      k.title,
      k.mainLibrary,
      k.h5pContentId,
      k.sourceFilename,
      scoringAwal(k.mainLibrary),
    ],
  );
  return baris;
}

export async function daftarKonten(
  ownerId: number,
): Promise<(Konten & { jumlah_sesi: number })[]> {
  return query<Konten & { jumlah_sesi: number }>(
    `select c.*, count(s.id)::int as jumlah_sesi
       from contents c
       left join quiz_sessions s on s.content_id = c.id
      where c.owner_id = $1
      group by c.id
      order by c.created_at desc, c.id desc`,
    [ownerId],
  );
}

export async function ambilKonten(contentId: number): Promise<Konten | null> {
  const [baris] = await query<Konten>('select * from contents where id = $1', [contentId]);
  return baris ?? null;
}

/**
 * Menandai apakah konten memberi skor. Sekali `scored`, tidak diturunkan lagi —
 * satu pernyataan xAPI berskor sudah membuktikan konten itu memberi nilai,
 * sementara ketiadaan pernyataan tidak membuktikan sebaliknya.
 */
export async function tandaiScoring(
  contentId: number,
  scoring: 'scored' | 'unscored',
): Promise<void> {
  if (scoring === 'scored') {
    await query(`update contents set scoring = 'scored' where id = $1`, [contentId]);
    return;
  }
  await query(
    `update contents set scoring = 'unscored' where id = $1 and scoring <> 'scored'`,
    [contentId],
  );
}
