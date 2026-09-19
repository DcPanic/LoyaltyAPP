'use client';

import { useState } from 'react';

export function ConsentToggle({
  memberCode,
  memberToken,
}: {
  memberCode: string;
  memberToken: string;
}) {
  const [saved, setSaved] = useState<null | boolean>(null);
  const [pending, setPending] = useState(false);

  async function update(granted: boolean) {
    setPending(true);
    try {
      const apiUrl = `/api/consent`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberCode, memberToken, granted }),
      });
      if (res.ok) setSaved(granted);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h3>Marketing messages</h3>
      <p className="hint">
        You decide whether this café may send you offers. Your stamps are unaffected either way.
      </p>
      <div className="row">
        <button className="btn secondary" disabled={pending} onClick={() => void update(true)}>
          Yes, send me offers
        </button>
        <button className="btn secondary" disabled={pending} onClick={() => void update(false)}>
          No thanks
        </button>
      </div>
      {saved !== null && (
        <p className="hint" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
          {saved ? 'Saved — you will hear about new offers.' : 'Saved — we will not message you.'}
        </p>
      )}
    </div>
  );
}
