/**
 * Penutup percobaan peserta: satu tombol kirim, plus penangkap pernyataan
 * "completed" yang dipancarkan konten sendiri.
 *
 * Tombol bawaan H5P (Check, Show solution, Retry) dimatikan, jadi di sini ada
 * dua jalan masuk nilai — dan keduanya memang perlu:
 *
 * 1. Tombol Kirim meminta nilai lewat kontrak getXAPIData(), cadangan
 *    getScore()/getMaxScore(). Itu jalur Crossword, Find the Words, Memory
 *    Game, dan sebagian besar tipe turunan H5P.Question.
 *
 * 2. Sebagian tipe TIDAK punya kontrak itu sama sekali dan hanya memancarkan
 *    pernyataan xAPI berverb "completed" lengkap dengan skor saat kegiatannya
 *    tuntas — H5P.ImagePair salah satunya. Tanpa penangkap ini, peserta
 *    Image Pair selalu berakhir tanpa nilai meski sudah menyelesaikan semuanya.
 *
 * Yang sengaja TIDAK ditangkap: pernyataan "answered". Verb itu dipancarkan di
 * tengah pengerjaan oleh konten beruntun, dan menangkapnya akan menutup
 * percobaan lebih awal dengan nilai separuh — peserta terlempar ke papan
 * peringkat sebelum selesai. "completed" berarti kontennya sendiri menyatakan
 * tuntas.
 *
 * Nilai dan durasi resmi tetap ditentukan server; halaman ini tidak menghitung
 * apa pun dan tidak mengirim angka waktu.
 */
