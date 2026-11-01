import type { IPlayerModel } from '@lumieducation/h5p-server';
import { getH5P } from '@/lib/h5p';
import { periksaAksesH5P } from '@/lib/h5p-access';

/**
 * Halaman pemutar H5P utuh, untuk ditanam sebagai iframe.
 *
 * Renderer bawaan h5p-server memancarkan dokumen HTML lengkap, jadi menanamnya
 * ke dalam pohon React berarti menulis ulang renderer itu. Iframe juga menjaga
 * jQuery dan variabel global H5P tetap di luar halaman Next.
 */
function halamanPemutar(model: IPlayerModel): string {
  const gaya = model.styles
    .map((s) => `<link rel="stylesheet" href="${s}">`)
    .join('\n    ');
  const skrip = model.scripts.map((s) => `<script src="${s}"></script>`).join('\n    ');

  return `<!doctype html>
<html class="h5p-iframe" lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${model.integration.contents?.[`cid-${model.contentId}`]?.title ?? 'Konten'}</title>
  ${gaya}
  ${skrip}
  <script>
    window.H5PIntegration = ${JSON.stringify(model.integration)};
  </script>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; }
  </style>
</head>
<body>
  <div class="h5p-content" data-content-id="${model.contentId}"></div>
  <script src="/penangkap-xapi.js"></script>
</body>
</html>`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const { contentId } = await params;

  const akses = await periksaAksesH5P(req, contentId);
  if (!akses) {
    return new Response('Konten ini hanya untuk peserta sesi yang sedang terbuka.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const { player } = getH5P();
  player.setRenderer((model) => halamanPemutar(model));

  try {
    const html = (await player.render(
      contentId,
      {
        id: akses.jenis === 'peserta' ? `peserta-${akses.participantId}` : 'penyelenggara',
        name: 'Pemain',
        email: 'pemain@lokal',
        type: 'local',
      },
      'id',
      {
        showFrame: false,
        showCopyButton: false,
        showDownloadButton: false,
        showEmbedButton: false,
        showLicenseButton: false,
        showH5PIcon: false,
      },
    )) as string;

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : 'Konten gagal dimuat.';
    return new Response(`Konten gagal dimuat: ${pesan}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
