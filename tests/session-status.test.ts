import { expect, test } from 'vitest';
import { akhirEfektif, bolehMasuk, statusSesi, type SesiWaktu } from '@/lib/session-status';

const buka = new Date('2026-11-01T08:00:00Z');
const tutup = new Date('2026-11-05T23:59:00Z');

const sesi = (closed_early_at: Date | null = null): SesiWaktu => ({
  opens_at: buka,
  closes_at: tutup,
  closed_early_at,
});

test('sebelum opens_at masih terjadwal', () => {
  expect(statusSesi(sesi(), new Date('2026-10-31T23:59:59Z'))).toBe('terjadwal');
});

test('tepat di opens_at sudah berjalan', () => {
  expect(statusSesi(sesi(), buka)).toBe('berjalan');
});

test('di tengah jendela waktu berjalan', () => {
  expect(statusSesi(sesi(), new Date('2026-11-03T10:00:00Z'))).toBe('berjalan');
});

test('tepat di closes_at sudah selesai', () => {
  expect(statusSesi(sesi(), tutup)).toBe('selesai');
});

test('closed_early_at mengalahkan closes_at yang masih jauh', () => {
  const ditutup = new Date('2026-11-02T09:00:00Z');
  expect(statusSesi(sesi(ditutup), new Date('2026-11-02T09:00:01Z'))).toBe('selesai');
});

test('sebelum closed_early_at masih berjalan', () => {
  const ditutup = new Date('2026-11-02T09:00:00Z');
  expect(statusSesi(sesi(ditutup), new Date('2026-11-02T08:59:59Z'))).toBe('berjalan');
});

test('closed_early_at sebelum opens_at tetap terjadwal menjadi selesai', () => {
  const ditutup = new Date('2026-10-30T00:00:00Z');
  expect(statusSesi(sesi(ditutup), new Date('2026-10-31T00:00:00Z'))).toBe('selesai');
});

test('bolehMasuk mengizinkan di tengah jendela', () => {
  expect(bolehMasuk(sesi(), new Date('2026-11-03T10:00:00Z'))).toEqual({ ok: true });
});

test('bolehMasuk membedakan belum_dibuka dan sudah_ditutup', () => {
  expect(bolehMasuk(sesi(), new Date('2026-10-31T00:00:00Z'))).toEqual({
    ok: false,
    alasan: 'belum_dibuka',
  });
  expect(bolehMasuk(sesi(), new Date('2026-11-06T00:00:00Z'))).toEqual({
    ok: false,
    alasan: 'sudah_ditutup',
  });
});

test('bolehMasuk menolak sesi yang ditutup lebih cepat dengan alasan sudah_ditutup', () => {
  const ditutup = new Date('2026-11-02T09:00:00Z');
  expect(bolehMasuk(sesi(ditutup), new Date('2026-11-02T10:00:00Z'))).toEqual({
    ok: false,
    alasan: 'sudah_ditutup',
  });
});

test('akhirEfektif memberi closes_at kalau tidak ditutup lebih cepat', () => {
  expect(akhirEfektif(sesi())).toEqual(tutup);
});

test('akhirEfektif memberi closed_early_at kalau itu lebih awal', () => {
  const ditutup = new Date('2026-11-02T09:00:00Z');
  expect(akhirEfektif(sesi(ditutup))).toEqual(ditutup);
});

test('akhirEfektif mengabaikan closed_early_at yang lebih lambat dari closes_at', () => {
  const ditutup = new Date('2026-11-09T00:00:00Z');
  expect(akhirEfektif(sesi(ditutup))).toEqual(tutup);
});
