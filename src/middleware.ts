import { NextResponse, type NextRequest } from 'next/server';
import { NAMA_COOKIE_GURU } from '@/lib/nama-cookie';

/**
 * Menjaga /admin/*. Di sini hanya keberadaan cookie yang diperiksa — tanda
 * tangannya diperiksa di halaman dan rute lewat penyelenggaraSekarang(),
 * karena middleware Next berjalan di runtime edge tanpa akses basis data.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.get(NAMA_COOKIE_GURU)) return NextResponse.next();

  const tujuan = new URL('/admin/login', req.url);
  tujuan.searchParams.set('lanjut', req.nextUrl.pathname);
  return NextResponse.redirect(tujuan);
}

export const config = {
  matcher: ['/admin/((?!login).*)'],
};
