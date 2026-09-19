'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Renders the member code as a QR the barista can scan from the phone screen. */
export function QrCode({ value, size = 190 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (!cancelled) setDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div className="skeleton" style={{ width: size, height: size, borderRadius: 12 }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} width={size} height={size} alt={`QR code for member ${value}`} />;
}
