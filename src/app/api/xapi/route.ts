import { cookieDariRequest } from '@/lib/auth';
import { NAMA_COOKIE_PESERTA } from '@/lib/nama-cookie';
import { pesertaDariToken } from '@/lib/participant';
import { catatPernyataan } from '@/lib/repo/xapi';

/**
 * Menerima pernyataan xAPI dari pemutar H5P.
 *
 * Yang diterima hanyalah pernyataannya; nilai dan durasi ditentukan server
 * (§5.6), jadi angka apa pun di badan permintaan selain `statement` diabaikan.
 *
 * Pernyataan dari peserta sesi yang sudah ditutup tetap diterima: ia sudah
 * masuk secara sah di dalam jendela waktu, dan memutusnya di tengah pekerjaan
 * melanggar anti-tujuan §2. Yang dikunci saat penutupan adalah pintu masuknya.
 */
export async function POST(req: Request) {
  const peserta = await pesertaDariToken(
    cookieDariRequest(req, NAMA_COOKIE_PESERTA),
  );
  if (!peserta) {
    return Response.json(
      { error: 'Tidak dikenali sebagai peserta sesi mana pun.' },
      { status: 401 },
    );
  }

  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return Response.json({ error: 'Badan permintaan bukan JSON.' }, { status: 400 });
  }

  const statement = (badan as { statement?: unknown } | null)?.statement;
  if (statement === undefined || statement === null) {
    return Response.json({ error: 'Pernyataan xAPI tidak ada.' }, { status: 400 });
  }

  try {
    const hasil = await catatPernyataan(peserta.id, statement);
    return Response.json({ ok: true, berskor: hasil.berskor });
  } catch {
    // Jangan biarkan galat basis data lolos sebagai 500 tanpa bentuk: pemutar
    // akan mengulang kiriman lewat sendBeacon dan tidak ada yang tahu sebabnya.
    return Response.json(
      { ok: false, error: 'Nilai gagal dicatat.' },
      { status: 500 },
    );
  }
}
