import { randomInt } from 'node:crypto';
import { query } from '@/lib/db';

export const POLA_PIN = /^[0-9]{6}$/;

export function pinSah(pin: string): boolean {
  return POLA_PIN.test(pin);
}

/**
 * PIN enam angka yang belum terpakai. Keunikannya tetap ditegakkan indeks unik
 * di basis data; pencarian di sini hanya supaya penyelenggara jarang bertemu
 * tabrakan.
 */
export async function buatPinBaru(): Promise<string> {
  for (let coba = 0; coba < 50; coba++) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const [ada] = await query<{ id: number }>(
      'select id from quiz_sessions where pin = $1',
      [pin],
    );
    if (!ada) return pin;
  }
  throw new Error('Gagal menemukan PIN yang belum terpakai setelah 50 percobaan.');
}
