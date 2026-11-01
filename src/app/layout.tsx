import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sesi H5P',
  description: 'Jalankan konten H5P lewat PIN dan lihat peringkatnya.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="mx-auto max-w-3xl px-4 py-6">{children}</body>
    </html>
  );
}
