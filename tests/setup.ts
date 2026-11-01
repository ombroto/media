process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgres://postgres@127.0.0.1:5432/interactivemedia_test';

// Artefak H5P untuk pengujian dipisah dari yang dipakai aplikasi, supaya tes
// boleh membersihkan pustaka tanpa mengganggu konten yang sudah diunggah.
process.env.H5P_DATA_DIR = process.env.H5P_DATA_DIR_TEST ?? './data/h5p-test';
