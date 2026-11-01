import { query } from '@/lib/db';
import { pinSah } from '@/lib/pin';
import type { Scoring } from '@/lib/repo/contents';
import { statusSesi, type StatusSesi } from '@/lib/session-status';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

export type Sesi = {
  id: number;
  owner_id: number;
  content_id: number;
  title: string;
  pin: string;
  opens_at: Date;
  closes_at: Date;
  closed_early_at: Date | null;
  created_at: Date;
};

export type BarisDaftarSesi = Sesi & {
  status: StatusSesi;
  judul_konten: string;
  h5p_content_id: string;
  scoring: Scoring;
  jumlah_ikut: number;
  jumlah_selesai: number;
};

export type DataSesi = {
  contentId: number;
  title: string;
  pin: string;
  opensAt: Date;
  closesAt: Date;
};

function periksa(d: {
  title: string;
  pin: string;
  opensAt: Date;
  closesAt: Date;
}): string | null {
  if (d.title.trim().length === 0) return 'Judul sesi tidak boleh kosong.';
  if (!pinSah(d.pin)) return 'PIN harus enam angka.';
  if (!(d.closesAt > d.opensAt)) {
    return 'Tanggal tutup harus setelah tanggal buka.';
  }
  return null;
}

/** Menerjemahkan pelanggaran batasan Postgres menjadi pesan untuk pemakai. */
function pesanDariGalat(e: unknown): string | null {
  const kode = (e as { code?: string })?.code;
  if (kode === UNIQUE_VIOLATION) {
    return 'PIN itu sudah dipakai sesi lain. Pilih PIN lain.';
  }
  if (kode === CHECK_VIOLATION) {
    return 'Tanggal atau PIN tidak sah.';
  }
  return null;
}

export async function buatSesi(
  ownerId: number,
  d: DataSesi,
): Promise<{ ok: true; sesi: Sesi } | { ok: false; pesan: string }> {
  const salah = periksa(d);
  if (salah) return { ok: false, pesan: salah };

  try {
    const [sesi] = await query<Sesi>(
      `insert into quiz_sessions (owner_id, content_id, title, pin, opens_at, closes_at)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [ownerId, d.contentId, d.title.trim(), d.pin, d.opensAt, d.closesAt],
    );
    return { ok: true, sesi };
  } catch (e) {
    const pesan = pesanDariGalat(e);
    if (pesan) return { ok: false, pesan };
    throw e;
  }
}

export async function ubahSesi(
  id: number,
  d: Omit<DataSesi, 'contentId'>,
): Promise<{ ok: true } | { ok: false; pesan: string }> {
  const salah = periksa(d);
  if (salah) return { ok: false, pesan: salah };

  try {
    await query(
      `update quiz_sessions
          set title = $2, pin = $3, opens_at = $4, closes_at = $5
        where id = $1`,
      [id, d.title.trim(), d.pin, d.opensAt, d.closesAt],
    );
    return { ok: true };
  } catch (e) {
    const pesan = pesanDariGalat(e);
    if (pesan) return { ok: false, pesan };
    throw e;
  }
}

export async function ambilSesi(id: number): Promise<Sesi | null> {
  const [sesi] = await query<Sesi>('select * from quiz_sessions where id = $1', [id]);
  return sesi ?? null;
}

export async function ambilSesiDariPin(pin: string): Promise<Sesi | null> {
  const bersih = pin.trim();
  if (!pinSah(bersih)) return null;

  const [sesi] = await query<Sesi>('select * from quiz_sessions where pin = $1', [bersih]);
  return sesi ?? null;
}

export async function daftarSesi(ownerId: number): Promise<BarisDaftarSesi[]> {
  const baris = await query<Omit<BarisDaftarSesi, 'status'>>(
    `select s.*,
            c.title           as judul_konten,
            c.h5p_content_id  as h5p_content_id,
            c.scoring         as scoring,
            count(p.id)::int                                         as jumlah_ikut,
            count(p.id) filter (where p.finished_at is not null)::int as jumlah_selesai
       from quiz_sessions s
       join contents c on c.id = s.content_id
       left join participants p on p.session_id = s.id
      where s.owner_id = $1
      group by s.id, c.title, c.h5p_content_id, c.scoring
      order by s.created_at desc, s.id desc`,
    [ownerId],
  );

  const sekarang = new Date();
  return baris.map((b) => ({ ...b, status: statusSesi(b, sekarang) }));
}

export async function tutupSekarang(id: number): Promise<void> {
  await query(
    `update quiz_sessions set closed_early_at = now()
      where id = $1 and closed_early_at is null`,
    [id],
  );
}

export async function hapusSesi(id: number): Promise<void> {
  await query('delete from quiz_sessions where id = $1', [id]);
}

export async function jumlahPeserta(sessionId: number): Promise<number> {
  const [baris] = await query<{ n: number }>(
    'select count(*)::int as n from participants where session_id = $1',
    [sessionId],
  );
  return baris?.n ?? 0;
}
