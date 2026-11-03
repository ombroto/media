/**
 * Membersihkan teks menjadi nama berkas yang aman di Windows, macOS, dan Linux.
 * Dipakai unduhan CSV dan PNG kode QR.
 */
export function namaBerkasAman(teks: string, maks = 60, cadangan = 'berkas'): string {
  const bersih = teks
    .replace(/[\/:*?"<>|]/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, maks)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return bersih || cadangan;
}
