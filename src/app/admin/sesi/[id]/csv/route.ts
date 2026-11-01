import { penyelenggaraDariRequest } from '@/lib/auth';
import { buatCsvHasil, namaBerkasCsv } from '@/lib/csv';
import { urutkanPeringkat } from '@/lib/ranking';
import { peringkatSesi } from '@/lib/repo/peringkat';
import { ambilSesi } from '@/lib/repo/sessions';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guru = await penyelenggaraDariRequest(req);
  if (!guru) {
    return new Response('Tidak berwenang.', { status: 403 });
  }

  const { id } = await params;
  const sesiId = Number(id);
  if (!Number.isInteger(sesiId)) {
    return new Response('Nomor sesi tidak sah.', { status: 400 });
  }

  const sesi = await ambilSesi(sesiId);
  if (!sesi || sesi.owner_id !== guru.id) {
    return new Response('Sesi tidak ditemukan.', { status: 404 });
  }

  const csv = buatCsvHasil(urutkanPeringkat(await peringkatSesi(sesi.id)));

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${namaBerkasCsv(sesi.title, sesi.pin)}"`,
      'cache-control': 'no-store',
    },
  });
}
