/**
 * Nama cookie, dipisah tanpa dependensi apa pun supaya middleware Next —
 * yang berjalan di runtime edge tanpa node:crypto maupun pg — bisa
 * mengimpornya tanpa menarik seluruh lapisan autentikasi.
 */
export const NAMA_COOKIE_GURU = 'sesi_guru';
export const NAMA_COOKIE_PESERTA = 'token_peserta';
