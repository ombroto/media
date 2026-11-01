import FormLogin from './FormLogin';

export const metadata = { title: 'Masuk — Sesi H5P' };

export default async function HalamanLogin({
  searchParams,
}: {
  searchParams: Promise<{ lanjut?: string }>;
}) {
  const { lanjut } = await searchParams;

  return (
    <main className="mx-auto max-w-sm space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Masuk</h1>
        <p className="text-sm opacity-70">
          Halaman ini untuk penyelenggara. Peserta tidak perlu akun — cukup PIN.
        </p>
      </header>

      <FormLogin lanjut={lanjut ?? '/admin'} />
    </main>
  );
}
