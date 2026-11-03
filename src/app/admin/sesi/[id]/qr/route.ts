import QRCode from 'qrcode';
import { penyelenggaraDariRequest } from '@/lib/auth';
import { namaBerkasAman } from '@/lib/nama-berkas';
import { ambilSesi } from '@/lib/repo/sessions';

/**
 * Kode QR berisi tautan masuk sesi, sebagai PNG.
 *
 * Dibuat di server, bukan di peramban: hasilnya satu berkas yang bisa langsung
 * diunduh, ditempel ke slide, atau dicetak — tanpa menambah pustaka ke bundel
 * sisi klien.
 *
 * Alamat dasarnya diambil dari header permintaan. Server tidak tahu nama
 * domain publiknya sendiri, dan di Vercel permintaannya lewat proksi, jadi
 * x-forwarded-* yang dipakai lebih dulu.
 */
function alamatDasar(req: Request): string {
  const h = req.headers;
  const inang = h.get('x-forwarded-host') ?? h.get('host');
  const protokol = h.get('x-forwarded-proto') ?? (inang?.startsWith('localhost') ? 'http' : 'https');
  return `${protokol}://${inang}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guru = await penyelenggaraDariRequest(req);
  if (!guru) return new Response('Tidak berwenang.', { status: 403 });

  const { id } = await params;
  const sesiId = Number(id);
  if (!Number.isInteger(sesiId)) return new Response('Nomor sesi tidak sah.', { status: 400 });

  const sesi = await ambilSesi(sesiId);
  if (!sesi || sesi.owner_id !== guru.id) {
    return new Response('Sesi tidak ditemukan.', { status: 404 });
  }

  const tautan = `${alamatDasar(req)}/j/${sesi.pin}`;
  const unduh = new URL(req.url).searchParams.get('unduh') === '1';

  const png = await QRCode.toBuffer(tautan, {
    type: 'png',
    width: 720,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#1b1a18', light: '#ffffff' },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'content-length': String(png.byteLength),
      'cache-control': 'private, max-age=300',
      ...(unduh
        ? {
            'content-disposition': `attachment; filename="${namaBerkasAman(
              `qr-${sesi.title}-${sesi.pin}`,
            )}.png"`,
          }
        : {}),
    },
  });
}
