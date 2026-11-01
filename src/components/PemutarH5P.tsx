'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Menanam pemutar H5P sebagai iframe.
 *
 * Dua kabar datang dari dalam iframe lewat postMessage: tingginya, supaya
 * konten panjang tidak punya bilah guling sendiri; dan tanda selesai, saat
 * peserta menekan tombol kirim — halaman langsung berpindah ke papan
 * peringkat, karena sebelumnya tidak ada apa pun yang terjadi di layar
 * walaupun nilainya sudah tercatat.
 */
export default function PemutarH5P({
  h5pContentId,
  judul,
  keSetelahSelesai = '/hasil',
}: {
  h5pContentId: string;
  judul?: string;
  keSetelahSelesai?: string | null;
}) {
  const router = useRouter();
  const [tinggi, setTinggi] = useState(520);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function terima(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;

      const data = e.data as { jenis?: string; tinggi?: number } | null;

      if (data?.jenis === 'tinggi-h5p' && typeof data.tinggi === 'number') {
        setTinggi(Math.min(Math.max(data.tinggi, 240), 20000));
        return;
      }

      if (data?.jenis === 'selesai-h5p' && keSetelahSelesai) {
        router.push(keSetelahSelesai);
      }
    }

    window.addEventListener('message', terima);
    return () => window.removeEventListener('message', terima);
  }, [router, keSetelahSelesai]);

  return (
    <iframe
      ref={iframeRef}
      src={`/h5p/view/${encodeURIComponent(h5pContentId)}`}
      title={judul ?? 'Konten interaktif'}
      className="w-full rounded-lg border border-garis bg-white"
      style={{ height: `${tinggi}px` }}
      allow="autoplay; fullscreen; microphone; camera"
    />
  );
}
