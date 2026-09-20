'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StampGrid } from '@/components/StampGrid';

interface StampResponse {
  status: 'stamped' | 'unknown_member' | 'error';
  joinUrl?: string;
  message?: string;
  code?: string;
  result?: {
    duplicate: boolean;
    rewardUnlocked: boolean;
    /** True when the card was full and this tap handed the reward over. */
    redeemed?: boolean;
    customerFirstName?: string;
    rewardName?: string | null;
    membership: { stamps: number; stampsRequired: number; rewardAvailable: boolean };
  };
}

type State = { phase: 'working' } | { phase: 'done'; data: StampResponse };

export function TapFlow({
  code,
  joinUrl,
  rewardName,
  stampsRequired,
}: {
  code: string;
  joinUrl: string;
  rewardName: string;
  stampsRequired: number;
}) {
  const [state, setState] = useState<State>({ phase: 'working' });
  const started = useRef(false);

  useEffect(() => {
    // React runs effects twice in development; the request id keeps the double
    // run (and any retry) from becoming two stamps.
    if (started.current) return;
    started.current = true;

    const requestId =
      globalThis.crypto?.randomUUID?.() ?? `${code}-${Date.now()}-${Math.random()}`;

    void fetch(`/api/tap/${code}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId }),
    })
      .then((res) => res.json() as Promise<StampResponse>)
      .then((data) => setState({ phase: 'done', data }))
      .catch(() =>
        setState({
          phase: 'done',
          data: { status: 'error', message: 'No connection — please ask the barista.' },
        }),
      );
  }, [code]);

  if (state.phase === 'working') {
    return (
      <div className="tap-result">
        <div className="tap-check" aria-hidden>
          ☕
        </div>
        <p>One moment…</p>
      </div>
    );
  }

  const { data } = state;

  if (data.status === 'unknown_member') {
    return (
      <div className="tap-result">
        <h2>Welcome!</h2>
        <p className="hint">
          Get your loyalty card first — {stampsRequired} stamps and {rewardName} is on us. It takes
          about 20 seconds and there is no app to install.
        </p>
        <Link className="btn block lg" href={data.joinUrl ?? joinUrl}>
          Get my card
        </Link>
      </div>
    );
  }

  if (data.status === 'error') {
    const soon = data.code === 'rate_limited';
    return (
      <div className="tap-result">
        <div className="tap-check" style={{ background: 'var(--cream)', color: 'var(--coffee)' }} aria-hidden>
          {soon ? '⏳' : '!'}
        </div>
        <h2>{soon ? 'Already stamped' : 'We could not add the stamp'}</h2>
        <p className="hint">{data.message}</p>
        <Link className="btn secondary" href={joinUrl}>
          Open my card
        </Link>
      </div>
    );
  }

  const membership = data.result!.membership;
  const remaining = Math.max(0, membership.stampsRequired - membership.stamps);
  const reward = data.result!.rewardName ?? rewardName;

  // The card was full, so this tap spent it instead of adding to it. Say so
  // plainly: the customer needs to know the coffee is theirs to collect and
  // that the card they are looking at has started again.
  if (data.result!.redeemed) {
    return (
      <div className="tap-result">
        <div className="tap-check" aria-hidden>
          🎁
        </div>
        <h2>{data.result!.duplicate ? 'Already collected' : `${reward} is yours`}</h2>
        <p className="hint">Ask the barista for it — your card starts again from here.</p>
        <p className="tap-count">
          {membership.stamps} / {membership.stampsRequired}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
          <StampGrid stamps={membership.stamps} required={membership.stampsRequired} />
        </div>
      </div>
    );
  }

  return (
    <div className="tap-result">
      <div className="tap-check" aria-hidden>
        ✓
      </div>
      <h2>{data.result!.duplicate ? 'Already counted' : 'Stamp added'}</h2>
      <p className="tap-count">
        {membership.stamps} / {membership.stampsRequired}
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
        <StampGrid stamps={membership.stamps} required={membership.stampsRequired} />
      </div>
      {membership.rewardAvailable ? (
        <p>
          🎁 <strong>{reward} is ready!</strong> Tap again to collect it, or show your card to the
          barista.
        </p>
      ) : (
        <p className="hint">
          {remaining} more {remaining === 1 ? 'stamp' : 'stamps'} until {reward}.
        </p>
      )}
    </div>
  );
}
