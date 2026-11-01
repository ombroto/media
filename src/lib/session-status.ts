export type SesiWaktu = {
  opens_at: Date;
  closes_at: Date;
  closed_early_at: Date | null;
};

export type StatusSesi = 'terjadwal' | 'berjalan' | 'selesai';

export type HasilBolehMasuk =
  | { ok: true }
  | { ok: false; alasan: 'belum_dibuka' | 'sudah_ditutup' };

/** Saat sesi benar-benar berakhir: yang lebih awal antara jadwal dan penutupan dini. */
function akhirEfektif(s: SesiWaktu): Date {
  if (s.closed_early_at && s.closed_early_at < s.closes_at) {
    return s.closed_early_at;
  }
  return s.closes_at;
}

export function statusSesi(s: SesiWaktu, sekarang: Date): StatusSesi {
  if (sekarang >= akhirEfektif(s)) return 'selesai';
  if (sekarang < s.opens_at) return 'terjadwal';
  return 'berjalan';
}

export function bolehMasuk(s: SesiWaktu, sekarang: Date): HasilBolehMasuk {
  const status = statusSesi(s, sekarang);
  if (status === 'berjalan') return { ok: true };
  if (status === 'terjadwal') return { ok: false, alasan: 'belum_dibuka' };
  return { ok: false, alasan: 'sudah_ditutup' };
}
