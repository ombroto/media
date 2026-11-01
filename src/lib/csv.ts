import type { BarisTerperingkat } from '@/lib/ranking';

const KEPALA = ['peringkat', 'nama', 'skor', 'maksimum', 'durasi_detik', 'selesai_pada'];

/** Mengutip sel sesuai RFC 4180, hanya kalau perlu. */
function sel(nilai: string): string {
  return /[",\r\n]/.test(nilai) ? `"${nilai.replace(/"/g, '""')}"` : nilai;
}

function waktuIso(d: Date): string {
  return d.toISOString();
}

/**
 * Hasil sesi sebagai CSV.
 *
 * Diawali BOM UTF-8 supaya Excel di Windows membaca huruf beraksen dengan
 * benar, dan dipisah CRLF sesuai RFC 4180.
 */
export function buatCsvHasil(baris: BarisTerperingkat[]): string {
  const garis = [KEPALA.join(',')];

  for (const b of baris) {
    garis.push(
      [
        String(b.peringkat),
        sel(b.alias),
        String(b.score_raw),
        String(b.score_max),
        String(Math.round(b.durasi_ms / 1000)),
        waktuIso(b.finished_at),
      ].join(','),
    );
  }

  return `﻿${garis.join('\r\n')}\r\n`;
}

/** Nama berkas yang aman di Windows. */
export function namaBerkasCsv(judulSesi: string, pin: string): string {
  const aman = judulSesi
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 60)
    .replace(/\s+/g, '-');
  return `hasil-${aman || 'sesi'}-${pin}.csv`;
}
