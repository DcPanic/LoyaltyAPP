import Link from 'next/link';
import { api } from '@/lib/api';
import { requirePermission, can } from '@/lib/session';
import { LiveRefresh } from '@/components/LiveRefresh';
import { ActionForm } from '@/components/ActionForm';
import { createCustomerAction } from '@/app/actions/admin';

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  stamps: number;
  stampsRequired: number;
  totalStamps: number;
  rewardsRedeemed: number;
  lastActivityAt: string | null;
  joinedAt: string;
  segment: string;
  memberCode: string | null;
}

const SEGMENTS = ['NEW', 'ACTIVE', 'VIP', 'AT_RISK', 'LOST'] as const;

export const metadata = { title: 'Customers — LoyaltyApp' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segment?: string }>;
}) {
  const session = await requirePermission('customer:read');
  const params = await searchParams;

  const query = new URLSearchParams({ limit: '100' });
  if (params.q) query.set('q', params.q);
  if (params.segment) query.set('segment', params.segment);

  const { items } = await api<{ items: CustomerRow[] }>(`/v1/customers?${query.toString()}`);

  return (
    <>
      <div className="topbar">
        <h1>Customers</h1>
        <div className="row">
          <LiveRefresh />
          {can(session, 'customer:export') && (
            <a className="btn secondary" href="/api/customers/export">
              Export CSV
            </a>
          )}
        </div>
      </div>

      <div className="card">
        <form className="row" style={{ marginBottom: '1rem' }}>
          <input
            type="search"
            name="q"
            placeholder="Name, phone, email or member code"
            defaultValue={params.q ?? ''}
            style={{ flex: '1 1 240px' }}
          />
          <select name="segment" defaultValue={params.segment ?? ''} style={{ width: 'auto' }}>
            <option value="">All segments</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Filter
          </button>
        </form>

        {items.length === 0 ? (
          <p className="empty">No customers match this search yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Stamps</th>
                  <th>All-time</th>
                  <th>Rewards</th>
                  <th>Last visit</th>
                  <th>Segment</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`}>
                        <strong>
                          {c.firstName} {c.lastName ?? ''}
                        </strong>
                      </Link>
                      {c.memberCode && (
                        <>
                          <br />
                          <small className="member-code">{c.memberCode}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <small>{c.phone ?? '—'}</small>
                      <br />
                      <small className="hint">{c.email ?? ''}</small>
                    </td>
                    <td>
                      <span className="badge">
                        {c.stamps}/{c.stampsRequired}
                      </span>
                    </td>
                    <td>{c.totalStamps}</td>
                    <td>{c.rewardsRedeemed}</td>
                    <td>
                      <small>
                        {c.lastActivityAt
                          ? new Date(c.lastActivityAt).toLocaleDateString()
                          : 'Never'}
                      </small>
                    </td>
                    <td>
                      <span className={`badge ${c.segment.toLowerCase()}`}>
                        {c.segment.replace('_', ' ').toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {can(session, 'customer:write') && (
        <div className="card">
          <div className="card-header">
            <h2>Add a customer by hand</h2>
          </div>
          <p className="hint">
            For phone regulars who have not scanned the join QR yet. They get the same card and can
            add it to their wallet from the link.
          </p>
          <ActionForm action={createCustomerAction} submitLabel="Add customer">
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="firstName">First name</label>
                <input id="firstName" name="firstName" required />
              </div>
              <div className="field">
                <label htmlFor="lastName">Last name</label>
                <input id="lastName" name="lastName" />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" name="phone" type="tel" />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" />
              </div>
            </div>
            <div className="field">
              <label className="checkbox">
                <input type="checkbox" name="marketingConsent" />
                <span>The customer agreed to receive marketing messages</span>
              </label>
            </div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
