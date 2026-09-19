'use client';

import { useCallback, useEffect, useState } from 'react';
import { StampGrid } from '@/components/StampGrid';
import { QrScanner } from '@/components/QrScanner';

interface Card {
  customer: { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null };
  membership: {
    id: string;
    stamps: number;
    stampsRequired: number;
    rewardAvailable: boolean;
    totalStamps: number;
    segment: string;
  };
  program: { id: string; name: string; rewardName: string; allowedStampAmounts: number[] };
  pendingReward: { id: string; name: string; expiresAt: string | null } | null;
}

interface SearchHit {
  membershipId: string;
  name: string;
  phone: string | null;
  email: string | null;
  stamps: number;
  stampsRequired: number;
  rewardAvailable: boolean;
}

interface RecentItem {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  channel: string;
  createdAt: string;
  customerName: string;
}

const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function StampConsole({
  locations,
  canRedeem,
  canRemove,
}: {
  locations: { id: string; name: string }[];
  canRedeem: boolean;
  canRemove: boolean;
}) {
  const [card, setCard] = useState<Card | null>(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [query, setQuery] = useState('');
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const loadRecent = useCallback(async () => {
    const res = await fetch('/api/staff/recent');
    if (res.ok) setRecent(((await res.json()) as { items: RecentItem[] }).items);
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  async function resolveCode(code: string) {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.message ?? 'Card not found' });
        return;
      }
      setCard(data as Card);
      setHits(null);
      setScanning(false);
    } finally {
      setPending(false);
    }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/staff/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.message ?? 'Search failed' });
        return;
      }
      setHits((data as { items: SearchHit[] }).items);
      if ((data as { items: SearchHit[] }).items.length === 1) {
        await openCard((data as { items: SearchHit[] }).items[0]!.membershipId);
      }
    } finally {
      setPending(false);
    }
  }

  async function openCard(membershipId: string) {
    setPending(true);
    try {
      const res = await fetch(`/api/staff/card/${membershipId}`);
      if (res.ok) {
        setCard((await res.json()) as Card);
        setHits(null);
      }
    } finally {
      setPending(false);
    }
  }

  async function addStamps(amount: number, channel: string) {
    if (!card) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/stamp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': newKey() },
        body: JSON.stringify({
          membershipId: card.membership.id,
          amount,
          channel,
          locationId: locationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.message ?? 'Could not add the stamp' });
        return;
      }
      await openCard(card.membership.id);
      await loadRecent();
      setMessage({
        tone: 'success',
        text: data.rewardUnlocked
          ? `Reward unlocked for ${card.customer.firstName}! 🎁`
          : `+${data.stampsAdded} for ${card.customer.firstName}`,
      });
    } finally {
      setPending(false);
    }
  }

  async function redeem() {
    if (!card) return;
    setPending(true);
    try {
      const res = await fetch('/api/staff/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': newKey() },
        body: JSON.stringify({ membershipId: card.membership.id, locationId: locationId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.message ?? 'Could not redeem' });
        return;
      }
      await openCard(card.membership.id);
      await loadRecent();
      setMessage({ tone: 'success', text: `${card.program.rewardName} redeemed 🎁` });
    } finally {
      setPending(false);
    }
  }

  const amounts = card?.program.allowedStampAmounts ?? [1, 2, 3, 5, 10];

  return (
    <div className="grid cols-2">
      <div>
        <div className="card">
          {message && <div className={`alert ${message.tone}`}>{message.text}</div>}

          {!card && (
            <>
              <div className="row" style={{ marginBottom: '0.9rem' }}>
                <button
                  className="btn lg"
                  onClick={() => setScanning((s) => !s)}
                  disabled={pending}
                  type="button"
                >
                  {scanning ? 'Stop scanning' : 'Scan customer QR'}
                </button>
              </div>

              {scanning && (
                <QrScanner
                  onResult={(code) => void resolveCode(code)}
                  onError={(text) => setMessage({ tone: 'error', text })}
                />
              )}

              <form onSubmit={search}>
                <div className="field">
                  <label htmlFor="q">Search customer</label>
                  <input
                    id="q"
                    type="search"
                    inputMode="search"
                    placeholder="Phone, email, name or member code"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <small className="hint">
                    For phone and delivery orders — the customer does not need to be here.
                  </small>
                </div>
                <button className="btn block" type="submit" disabled={pending}>
                  Search
                </button>
              </form>

              {hits && hits.length === 0 && (
                <p className="empty">No customer matches “{query}”.</p>
              )}
              {hits && hits.length > 0 && (
                <div className="grid" style={{ marginTop: '1rem' }}>
                  {hits.map((hit) => (
                    <button
                      key={hit.membershipId}
                      className="search-result"
                      onClick={() => void openCard(hit.membershipId)}
                      type="button"
                    >
                      <span>
                        <strong>{hit.name}</strong>
                        <br />
                        <small className="hint">{hit.phone ?? hit.email}</small>
                      </span>
                      <span className="badge">
                        {hit.stamps}/{hit.stampsRequired}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {card && (
            <>
              <div className="spread">
                <div>
                  <h2 style={{ marginBottom: 0 }}>
                    {card.customer.firstName} {card.customer.lastName ?? ''}
                  </h2>
                  <small className="hint">{card.customer.phone ?? card.customer.email}</small>
                </div>
                <button className="btn ghost" onClick={() => setCard(null)} type="button">
                  Change
                </button>
              </div>

              <div style={{ margin: '1rem 0' }}>
                <StampGrid
                  stamps={card.membership.stamps}
                  required={card.membership.stampsRequired}
                />
              </div>
              <p className="hint">
                {card.membership.stamps} / {card.membership.stampsRequired} stamps ·{' '}
                {card.membership.totalStamps} all-time
              </p>

              {card.membership.rewardAvailable && (
                <div className="alert success">
                  🎁 {card.pendingReward?.name ?? card.program.rewardName} is ready
                  {canRedeem && (
                    <button
                      className="btn block"
                      style={{ marginTop: '0.6rem' }}
                      onClick={() => void redeem()}
                      disabled={pending}
                      type="button"
                    >
                      Redeem reward
                    </button>
                  )}
                </div>
              )}

              {locations.length > 1 && (
                <div className="field">
                  <label htmlFor="location">Location</label>
                  <select
                    id="location"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label>Add stamps</label>
              <div className="stamp-amounts">
                {amounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => void addStamps(amount, 'STAFF_WEB')}
                    disabled={pending}
                    type="button"
                  >
                    +{amount}
                  </button>
                ))}
              </div>

              <div className="row" style={{ marginTop: '0.9rem' }}>
                <button
                  className="btn secondary"
                  onClick={() => void addStamps(1, 'PHONE_ORDER')}
                  disabled={pending}
                  type="button"
                >
                  +1 phone order
                </button>
                <button
                  className="btn secondary"
                  onClick={() => void addStamps(1, 'DELIVERY')}
                  disabled={pending}
                  type="button"
                >
                  +1 delivery
                </button>
              </div>

              {canRemove && (
                <p className="hint" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
                  Made a mistake? Corrections are available on the customer profile and are logged.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Recent activity</h2>
        </div>
        {recent.length === 0 ? (
          <p className="empty">Nothing yet today.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.customerName}</strong>
                      <br />
                      <small className="hint">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {item.channel.toLowerCase().replace('_', ' ')}
                      </small>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.type === 'REWARD_REDEEMED' ? (
                        <span className="badge vip">🎁 reward</span>
                      ) : (
                        <span className="badge ok">+{item.amount}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
