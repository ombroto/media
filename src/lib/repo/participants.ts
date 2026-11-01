import { query } from '@/lib/db';
import { buatToken } from '@/lib/participant';
import type { Sesi } from '@/lib/repo/sessions';
import { ambilSesiDariPin } from '@/lib/repo/sessions';
import { bolehMasuk } from '@/lib/session-status';
import { pinSah } from '@/lib/pin';

const UNIQUE_VIOLATION = '23505';
export const PANJANG_NAMA_MAKS = 40;

export type HasilPeriksaPin =
  | { ok: true; sesi: Sesi }
  | {
      ok: false;
      alasan: 'format' | 'tidak_ada' | 'belum_dibuka' | 'sudah_ditutup';
      sesi?: Sesi;
    };

/**
 * Pintu masuk peserta. Alasan penolakan dibedakan supaya pesannya bisa tepat:
 * "PIN-nya belum enam angka" tidak sama dengan "sesinya sudah ditutup".
 */
export async function periksaPin(pin: string): Promise<HasilPeriksaPin> {
  const bersih = pin.trim();
  if (!pinSah(bersih)) return { ok: false, alasan: 'format' };

  const sesi = await ambilSesiDariPin(bersih);
  if (!sesi) return { ok: false, alasan: 'tidak_ada' };

  const boleh = bolehMasuk(sesi, new Date());
  if (!boleh.ok) return { ok: false, alasan: boleh.alasan, sesi };

  return { ok: true, sesi };
}

export type HasilMulai =
  | { ok: true; token: string; participantId: number }
  | { ok: false; alasan: 'nama_terpakai' | 'nama_tidak_sah' | 'sesi_tertutup' };

export function namaSah(alias: string): boolean {
  const bersih = alias.trim();
  if (bersih.length === 0 || bersih.length > PANJANG_NAMA_MAKS) return false;
  // Tolak karakter kendali; sisanya (termasuk huruf beraksen dan emoji) boleh.
  return !/[\u0000-\u001f\u007f]/.test(bersih);
}

/**
 * Mencatat seorang peserta dan membuka percobaannya. `started_at` ditetapkan
 * server, bukan peramban.
 *
 * Keunikan nama ditegakkan indeks unik di basis data, bukan dengan memeriksa
 * dulu lalu menyisipkan: dua permintaan serentak akan lolos pemeriksaan itu
 * dan keduanya masuk.
 */
export async function mulaiPeserta(sessionId: number, alias: string): Promise<HasilMulai> {
  if (!namaSah(alias)) return { ok: false, alasan: 'nama_tidak_sah' };

  const [sesi] = await query<Sesi>('select * from quiz_sessions where id = $1', [sessionId]);
  if (!sesi || !bolehMasuk(sesi, new Date()).ok) {
    return { ok: false, alasan: 'sesi_tertutup' };
  }

  const { token, hash } = buatToken();

  try {
    const [baris] = await query<{ id: number }>(
      `insert into participants (session_id, alias, token_hash)
       values ($1, $2, $3) returning id`,
      [sessionId, alias.trim(), hash],
    );
    return { ok: true, token, participantId: baris.id };
  } catch (e) {
    if ((e as { code?: string })?.code === UNIQUE_VIOLATION) {
      return { ok: false, alasan: 'nama_terpakai' };
    }
    throw e;
  }
}

export async function hapusPeserta(participantId: number): Promise<void> {
  await query('delete from participants where id = $1', [participantId]);
}
