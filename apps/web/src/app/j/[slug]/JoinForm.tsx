'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Branding } from '@/components/Brand';
import { StampGrid } from '@/components/StampGrid';
import { WalletButtons } from '@/components/WalletButtons';

interface Props {
  slug: string;
  business: Branding;
  wallet: { apple: boolean; google: boolean };
  stampsRequired: number;
  rewardName: string;
}

interface JoinResult {
  memberCode: string;
  memberPageUrl: string;
  wallet: { apple: string | null; google: string | null };
}

export function JoinForm({ slug, business, wallet, stampsRequired, rewardName }: Props) {
  const [result, setResult] = useState<JoinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: String(form.get('firstName') ?? '').trim(),
      lastName: String(form.get('lastName') ?? '').trim() || undefined,
      phone: String(form.get('phone') ?? '').trim() || undefined,
      email: String(form.get('email') ?? '').trim() || undefined,
      birthday: String(form.get('birthday') ?? '') || undefined,
      marketingConsent: form.get('marketingConsent') === 'on',
      termsAccepted: true,
    };

    try {
      const res = await fetch(`/api/join/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; message?: string } & JoinResult;
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Could not create your card. Please check your details.');
        return;
      }
      setResult(data);
    } catch {
      setError('Network problem — please try again.');
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="center">
        <h2>Your card is ready 🎉</h2>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
          <StampGrid stamps={0} required={stampsRequired} />
        </div>
        <p className="hint">
          Add it to your wallet so the barista can stamp it — {stampsRequired} stamps for{' '}
          {rewardName}.
        </p>
        <WalletButtons wallet={result.wallet} available={wallet} />
        <p style={{ marginTop: '1rem' }}>
          <Link className="btn secondary block" href={`/m/${result.memberCode}`}>
            Open my card in the browser
          </Link>
        </p>
        <p className="member-code">{result.memberCode}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert error">{error}</div>}
      <div className="field">
        <label htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" required autoComplete="given-name" />
      </div>
      <div className="field">
        <label htmlFor="lastName">Last name (optional)</label>
        <input id="lastName" name="lastName" autoComplete="family-name" />
      </div>
      <div className="field">
        <label htmlFor="phone">Mobile phone</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+357 99 123456" />
        <small className="hint">Phone or email — we need one of them to find your card.</small>
      </div>
      <div className="field">
        <label htmlFor="email">Email (optional)</label>
        <input id="email" name="email" type="email" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="birthday">Birthday (optional)</label>
        <input id="birthday" name="birthday" type="date" />
        <small className="hint">So we can send you a birthday treat.</small>
      </div>
      <div className="field">
        <label className="checkbox">
          <input type="checkbox" name="marketingConsent" />
          <span>
            Send me offers and news from {business.name}. You can stop this at any time from your
            card.
          </span>
        </label>
      </div>
      <button className="btn block lg" type="submit" disabled={pending}>
        {pending ? 'Creating your card…' : 'Get my loyalty card'}
      </button>
    </form>
  );
}
