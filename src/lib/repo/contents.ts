import { pool, query } from '@/lib/db';

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

/** Sesi yang memakai sebuah konten — dipakai dialog konfirmasi penghapusan. */
export type SesiRingkas = { id: number; title: string; pin: string; jumlah_ikut: number };

export type KontenDenganSesi = Konten & {
  jumlah_sesi: number;
  sesi: SesiRingkas[];
};

export async function daftarKonten(ownerId: number): Promise<KontenDenganSesi[]> {
  // Sesi disertakan supaya dialog penghapusan bisa menyebut apa saja yang ikut
  // hilang, bukan sekadar jumlahnya.
  return query<KontenDenganSesi>(
    `select c.*,
            count(s.id)::int as jumlah_sesi,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', s.id,
                  'title', s.title,
                  'pin', s.pin,
                  'jumlah_ikut', (select count(*)::int from participants p where p.session_id = s.id)
                )
                order by s.created_at
              ) filter (where s.id is not null),
              '[]'::jsonb
            ) as sesi
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

export type HasilHapusKonten = {
  sesiTerhapus: number;
  pesertaTerhapus: number;
};

/**
 * Menghapus sebuah konten beserta SELURUH sesi yang memakainya.
 *
 * Batasan asing sesi→konten sengaja tidak memakai cascade: menghapus satu sesi
 * tidak boleh menyentuh kontennya (§7.5). Arah sebaliknya dikerjakan di sini,
 * eksplisit dan dalam satu transaksi, supaya tidak ada keadaan setengah jadi —
 * peserta dan pernyataan xAPI-nya ikut terbawa lewat cascade dari sesi.
 */
export async function hapusKonten(contentId: number): Promise<HasilHapusKonten> {
  const klien = await pool.connect();

  try {
    await klien.query('begin');

    const peserta = await klien.query<{ n: number }>(
      `select count(*)::int as n
         from participants p
         join quiz_sessions s on s.id = p.session_id
        where s.content_id = $1`,
      [contentId],
    );

    const sesi = await klien.query('delete from quiz_sessions where content_id = $1', [
      contentId,
    ]);
    await klien.query('delete from contents where id = $1', [contentId]);

    await klien.query('commit');

    return {
      sesiTerhapus: sesi.rowCount ?? 0,
      pesertaTerhapus: peserta.rows[0]?.n ?? 0,
    };
  } catch (e) {
    await klien.query('rollback').catch(() => {});
    throw e;
  } finally {
    klien.release();
  }
}
