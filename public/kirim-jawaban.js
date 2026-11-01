/**
 * Tombol kirim milik kita sendiri.
 *
 * Tombol bawaan H5P (Check, Show solution, Retry) dimatikan: peserta hanya
 * punya satu kali kesempatan, dan menekan Check dulu tidak pernah memberi
 * tanda apa pun bahwa pekerjaannya sudah tercatat. Satu tombol ini yang
 * menutup percobaan, lalu halaman induk dipindahkan ke papan peringkat.
 *
 * Skornya tetap berasal dari H5P sendiri — kita hanya meminta nilainya pada
 * saat tombol ditekan, lalu mengirim pernyataan xAPI apa adanya. Nilai dan
 * durasi resmi tetap ditentukan server.
 */
(function () {
  'use strict';

  var tombol = document.getElementById('tombol-kirim');
  var keterangan = document.getElementById('ket-kirim');
  if (!tombol) return;

  function instansi() {
    if (!window.H5P || !H5P.instances || H5P.instances.length === 0) return null;
    return H5P.instances[0];
  }

  /** Pernyataan xAPI dari H5P, kalau konten ini memang memberi nilai. */
  function pernyataan() {
    var inst = instansi();
    if (!inst) return null;

    // Jalur utama: kontrak getXAPIData milik H5P.Question dan sejenisnya.
    if (typeof inst.getXAPIData === 'function') {
      try {
        var data = inst.getXAPIData();
        if (data && data.statement && data.statement.result) {
          var s = data.statement;
          // Ditandai selesai: peserta sendiri yang menyatakan berhenti, dan
          // pemilih nilai di server mengutamakan pernyataan 'completed'.
          s.verb = { display: { 'en-US': 'completed' } };
          if (s.context && s.context.contextActivities) {
            delete s.context.contextActivities.parent;
          }
          return s;
        }
      } catch (e) {
        /* jatuh ke jalur cadangan */
      }
    }

    // Jalur cadangan: susun dari getScore/getMaxScore.
    if (typeof inst.getScore === 'function' && typeof inst.getMaxScore === 'function') {
      try {
        var raw = inst.getScore();
        var max = inst.getMaxScore();
        if (typeof raw === 'number' && typeof max === 'number') {
          return {
            verb: { display: { 'en-US': 'completed' } },
            result: { score: { raw: raw, max: max } },
          };
        }
      } catch (e) {
        /* konten ini memang tidak memberi nilai */
      }
    }

    return null;
  }

  function keLuar() {
    if (window.parent !== window) {
      window.parent.postMessage({ jenis: 'selesai-h5p' }, window.location.origin);
    } else {
      window.location.href = '/hasil';
    }
  }

  tombol.addEventListener('click', function () {
    tombol.disabled = true;
    tombol.textContent = 'Mengirim…';

    var s = pernyataan();

    if (!s) {
      // Konten tanpa nilai: tidak ada yang perlu dicatat, langsung keluar.
      keLuar();
      return;
    }

    fetch('/api/xapi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statement: s }),
      credentials: 'same-origin',
    })
      .then(function (res) {
        if (!res.ok) throw new Error('gagal');
        keLuar();
      })
      .catch(function () {
        tombol.disabled = false;
        tombol.textContent = 'Kirim jawaban';
        if (keterangan) {
          keterangan.textContent =
            'Pengiriman gagal. Periksa koneksi lalu tekan Kirim lagi.';
          keterangan.style.color = '#a92c14';
        }
      });
  });
})();
