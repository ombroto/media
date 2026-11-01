'use server';

import { redirect } from 'next/navigation';
import { masuk } from '@/lib/auth';
import { buatSesiPenyelenggara, keluar } from '@/lib/auth-cookie';

export type KeadaanLogin = { galat?: string };

export async function aksiMasuk(
  _sebelumnya: KeadaanLogin,
  data: FormData,
): Promise<KeadaanLogin> {
  const email = String(data.get('email') ?? '');
  const kataSandi = String(data.get('kataSandi') ?? '');
  const lanjut = String(data.get('lanjut') ?? '/admin');

  if (!email || !kataSandi) {
    return { galat: 'Email dan kata sandi harus diisi.' };
  }

  const hasil = await masuk(email, kataSandi);
  if (!hasil.ok) {
    // Satu pesan untuk kedua kemungkinan, supaya halaman ini tidak bisa
    // dipakai memeriksa siapa yang punya akun.
    return { galat: 'Email atau kata sandi salah.' };
  }

  await buatSesiPenyelenggara(hasil.teacherId);
  redirect(lanjut.startsWith('/admin') ? lanjut : '/admin');
}

export async function aksiKeluar(): Promise<void> {
  await keluar();
  redirect('/admin/login');
}
