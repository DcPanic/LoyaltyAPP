import Link from 'next/link';
import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';

interface NotificationsData {
  wallet: {
    apple: boolean;
    google: boolean;
    applePasses: number;
    googlePasses: number;
    appleDevices: number;
    lastPushedAt: string | null;
    lastPushedPlatform: string | null;
  };
  consent: { customers: number; consented: number };
  pendingRewards: number;
  birthdaysThisWeek: { id: string; name: string; birthday: string }[];
  channels: {
    key: string;
    name: string;
    channel: string;
    status: 'live' | 'needs_wallet_setup' | 'not_connected';
    description: string;
  }[];
}

const STATUS: Record<string, { label: string; className: string }> = {
  live: { label: 'live', className: 'badge ok' },
  needs_wallet_setup: { label: 'needs wallet setup', className: 'badge at_risk' },
  not_connected: { label: 'provider not connected', className: 'badge off' },
};

export const metadata = { title: 'Notifications — LoyaltyApp' };

export default async function NotificationsPage() {
  await requirePermission('analytics:read');
  const data = await api<NotificationsData>('/v1/notifications');

  return (
    <>
      <div className="topbar">
        <h1>Notifications</h1>
      </div>

      <div className="grid cols-4">
        <div className="stat">
          <div className="label">Apple Wallet cards</div>
          <div className="value">{data.wallet.applePasses}</div>
          <div className="hint">{data.wallet.appleDevices} devices registered for updates</div>
        </div>
        <div className="stat">
          <div className="label">Google Wallet cards</div>
          <div className="value">{data.wallet.googlePasses}</div>
          <div className="hint">Updated directly on every change</div>
        </div>
        <div className="stat">
          <div className="label">Marketing consent</div>
          <div className="value">{data.consent.consented}</div>
          <div className="hint">of {data.consent.customers} customers</div>
        </div>
        <div className="stat">
          <div className="label">Rewards waiting</div>
          <div className="value">{data.pendingRewards}</div>
          <div className="hint">Shown on those customers&apos; cards right now</div>
        </div>
      </div>

      {!data.wallet.apple && !data.wallet.google && (
        <div className="alert info" style={{ marginTop: '1rem' }}>
          Wallet passes are not configured on this deployment yet, so card updates cannot be
          delivered. Everything else keeps working and customers can use their web card. See
          <code> docs/WALLET.md</code> for the Apple and Google setup.
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <h2>How customers hear from you</h2>
          <small className="hint">
            {data.wallet.lastPushedAt
              ? `Last wallet update ${new Date(data.wallet.lastPushedAt).toLocaleString()} (${data.wallet.lastPushedPlatform?.toLowerCase()})`
              : 'No wallet updates sent yet'}
          </small>
        </div>
        <p className="hint">
          Your customers have no app to install, so the loyalty card itself is the channel: it
          updates on their phone the moment something changes. Messages that need email or SMS are
          marked below.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Notification</th>
                <th>Channel</th>
                <th>Status</th>
                <th>How it works</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((channel) => (
                <tr key={channel.key}>
                  <td>
                    <strong>{channel.name}</strong>
                  </td>
                  <td>{channel.channel}</td>
                  <td>
                    <span className={STATUS[channel.status]!.className}>
                      {STATUS[channel.status]!.label}
                    </span>
                  </td>
                  <td>
                    <small className="hint">{channel.description}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Birthdays this week</h2>
          <Link className="btn secondary" href="/campaigns">
            Create a birthday campaign
          </Link>
        </div>
        {data.birthdaysThisWeek.length === 0 ? (
          <p className="empty">No customer birthdays in the next seven days.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>
                {data.birthdaysThisWeek.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link href={`/customers/${customer.id}`}>{customer.name}</Link>
                    </td>
                    <td>
                      <small className="hint">
                        {new Date(customer.birthday).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Customer privacy</h2>
        </div>
        <p className="hint">
          Marketing messages only ever go to customers who agreed. They can withdraw consent
          themselves from their own card page, and every change is recorded with its source. Stamp
          and reward updates are part of the loyalty service itself and are not marketing.
        </p>
      </div>
    </>
  );
}
