'use client';

import { useState } from 'react';
import { resendVerificationAction } from '@/app/actions/auth';

/**
 * A standing reminder for an account whose address has not been confirmed.
 *
 * Nothing is blocked while it shows — they are already signed in, and taking
 * the dashboard away from someone mid-task to make a point about email would be
 * punishing the wrong moment. The wall is at the next sign-in, which is where
 * proving the address actually matters.
 *
 * When no email provider is connected the link comes back here instead of being
 * sent, so signing up can still be finished rather than dead-ending.
 */
export function VerifyBanner() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [link, setLink] = useState<string | null>(null);

  return (
    <div className="alert" style={{ margin: '1rem', background: 'var(--warning-bg)' }}>
      <strong>Confirm your email.</strong>{' '}
      {state === 'sent' && !link
        ? 'Sent — check your inbox.'
        : 'You will need it the next time you sign in.'}

      {link ? (
        <p className="hint" style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
          No email provider is connected yet, so here is the link:{' '}
          <a href={link}>{link}</a>
        </p>
      ) : (
        <button
          type="button"
          className="btn secondary sm"
          style={{ marginLeft: '0.75rem' }}
          disabled={state === 'sending'}
          onClick={() => {
            setState('sending');
            void resendVerificationAction().then((r) => {
              setLink(r.link ?? null);
              setState('sent');
            });
          }}
        >
          {state === 'sending' ? 'Sending…' : 'Send it again'}
        </button>
      )}
    </div>
  );
}
