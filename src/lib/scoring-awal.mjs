/**
 * Tipe konten yang memang tidak pernah mengirim skor. Sesi dari konten seperti
 * ini tetap boleh dibuat, tapi tanpa papan peringkat (§5.5).
 *
 * Daftar ini hanya berisi tipe yang sudah diperiksa isinya — tidak punya
 * getScore/getMaxScore/getXAPIData maupun setScoredResult. H5P.MemoryGame
 * sempat ada di sini dan itu keliru: ia mengimplementasikan ketiganya.
 * Kalau ragu, biarkan 'unknown'; penyelenggara bisa menandainya sendiri dari
 * halaman pustaka konten.
 *
 * Dipegang satu modul JavaScript biasa, bukan TypeScript, supaya skrip yang
 * dijalankan Node langsung memakai daftar yang sama persis dengan aplikasi —
 * pola yang sama dengan src/lib/password.mjs.
 */
export const TAK_BERSKOR = new Set([
  'H5P.Dialogcards',
  'H5P.DialogCards',
  'H5P.AdvancedText',
  'H5P.Image',
  'H5P.Audio',
  'H5P.Video',
  'H5P.Collage',
  'H5P.Timeline',
  'H5P.Accordion',
  'H5P.Table',
  'H5P.IFrameEmbed',
  'H5P.ImageHotspots',
  'H5P.Link',
  'H5P.Column',
]);

/**
 * @param {string} mainLibrary
 * @returns {'scored' | 'unscored' | 'unknown'}
 */
export function scoringAwal(mainLibrary) {
  return TAK_BERSKOR.has(mainLibrary) ? 'unscored' : 'unknown';
}
