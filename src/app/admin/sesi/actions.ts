'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { penyelenggaraSekarang } from '@/lib/auth-cookie';
import { ambilKonten } from '@/lib/repo/contents';
import {
  ambilSesi,
  buatSesi,
  hapusSesi,
  tutupSekarang,
  ubahSesi,
} from '@/lib/repo/sessions';

export type KeadaanSesi = { galat?: string };

/**
 * Tanggal dari <input type="datetime-local"> datang tanpa zona waktu. Ia
 * dibaca sebagai waktu lokal server, yang untuk pemasangan lokal ini memang
 * zona waktu penyelenggara (Asia/Jakarta).
 */
function tanggalLokal(nilai: unknown): Date | null {
  const teks = String(nilai ?? '').trim();
  if (!teks) return null;
  const d = new Date(teks);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function milikSaya(sesiId: number) {
  const guru = await penyelenggaraSekarang();
  if (!guru) return null;

  const sesi = await ambilSesi(sesiId);
  if (!sesi || sesi.owner_id !== guru.id) return null;

  return { guru, sesi };
}

export async function aksiBuatSesi(
  _sebelumnya: KeadaanSesi,
  data: FormData,
): Promise<KeadaanSesi> {
  const guru = await penyelenggaraSekarang();
  if (!guru) return { galat: 'Sesi Anda sudah berakhir. Masuk lagi.' };

  const contentId = Number(data.get('kontenId'));
  const konten = Number.isInteger(contentId) ? await ambilKonten(contentId) : null;
  if (!konten || konten.owner_id !== guru.id) {
    return { galat: 'Konten tidak ditemukan di pustaka Anda.' };
  }

  const opensAt = tanggalLokal(data.get('dibuka'));
  const closesAt = tanggalLokal(data.get('ditutup'));
  if (!opensAt || !closesAt) {
    return { galat: 'Tanggal buka dan tutup harus diisi.' };
  }

  const hasil = await buatSesi(guru.id, {
    contentId: konten.id,
    title: String(data.get('judul') ?? ''),
    pin: String(data.get('pin') ?? '').trim(),
    opensAt,
    closesAt,
  });

  if (!hasil.ok) return { galat: hasil.pesan };

  revalidatePath('/admin');
  redirect(`/admin/sesi/${hasil.sesi.id}?baru=1`);
}

export async function aksiUbahSesi(
  _sebelumnya: KeadaanSesi,
  data: FormData,
): Promise<KeadaanSesi> {
  const sesiId = Number(data.get('sesiId'));
  const punya = Number.isInteger(sesiId) ? await milikSaya(sesiId) : null;
  if (!punya) return { galat: 'Sesi tidak ditemukan.' };

  const opensAt = tanggalLokal(data.get('dibuka'));
  const closesAt = tanggalLokal(data.get('ditutup'));
  if (!opensAt || !closesAt) {
    return { galat: 'Tanggal buka dan tutup harus diisi.' };
  }

  const hasil = await ubahSesi(sesiId, {
    title: String(data.get('judul') ?? ''),
    pin: String(data.get('pin') ?? '').trim(),
    opensAt,
    closesAt,
  });

  if (!hasil.ok) return { galat: hasil.pesan };

  revalidatePath('/admin');
  revalidatePath(`/admin/sesi/${sesiId}`);
  redirect(`/admin/sesi/${sesiId}`);
}

export async function aksiTutupSekarang(data: FormData): Promise<void> {
  const sesiId = Number(data.get('sesiId'));
  const punya = Number.isInteger(sesiId) ? await milikSaya(sesiId) : null;
  if (!punya) return;

  await tutupSekarang(sesiId);
  revalidatePath('/admin');
  revalidatePath(`/admin/sesi/${sesiId}`);
}

export async function aksiHapusSesi(data: FormData): Promise<void> {
  const sesiId = Number(data.get('sesiId'));
  const punya = Number.isInteger(sesiId) ? await milikSaya(sesiId) : null;
  if (!punya) return;

  // Konfirmasi tertulis: nama sesi harus diketik ulang, karena seluruh nilai
  // pesertanya ikut hilang.
  const ketikan = String(data.get('konfirmasi') ?? '').trim();
  if (ketikan !== punya.sesi.title.trim()) return;

  await hapusSesi(sesiId);
  revalidatePath('/admin');
  redirect('/admin');
}
