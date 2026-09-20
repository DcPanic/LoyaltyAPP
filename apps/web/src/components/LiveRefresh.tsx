'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps the current page in step with the rest of the platform: a stamp taken in
 * the React Native app or at an NFC tag refreshes this view within a second.
 */
export function LiveRefresh({ events }: { events?: string[] }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const source = new EventSource('/api/events');
    const watched = events ?? [
      'stamp.added',
      'stamp.removed',
      'reward.earned',
      'reward.redeemed',
      'customer.created',
      'customer.updated',
      'customer.deleted',
    ];

    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    for (const name of watched) source.addEventListener(name, refresh);

    // Some hosts cut long-lived connections (a serverless function has a time
    // limit, a sleeping service drops them). A slow poll keeps the page honest
    // even then; it costs one request a minute when the stream is healthy.
    const poll = setInterval(() => router.refresh(), 60_000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      source.close();
    };
  }, [router, events]);

  return (
    <span className="badge" title={live ? 'Live updates on' : 'Reconnecting…'}>
      <span aria-hidden style={{ color: live ? 'var(--success)' : 'var(--muted)' }}>
        ●
      </span>
      {live ? 'Live' : 'Offline'}
    </span>
  );
}