(function () {
  'use strict';

  var tombol = document.getElementById('tombol-kirim');
  var keterangan = document.getElementById('ket-kirim');
  var sudahTerkirim = false;

  function instansi() {
    if (!window.H5P || !H5P.instances || H5P.instances.length === 0) return null;
    return H5P.instances[0];
  }

  function angkaSah(n) {
    return typeof n === 'number' && isFinite(n);
  }

  /** Pernyataan dengan skor, di tingkat teratas, dan menyatakan tuntas. */
  function layakSelesai(statement) {
    if (!statement || !statement.verb || !statement.verb.display) return false;
    if (statement.verb.display['en-US'] !== 'completed') return false;

    var konteks = statement.context;
    var aktivitas = konteks && konteks.contextActivities;
    var induk = aktivitas && aktivitas.parent;
    if (induk && induk.length > 0) return false;

    var skor = statement.result && statement.result.score;
    return Boolean(skor) && angkaSah(skor.raw) && angkaSah(skor.max);
  }

  /** Nilai dari kontrak H5P, untuk tipe yang menyediakannya. */
  function pernyataanDariKontrak() {
    var inst = instansi();
    if (!inst) return null;

    if (typeof inst.getXAPIData === 'function') {
      try {
        var data = inst.getXAPIData();
        if (data && data.statement && data.statement.result) {
          var s = data.statement;
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

    if (typeof inst.getScore === 'function' && typeof inst.getMaxScore === 'function') {
      try {
        var raw = inst.getScore();
        var max = inst.getMaxScore();
        if (angkaSah(raw) && angkaSah(max)) {
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

  /**
   * Nama fungsi penilaian pada tipe konten yang tidak punya kontrak
   * getXAPIData/getScore. Memanggilnya membuat konten memancarkan pernyataan
   * 'completed' berisi skor, yang lalu ditangkap pendengar di bawah.
   *
   * H5P.ImagePair memakai displayResult dan membukanya sebagai metode publik;
   * tombol Check bawaannya memanggil fungsi yang sama persis.
   */
  var FUNGSI_PENILAIAN = ['displayResult', 'showResult', 'showEvaluation', 'checkAnswer'];

  /** Fungsi penilaian milik konten, kalau ia tidak punya kontrak nilai. */
  function penilaiBawaan() {
    var inst = instansi();
    if (!inst) return null;

    // Tipe yang punya kontrak tidak perlu diambil alih — tombol Kirim sudah
    // bisa meminta nilainya langsung.
    if (typeof inst.getXAPIData === 'function') return null;
    if (typeof inst.getScore === 'function' && typeof inst.getMaxScore === 'function') {
      return null;
    }

    for (var i = 0; i < FUNGSI_PENILAIAN.length; i++) {
      if (typeof inst[FUNGSI_PENILAIAN[i]] === 'function') {
        return { inst: inst, nama: FUNGSI_PENILAIAN[i] };
      }
    }
    return null;
  }

  /**
   * Menyembunyikan tombol bawaan milik tipe yang kita ambil alih.
   *
   * Hanya dipasang kalau fungsi penilaiannya memang ketemu, karena
   * .h5p-joubelui-button juga dipakai tipe lain untuk navigasi yang sah —
   * menyembunyikannya di mana-mana akan merusak konten tersebut.
   */
  function sembunyikanTombolBawaan() {
    if (document.getElementById('gaya-tombol-bawaan')) return;

    var gaya = document.createElement('style');
    gaya.id = 'gaya-tombol-bawaan';
    gaya.textContent = '.h5p-content .h5p-joubelui-button { display: none !important; }';
    document.head.appendChild(gaya);
  }

  function keLuar() {
    if (window.parent !== window) {
      window.parent.postMessage({ jenis: 'selesai-h5p' }, window.location.origin);
    } else {
      window.location.href = '/hasil';
    }
  }

  function kirim(statement, saatOtomatis) {
    if (sudahTerkirim) return;
    sudahTerkirim = true;

    if (tombol) {
      tombol.disabled = true;
      tombol.textContent = 'Mengirim…';
    }

    fetch('/api/xapi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statement: statement }),
      credentials: 'same-origin',
      keepalive: true,
    })
      .then(function (res) {
        if (!res.ok) throw new Error('gagal');
        keLuar();
      })
      .catch(function () {
        sudahTerkirim = false;
        if (tombol) {
          tombol.disabled = false;
          tombol.textContent = 'Kirim jawaban';
        }
        if (keterangan) {
          keterangan.textContent = saatOtomatis
            ? 'Nilai gagal dikirim. Tekan Kirim jawaban untuk mencoba lagi.'
            : 'Pengiriman gagal. Periksa koneksi lalu tekan Kirim lagi.';
          keterangan.style.color = '#a92c14';
        }
      });
  }

  if (tombol) {
    tombol.addEventListener('click', function () {
      var s = pernyataanDariKontrak();
      if (s) {
        kirim(s, false);
        return;
      }

      // Tipe tanpa kontrak nilai: nilainya baru lahir saat fungsi penilaian
      // kontennya dipanggil. Pernyataan 'completed' yang dipancarkannya
      // ditangkap pendengar di bawah, yang lalu mengirim dan memindahkan
      // halaman — jadi di sini cukup memicunya.
      var penilai = penilaiBawaan();
      if (penilai) {
        tombol.disabled = true;
        tombol.textContent = 'Menilai…';
        try {
          penilai.inst[penilai.nama]();
        } catch (e) {
          tombol.disabled = false;
          tombol.textContent = 'Kirim jawaban';
          if (keterangan) {
            keterangan.textContent = 'Penilaian gagal dijalankan. Coba lagi.';
            keterangan.style.color = '#a92c14';
          }
        }
        return;
      }

      // Konten tanpa nilai sama sekali: tidak ada yang perlu dicatat.
      tombol.disabled = true;
      keLuar();
    });
  }

  function pasangPendengar() {
    if (!window.H5P || !H5P.externalDispatcher) return false;

    H5P.externalDispatcher.on('xAPI', function (event) {
      var statement = event && event.data && event.data.statement;
      if (layakSelesai(statement)) kirim(statement, true);
    });
    return true;
  }

  /**
   * Menunggu instance H5P ada, lalu menyembunyikan tombol bawaannya kalau kita
   * memang mengambil alih penilaiannya. Pendengar xAPI bisa dipasang sebelum
   * instance-nya lahir, jadi pemeriksaan ini punya penantiannya sendiri.
   */
  function siapkanPengambilalihan() {
    var coba = 0;
    var ulang = setInterval(function () {
      if (instansi()) {
        clearInterval(ulang);
        if (penilaiBawaan()) sembunyikanTombolBawaan();
        return;
      }
      if (++coba > 60) clearInterval(ulang);
    }, 100);
  }

  function mulai() {
    if (pasangPendengar()) {
      siapkanPengambilalihan();
      return;
    }

    // H5P kadang belum siap saat skrip ini jalan.
    var coba = 0;
    var ulang = setInterval(function () {
      if (pasangPendengar()) {
        clearInterval(ulang);
        siapkanPengambilalihan();
        return;
      }
      if (++coba > 40) clearInterval(ulang);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mulai);
  } else {
    mulai();
  }
})();
