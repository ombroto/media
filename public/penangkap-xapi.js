/**
 * Penangkap skor xAPI — meniru xapi-collector.js dari plugin Moodle mod_hvp,
 * disederhanakan untuk kebutuhan situs ini.
 *
 * Yang dikirim ke server hanyalah pernyataan xAPI apa adanya. Nilai dan durasi
 * ditentukan server (§5.6); halaman ini tidak menghitung skor dan tidak
 * mengirim angka waktu, supaya tak ada yang bisa dipalsukan dari sini.
 *
 * Juga mengabarkan tingginya ke halaman induk, supaya iframe-nya ikut tinggi
 * kontennya tanpa bilah guling di dalam.
 */
(function () {
  'use strict';

  function layak(statement) {
    if (!statement || !statement.verb || !statement.verb.display) return false;

    var kata = statement.verb.display['en-US'];
    if (kata !== 'answered' && kata !== 'completed') return false;

    // Hanya kejadian di tingkat teratas; pernyataan anak punya induk.
    var konteks = statement.context;
    var aktivitas = konteks && konteks.contextActivities;
    var induk = aktivitas && aktivitas.parent;
    return !(induk && induk.length > 0);
  }

  function kirim(statement) {
    var muatan = JSON.stringify({ statement: statement });

    // keepalive supaya kiriman terakhir tetap sampai walau halaman ditutup.
    fetch('/api/xapi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: muatan,
      credentials: 'same-origin',
      keepalive: true,
    }).catch(function () {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/xapi', new Blob([muatan], { type: 'application/json' }));
      }
    });
  }

  function pasangPendengar() {
    if (!window.H5P || !window.H5P.externalDispatcher) return false;

    window.H5P.externalDispatcher.on('xAPI', function (event) {
      var statement = event && event.data && event.data.statement;
      if (layak(statement)) kirim(statement);
    });
    return true;
  }

  function kabarkanTinggi() {
    if (window.parent === window) return;

    var terakhir = 0;
    var kirimTinggi = function () {
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
    };

    kirimTinggi();
    window.addEventListener('resize', kirimTinggi);
    if (window.ResizeObserver) {
      new ResizeObserver(kirimTinggi).observe(document.body);
    } else {
      setInterval(kirimTinggi, 500);
    }
  }

  function mulai() {
    if (!pasangPendengar()) {
      // H5P kadang belum siap saat skrip ini jalan.
      var coba = 0;
      var ulang = setInterval(function () {
        if (pasangPendengar() || ++coba > 40) clearInterval(ulang);
      }, 100);
    }
    kabarkanTinggi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mulai);
  } else {
    mulai();
  }
})();
