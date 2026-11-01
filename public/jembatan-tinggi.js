/**
 * Mengabarkan tinggi konten ke halaman induk, supaya iframe-nya ikut tinggi
 * isinya dan tidak punya bilah guling sendiri.
 *
 * Dulu berkas ini juga mengirim pernyataan xAPI begitu H5P memancarkannya.
 * Itu dilepas: sejak tombol bawaan H5P (Check, Show solution, Retry) ditutup
 * dan digantikan satu tombol Kirim, satu-satunya yang boleh menutup percobaan
 * adalah tombol itu. Kalau pernyataan parsial tetap dikirim diam-diam, nilai
 * peserta bisa terkunci — dan ia terlempar ke papan peringkat — di tengah
 * pekerjaannya. Pengiriman nilai kini sepenuhnya milik kirim-jawaban.js.
 */
(function () {
  'use strict';

  if (window.parent === window) return;

  var terakhir = 0;

  function kirimTinggi() {
    var tinggi = Math.ceil(
      Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
      ),
    );
    if (tinggi > 0 && Math.abs(tinggi - terakhir) > 2) {
      terakhir = tinggi;
      window.parent.postMessage({ jenis: 'tinggi-h5p', tinggi: tinggi }, window.location.origin);
    }
  }

  function mulai() {
    kirimTinggi();
    window.addEventListener('resize', kirimTinggi);
    if (window.ResizeObserver) {
      new ResizeObserver(kirimTinggi).observe(document.body);
    } else {
      setInterval(kirimTinggi, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mulai);
  } else {
    mulai();
  }
})();
