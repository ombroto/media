import { getH5P, H5P_USER_PENYELENGGARA } from '@/lib/h5p';
import { penyelenggaraDariRequest } from '@/lib/auth';

/**
 * Jembatan ke H5PAjaxEndpoint. Situs ini tidak punya editor, jadi yang terpakai
 * praktis hanya permintaan dari pemutar; tetap dijaga supaya hanya penyelenggara
 * yang bisa memanggilnya.
 */
export async function GET(req: Request) {
  const guru = await penyelenggaraDariRequest(req);
  if (!guru) return Response.json({ error: 'Tidak berwenang.' }, { status: 403 });

  const url = new URL(req.url);
  let ajax;
  try {
    ajax = getH5P().ajax;
  } catch (e) {
    return Response.json(
      { error: `Mesin H5P gagal disiapkan: ${e instanceof Error ? e.message : e}` },
      { status: 500 },
    );
  }


  try {
    const hasil = await ajax.getAjax(
      url.searchParams.get('action') ?? '',
      url.searchParams.get('machineName') ?? undefined,
      url.searchParams.get('majorVersion') ?? undefined,
      url.searchParams.get('minorVersion') ?? undefined,
      url.searchParams.get('language') ?? 'id',
      H5P_USER_PENYELENGGARA,
    );
    return Response.json(hasil);
  } catch (e) {
    const pesan = e instanceof Error ? e.message : 'Permintaan gagal.';
    return Response.json({ error: pesan }, { status: 400 });
  }
}
