import FormLogin from './FormLogin';

export const metadata = { title: 'Masuk — Sesi H5P' };

export default async function HalamanLogin({
  searchParams,
}: {
  searchParams: Promise<{ lanjut?: string }>;
}) {
  const { lanjut } = await searchParams;

  return (
    <main className="pita">
      <div className="wadah-sempit max-w-sm space-y-6">
        <header className="space-y-2">
          <span className="kerlip">Penyelenggara</span>
          <h1 className="text-2xl">Masuk</h1>
          <p className="text-sm text-abu">
            Halaman ini untuk penyelenggara. Peserta tidak perlu akun — cukup PIN.
          </p>
        </header>

        <div className="kartu p-6">
          <FormLogin lanjut={lanjut ?? '/admin'} />
        </div>
      </div>
    </main>
  );
}
