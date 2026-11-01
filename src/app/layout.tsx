import type { Metadata } from 'next';
import { Archivo, Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sesi H5P',
  description: 'Jalankan konten H5P lewat PIN dan lihat peringkatnya.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${archivo.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <header className="bg-gelap text-white">
          <div className="wadah flex items-center justify-between gap-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded bg-oranye font-judul text-sm font-extrabold"
              >
                H
              </span>
              <span className="font-judul text-lg font-bold tracking-tight">Sesi H5P</span>
            </Link>

            <Link
              href="/admin"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70 hover:text-white"
            >
              Penyelenggara
            </Link>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="bg-tinta text-white/70">
          <div className="wadah flex flex-wrap items-center justify-between gap-3 py-6 text-xs">
            <p>
              <span className="font-judul font-bold text-white">Sesi H5P</span> — konten
              interaktif lewat PIN.
            </p>
            <p>Peserta cukup PIN dan nama. Tanpa akun.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
