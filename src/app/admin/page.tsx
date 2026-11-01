import { redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { aksiKeluar } from './login/actions';

export default async function HalamanAdmin() {
  const guru = await penyelenggaraSekarang();
  if (!guru) redirect('/admin/login?lanjut=/admin');

  return (
    <main className="space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Sesi</h1>
        <form action={aksiKeluar}>
          <button type="submit" className="text-sm underline opacity-70">
            keluar
          </button>
        </form>
      </header>

      <p className="text-sm opacity-70">Masuk sebagai {guru.name}.</p>
      <p className="text-sm opacity-70">Daftar sesi menyusul di Tugas 7.</p>
    </main>
  );
}
