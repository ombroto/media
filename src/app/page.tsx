import FormPin from './FormPin';

export const metadata = {
  title: 'Masukkan PIN — Sesi H5P',
  description: 'Masukkan PIN untuk mulai mengerjakan.',
};

const LANGKAH = [
  { nomor: '01', judul: 'Masukkan PIN', teks: 'Enam angka dari pengajar Anda.' },
  { nomor: '02', judul: 'Isi nama', teks: 'Satu nama hanya bisa dipakai sekali per sesi.' },
  { nomor: '03', judul: 'Kerjakan', teks: 'Nilai tercatat sendiri, tanpa tombol kirim.' },
  { nomor: '04', judul: 'Lihat peringkat', teks: 'Langsung setelah selesai, lengkap.' },
];

export default function Beranda() {
  return (
    <main>
      <section className="pita-gelap">
        <div className="wadah grid gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-20">
          <div className="space-y-5">
            <span className="kerlip">Sesi interaktif</span>
            <h1 className="text-[clamp(2.1rem,6vw,3.4rem)] text-white">
              Masukkan PIN,
              <br />
              kerjakan kontennya,
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-white/70">
              lalu
              lihat posisi Anda di papan peringkat saat itu juga.
            </p>
          </div>

          <div className="kartu p-6 sm:p-7">
            <span className="kerlip">Mulai di sini</span>
            <h2 className="mt-3 mb-5 text-xl">Masukkan PIN</h2>
            <FormPin />
          </div>
        </div>
      </section>

      <section className="pita pita-putih">
        <div className="wadah">
          <div className="mb-8 text-center">
            <span className="kerlip">Cara kerjanya</span>
            <h2 className="judul-seksi mt-3">Empat langkah, tanpa akun</h2>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LANGKAH.map((l) => (
              <li key={l.nomor} className="kartu p-5">
                <p className="font-judul text-2xl font-bold text-oranye">{l.nomor}</p>
                <h3 className="mt-3 text-base">{l.judul}</h3>
                <p className="mt-1 text-sm leading-relaxed text-abu">{l.teks}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
