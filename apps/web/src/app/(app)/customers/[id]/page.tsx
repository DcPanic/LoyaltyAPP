import Link from 'next/link';
import { api } from '@/lib/api';
import { can, requirePermission } from '@/lib/session';
import { StampGrid } from '@/components/StampGrid';
import { ActionForm } from '@/components/ActionForm';
import {
  adjustStampsAction,
  deleteCustomerAction,
  setConsentAction,
} from '@/app/actions/admin';

interface Profile {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    birthday: string | null;
    marketingConsent: boolean;
    status: string;
    createdAt: string;
    location: { name: string } | null;
  };
  memberships: {
    id: string;
    memberCode: string;
    stamps: number;
    totalStamps: number;
    rewardsEarned: number;
    rewardsRedeemed: number;
    joinedAt: string;
    lastActivityAt: string | null;
    segment: string;
    rewardAvailable: boolean;
    program: { name: string; stampsRequired: number; rewardName: string };
  }[];
  transactions: {
    id: string;
    type: string;
    channel: string;
    amount: number;
    balanceAfter: number;
    note: string | null;
    createdAt: string;
    location: { name: string } | null;
  }[];
  redemptions: {
    id: string;
    earnedAt: string;
    redeemedAt: string | null;
    expiresAt: string | null;
    reward: { name: string } | null;
  }[];
}

const CHANNEL_LABEL: Record<string, string> = {
  STAFF_APP: 'staff app',
  STAFF_WEB: 'staff web',
  PHONE_ORDER: 'phone order',
  DELIVERY: 'delivery',
  NFC: 'NFC tap',
  QR: 'QR scan',
  SYSTEM: 'system',
};

export const metadata = { title: 'Customer — LoyaltyApp' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('customer:read');
  const { id } = await params;
  const profile = await api<Profile>(`/v1/customers/${id}`);
  const { customer } = profile;
  const membership = profile.memberships[0];

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ marginBottom: 0 }}>
            {customer.firstName} {customer.lastName ?? ''}
          </h1>
          <small className="hint">
            Joined {new Date(customer.createdAt).toLocaleDateString()}
            {customer.location ? ` · ${customer.location.name}` : ''}
          </small>
        </div>
        <Link className="btn secondary" href="/customers">
          Back to customers
        </Link>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-header">
            <h2>Loyalty</h2>
            {membership && (
              <span className={`badge ${membership.segment.toLowerCase()}`}>
                {membership.segment.replace('_', ' ').toLowerCase()}
              </span>
            )}
          </div>

          {membership ? (
            <>
              <StampGrid stamps={membership.stamps} required={membership.program.stampsRequired} />
              <p className="hint" style={{ marginTop: '0.75rem' }}>
                {membership.stamps} / {membership.program.stampsRequired} ·{' '}
                {membership.totalStamps} all-time · {membership.rewardsRedeemed} rewards enjoyed
              </p>
              {membership.rewardAvailable && (
                <div className="alert success">
                  🎁 {membership.program.rewardName} is waiting to be collected.
                </div>
              )}
              <p className="member-code">{membership.memberCode}</p>
              <Link className="btn secondary" href={`/m/${membership.memberCode}`} target="_blank">
                Open customer card
              </Link>
            </>
          ) : (
            <p className="empty">This customer has no loyalty membership.</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Details</h2>
          </div>
          <table>
            <tbody>
              <tr>
                <th>Phone</th>
                <td>{customer.phone ?? '—'}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>{customer.email ?? '—'}</td>
              </tr>
              <tr>
                <th>Birthday</th>
                <td>
                  {customer.birthday ? new Date(customer.birthday).toLocaleDateString() : '—'}
                </td>
              </tr>
              <tr>
                <th>Marketing</th>
                <td>
                  <span className={`badge ${customer.marketingConsent ? 'ok' : 'off'}`}>
                    {customer.marketingConsent ? 'consented' : 'no consent'}
                  </span>
                </td>
              </tr>
              <tr>
                <th>Status</th>
                <td>{customer.status.toLowerCase()}</td>
              </tr>
            </tbody>
          </table>

          {can(session, 'customer:write') && (
            <div className="row" style={{ marginTop: '1rem' }}>
              <ActionForm
                action={setConsentAction}
                submitLabel={customer.marketingConsent ? 'Withdraw consent' : 'Record consent'}
                className="btn secondary"
              >
                <input type="hidden" name="customerId" value={customer.id} />
                <input
                  type="hidden"
                  name="granted"
                  value={customer.marketingConsent ? 'false' : 'true'}
                />
              </ActionForm>
              {can(session, 'customer:export') && (
                <a className="btn secondary" href={`/api/customers/${customer.id}/export`}>
                  Export data
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Activity</h2>
          <small className="hint">Last 50 events</small>
        </div>
        {profile.transactions.length === 0 ? (
          <p className="empty">No activity yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Channel</th>
                  <th>Balance</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {profile.transactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <small>{new Date(t.createdAt).toLocaleString()}</small>
                    </td>
                    <td>
                      {t.type === 'STAMP_ADD' && <span className="badge ok">+{t.amount}</span>}
                      {t.type === 'STAMP_REMOVE' && <span className="badge off">−{t.amount}</span>}
                      {t.type === 'ADJUSTMENT' && <span className="badge">correction</span>}
                      {t.type === 'REWARD_REDEEMED' && <span className="badge vip">🎁 redeemed</span>}
                      {t.type === 'REWARD_EARNED' && <span className="badge vip">reward earned</span>}
                      {t.type === 'JOIN' && <span className="badge new">joined</span>}
                    </td>
                    <td>
                      <small>{CHANNEL_LABEL[t.channel] ?? t.channel}</small>
                      {t.location && <small className="hint"> · {t.location.name}</small>}
                    </td>
                    <td>{t.balanceAfter}</td>
                    <td>
                      <small className="hint">{t.note ?? ''}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {membership && can(session, 'program:manage') && (
        <div className="card">
          <div className="card-header">
            <h2>Correct the balance</h2>
          </div>
          <p className="hint">
            Use this when moving someone over from a paper card or fixing a mistake. Every
            correction is written to the activity log with your name.
          </p>
          <ActionForm action={adjustStampsAction} submitLabel="Save correction">
            <input type="hidden" name="membershipId" value={membership.id} />
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="stamps">Stamps</label>
                <input
                  id="stamps"
                  name="stamps"
                  type="number"
                  min={0}
                  max={1000}
                  defaultValue={membership.stamps}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="reason">Reason</label>
                <input id="reason" name="reason" required placeholder="Paper card transfer" />
              </div>
            </div>
          </ActionForm>
        </div>
      )}

      {can(session, 'customer:delete') && (
        <div className="card">
          <div className="card-header">
            <h2>Erase this customer</h2>
          </div>
          <p className="hint">
            GDPR erasure: personal details are cleared and wallet passes revoked. Anonymous
            transaction counts stay so your café totals remain correct. This cannot be undone.
          </p>
          <ActionForm action={deleteCustomerAction} submitLabel="Erase customer" className="btn danger">
            <input type="hidden" name="customerId" value={customer.id} />
          </ActionForm>
        </div>
      )}
    </>
  );
}
