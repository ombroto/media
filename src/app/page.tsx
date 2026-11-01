import FormPin from './FormPin';

export const metadata = {
  title: 'Masukkan PIN — Sesi H5P',
  description: 'Masukkan PIN untuk mulai mengerjakan.',
};

export default function Beranda() {
  return (
    <main className="mx-auto max-w-sm space-y-6 py-10">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Masukkan PIN</h1>
        <p className="text-sm opacity-70">
          PIN enam angka dari pengajar Anda.
        </p>
      </header>

      <FormPin />
    </main>
  );
}
