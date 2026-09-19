'use client';

import { QrCode } from '@/components/QrCode';

/** The link to write to the NFC sticker, plus its printable QR fallback. */
export function TagQr({ url, code }: { url: string; code: string }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="qr-box">
        <QrCode value={url} size={140} />
      </div>
      <div style={{ flex: '1 1 200px' }}>
        <div className="field">
          <label htmlFor={`url-${code}`}>Write this to the tag</label>
          <input id={`url-${code}`} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <p className="member-code">{code}</p>
      </div>
    </div>
  );
}
