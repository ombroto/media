/** Pemformatan waktu untuk antarmuka, dalam zona waktu lokal server. */

const TANGGAL = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const TANGGAL_SINGKAT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
});

export function waktuPanjang(d: Date): string {
  return TANGGAL.format(d);
}

export function waktuSingkat(d: Date): string {
  return TANGGAL_SINGKAT.format(d);
}

export function jendela(buka: Date, tutup: Date): string {
  return `${waktuSingkat(buka)} – ${waktuSingkat(tutup)}`;
}

/** Nilai untuk <input type="datetime-local">, yang menuntut waktu lokal. */
export function untukInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function durasiSingkat(ms: number): string {
  const detik = Math.max(0, Math.round(ms / 1000));
  const menit = Math.floor(detik / 60);
  return `${menit}:${String(detik % 60).padStart(2, '0')}`;
}
