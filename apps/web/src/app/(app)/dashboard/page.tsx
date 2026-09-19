import Link from 'next/link';
import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActivityChart, Sparkline, type SeriesPoint } from '@/components/charts/ActivityChart';
import { SegmentChart } from '@/components/charts/SegmentChart';
import { LiveRefresh } from '@/components/LiveRefresh';

interface DashboardData {
  stats: {
    customers: number;
    activeMembers: number;
    stampsToday: number;
    stampsWeek: number;
    stampsMonth: number;
    newCustomers: number;
    returningCustomers: number;
    rewardsRedeemed: number;
    rewardsPending: number;
  };
  series: SeriesPoint[];
  segments: Record<string, number>;
}

interface BusinessData {
  name: string;
  slug: string;
  joinUrl: string;
}

export const metadata = { title: 'Dashboard — LoyaltyApp' };

export default async function DashboardPage() {
  await requirePermission('analytics:read');
  const [data, business] = await Promise.all([
    api<DashboardData>('/v1/analytics/dashboard'),
    api<BusinessData>('/v1/business'),
  ]);

  const { stats } = data;

  return (
    <>
      <div className="topbar">
        <h1>Dashboard</h1>
        <LiveRefresh />
      </div>

      <div className="grid cols-4">
        <div className="stat">
          <div className="label">Stamps today</div>
          <div className="value">{stats.stampsToday}</div>
          <div className="hint">{stats.stampsWeek} this week</div>
        </div>
        <div className="stat">
          <div className="label">Customers</div>
          <div className="value">{stats.customers}</div>
          <div className="hint">{stats.newCustomers} joined this month</div>
        </div>
        <div className="stat">
          <div className="label">Active members</div>
          <div className="value">{stats.activeMembers}</div>
          <div className="hint">Active in the last 30 days</div>
        </div>
        <div className="stat">
          <div className="label">Rewards redeemed</div>
          <div className="value">{stats.rewardsRedeemed}</div>
          <div className="hint">{stats.rewardsPending} waiting to be collected</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <div>
            <h2>Stamps per day</h2>
            <small className="hint">Last 30 days</small>
          </div>
        </div>
        <ActivityChart series={data.series} />
        <div className="grid cols-2" style={{ marginTop: '1rem' }}>
          <Sparkline series={data.series} field="joins" label="New members" />
          <Sparkline series={data.series} field="redemptions" label="Rewards redeemed" />
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: '1rem' }}>
        <div className="card">
          <div className="card-header">
            <h2>Customer segments</h2>
          </div>
          <SegmentChart segments={data.segments} />
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Grow your program</h2>
          </div>
          <p className="hint">
            Print this link as a QR code and put it on the counter. Customers scan it, fill in their
            name and add the card to Apple Wallet or Google Wallet — no app to install.
          </p>
          <div className="field">
            <label htmlFor="joinUrl">Your join link</label>
            <input id="joinUrl" readOnly value={business.joinUrl} />
          </div>
          <div className="row">
            <Link className="btn" href="/nfc">
              Set up NFC stamps
            </Link>
            <Link className="btn secondary" href={business.joinUrl} target="_blank">
              Preview join page
            </Link>
          </div>
          <p className="hint" style={{ marginTop: '1rem', marginBottom: 0 }}>
            {stats.returningCustomers} customers came back more than once this month.
          </p>
        </div>
      </div>
    </>
  );
}
