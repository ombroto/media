'use server';

import { redirect } from 'next/navigation';
import { simpanTokenPeserta } from '@/lib/peserta-cookie';
import { mulaiPeserta, periksaPin } from '@/lib/repo/participants';

export type KeadaanNama = { galat?: string };

export async function aksiMulai(
  _sebelumnya: KeadaanNama,
  data: FormData,
): Promise<KeadaanNama> {
  const pin = String(data.get('pin') ?? '');
  const nama = String(data.get('nama') ?? '');

  const sesi = await periksaPin(pin);
  if (!sesi.ok) {
    return {
      galat:
        sesi.alasan === 'sudah_ditutup'
          ? 'Sesi ini sudah ditutup.'
          : sesi.alasan === 'belum_dibuka'
            ? 'Sesi ini belum dibuka.'
            : 'PIN tidak berlaku lagi.',
    };
  }

  const hasil = await mulaiPeserta(sesi.sesi.id, nama);

  if (!hasil.ok) {
    if (hasil.alasan === 'nama_terpakai') {
      return {
        galat: `"${nama.trim()}" sudah dipakai di sesi ini. Pakai nama lain.`,
      };
    }
    if (hasil.alasan === 'nama_tidak_sah') {
      return { galat: 'Isi nama dulu, maksimal 40 karakter.' };
    }
    return { galat: 'Sesi ini sudah tidak menerima peserta baru.' };
  }

  await simpanTokenPeserta(hasil.token);
  redirect('/play');
}
