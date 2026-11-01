import type { BarisTerperingkat } from '@/lib/ranking';

const KEPALA = ['peringkat', 'nama', 'skor', 'maksimum', 'durasi_detik', 'selesai_pada'];

/**
 * Pemisah titik koma, bukan koma: Excel di Windows ber-locale Indonesia memakai
 * titik koma sebagai pemisah daftar, dan CSV berkoma akan terbuka menumpuk di
 * satu kolom (§7.6 menuntut pemisah yang aman dibuka Excel Indonesia).
 */
const PEMISAH = ';';

/** Mengutip sel sesuai RFC 4180, hanya kalau perlu. */
function kutip(nilai: string): string {
  return /[";,\r\n]/.test(nilai) ? `"${nilai.replace(/"/g, '""')}"` : nilai;
}

/**
 * Menetralkan sel yang akan dibaca Excel sebagai rumus. Nama peserta datang
 * dari orang lain, dan `=HYPERLINK(...)` sebagai nama akan jadi rumus hidup di
 * berkas yang dibuka penyelenggara.
 */
function netral(nilai: string): string {
  return /^[=+\-@]/.test(nilai) ? `'${nilai}` : nilai;
}

function sel(nilai: string): string {
  return kutip(netral(nilai));
}

/** Waktu lokal, sama dengan yang dibaca penyelenggara di halaman pantau. */
function waktuLokal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    ` ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/**
 * Hasil sesi sebagai CSV, diawali BOM UTF-8 supaya Excel di Windows membaca
 * huruf beraksen dengan benar, dan dipisah CRLF sesuai RFC 4180.
 */
export function buatCsvHasil(baris: BarisTerperingkat[]): string {
  const garis = [KEPALA.join(PEMISAH)];

  for (const b of baris) {
    garis.push(
      [
        String(b.peringkat),
        sel(b.alias),
        String(b.score_raw),
        String(b.score_max),
        String(Math.round(b.durasi_ms / 1000)),
        waktuLokal(b.finished_at),
      ].join(PEMISAH),
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
