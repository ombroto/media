/**
 * Format hash kata sandi, dalam JavaScript biasa supaya bisa dipakai bersama
 * oleh aplikasi (TypeScript) dan oleh scripts/seed-teacher.mjs yang dijalankan
 * Node langsung. Satu salinan format, bukan dua.
 *
 * Bentuknya: scrypt$N$r$p$<salt base64>$<kunci base64>
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

const SCRYPT = { N: 16384, r: 8, p: 1, panjang: 32 };

/**
 * @param {string} kataSandi
 * @returns {Promise<string>}
 */
export async function hashKataSandi(kataSandi) {
  const salt = randomBytes(16);
  const kunci = await scrypt(kataSandi, salt, SCRYPT.panjang, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });

  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    kunci.toString('base64'),
  ].join('$');
}

/**
 * @param {string} kataSandi
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function periksaKataSandi(kataSandi, hash) {
  const bagian = String(hash).split('$');
  if (bagian.length !== 6 || bagian[0] !== 'scrypt') return false;

  const N = Number(bagian[1]);
  const r = Number(bagian[2]);
  const p = Number(bagian[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(bagian[4], 'base64');
  const diharap = Buffer.from(bagian[5], 'base64');
  if (salt.length === 0 || diharap.length === 0) return false;

  let kunci;
  try {
    kunci = await scrypt(kataSandi, salt, diharap.length, { N, r, p });
  } catch {
    return false;
  }

  return kunci.length === diharap.length && timingSafeEqual(kunci, diharap);
}
