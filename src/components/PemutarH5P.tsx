'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Menanam pemutar H5P sebagai iframe dan menyesuaikan tingginya dari kabar yang
 * dikirim penangkap-xapi.js di dalam iframe. Tanpa ini, konten panjang seperti
 * Interactive Video akan punya bilah guling sendiri di dalam halaman.
 */
export default function PemutarH5P({
  h5pContentId,
  judul,
}: {
  h5pContentId: string;
  judul?: string;
}) {
  const [tinggi, setTinggi] = useState(520);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function terima(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;

      const data = e.data as { jenis?: string; tinggi?: number } | null;
      if (data?.jenis !== 'tinggi-h5p' || typeof data.tinggi !== 'number') return;

      setTinggi(Math.min(Math.max(data.tinggi, 240), 20000));
    }

    window.addEventListener('message', terima);
    return () => window.removeEventListener('message', terima);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={`/h5p/view/${encodeURIComponent(h5pContentId)}`}
      title={judul ?? 'Konten interaktif'}
      className="w-full rounded-lg border border-black/10 dark:border-white/15"
      style={{ height: `${tinggi}px` }}
      allow="autoplay; fullscreen; microphone; camera"
    />
  );
}
