import type { IPlayerModel, IUser } from '@lumieducation/h5p-server';
import { getH5P } from '@/lib/h5p';
import { periksaAksesH5P } from '@/lib/h5p-access';

/**
 * Mematikan tombol bawaan H5P (Check, Show solution, Retry) lewat parameter
 * konten.
 *
 * Di situs ini peserta hanya punya satu kali kesempatan dan satu tombol kirim,
 * jadi "coba lagi" dan "lihat jawaban" tidak pada tempatnya. Tidak semua tipe
 * konten menyediakan ketiga saklar ini — Crossword, misalnya, tidak punya
 * enableCheckButton — karena itu CSS di halaman pemutar menutup sisanya.
 */
function matikanTombolBawaan(nilai: unknown, kedalaman = 0): void {
  if (kedalaman > 12 || typeof nilai !== 'object' || nilai === null) return;

  if (Array.isArray(nilai)) {
    for (const isi of nilai) matikanTombolBawaan(isi, kedalaman + 1);
    return;
  }

  const obj = nilai as Record<string, unknown>;

  for (const [kunci, isi] of Object.entries(obj)) {
    if (
      (kunci === 'behaviour' || kunci === 'override') &&
      typeof isi === 'object' &&
      isi !== null &&
      !Array.isArray(isi)
    ) {
      const perilaku = isi as Record<string, unknown>;
      perilaku.enableCheckButton = false;
      perilaku.enableRetry = false;
      perilaku.enableSolutionsButton = false;
      perilaku.showSolutionButton = 'off';
      perilaku.retryButton = 'off';
    }
    matikanTombolBawaan(isi, kedalaman + 1);
  }
}

/**
 * Halaman pemutar H5P utuh, untuk ditanam sebagai iframe.
 *
 * Renderer bawaan h5p-server memancarkan dokumen HTML lengkap, jadi menanamnya
 * ke dalam pohon React berarti menulis ulang renderer itu. Iframe juga menjaga
 * jQuery dan variabel global H5P tetap di luar halaman Next.
 */
function halamanPemutar(model: IPlayerModel, peserta: boolean): string {
  const gaya = model.styles.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n    ');
  const skrip = model.scripts.map((s) => `<script src="${s}"></script>`).join('\n    ');

  const bilahKirim = peserta
    ? `
  <div class="bilah-kirim">
    <p class="bilah-ket" id="ket-kirim">Sudah selesai mengerjakan? Kirim jawabanmu.</p>
    <button type="button" id="tombol-kirim">Kirim jawaban</button>
  </div>
  <script src="/kirim-jawaban.js"></script>`
    : `
  <div class="bilah-kirim">
    <p class="bilah-ket">Pratinjau penyelenggara — jawaban dari sini tidak dicatat.</p>
  </div>`;

  return `<!doctype html>
<html class="h5p-iframe" lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Konten interaktif</title>
  ${gaya}
  ${skrip}
  <script>
    window.H5PIntegration = ${JSON.stringify(model.integration)};
  </script>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; }

    /* Tombol bawaan H5P ditutup: peserta hanya punya satu tombol kirim. */
    .h5p-question-check-answer,
    .h5p-question-show-solution,
    .h5p-question-try-again,
    .h5p-question-buttons { display: none !important; }

    .bilah-kirim {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: .75rem;
      margin-top: 1rem;
      padding: 1rem;
      border-top: 1px solid #e3ded6;
      font-family: "Segoe UI", system-ui, sans-serif;
    }
    .bilah-ket { margin: 0; font-size: .875rem; color: #6f6a63; }
    #tombol-kirim {
      border: 0;
      border-radius: .3rem;
      background: #ef5a27;
      color: #fff;
      font-size: .95rem;
      font-weight: 600;
      padding: .7rem 1.4rem;
      cursor: pointer;
    }
    #tombol-kirim:hover { background: #d4491b; }
    #tombol-kirim:disabled { opacity: .6; cursor: default; }
  </style>
</head>
<body>
  <div class="h5p-content" data-content-id="${model.contentId}"></div>
  <script src="/jembatan-tinggi.js"></script>${bilahKirim}
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

  const peserta = akses.jenis === 'peserta';
  const pengguna: IUser = {
    id: peserta ? `peserta-${akses.participantId}` : 'penyelenggara',
    name: 'Pemain',
    email: 'pemain@lokal',
    type: 'local',
  };

  let player;
  let ajax;
  try {
    ({ player, ajax } = getH5P());
  } catch (e) {
    return new Response(
      `Mesin H5P gagal disiapkan: ${e instanceof Error ? e.message : e}`,
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  player.setRenderer((model) => halamanPemutar(model, peserta));

  try {
    const isi = await ajax.getContentParameters(contentId, pengguna);
    const parameter = isi.params.params;
    matikanTombolBawaan(parameter);

    const html = (await player.render(contentId, pengguna, 'id', {
      parametersOverride: parameter,
      showFrame: false,
      showCopyButton: false,
      showDownloadButton: false,
      showEmbedButton: false,
      showLicenseButton: false,
      showH5PIcon: false,
    })) as string;

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
