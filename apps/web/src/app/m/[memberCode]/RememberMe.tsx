'use client';

import { useEffect } from 'react';

/**
 * Stores the café-scoped member token on this phone so a later NFC tap stamps
 * the right card without asking the customer anything.
 */
export function RememberMe({ memberCode }: { memberCode: string }) {
  useEffect(() => {
    void fetch('/api/remember', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberCode }),
    }).catch(() => undefined);
  }, [memberCode]);

  return null;
}
