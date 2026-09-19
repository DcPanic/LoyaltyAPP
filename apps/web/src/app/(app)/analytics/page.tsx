import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActivityChart, Sparkline, type SeriesPoint } from '@/components/charts/ActivityChart';
import { SegmentChart } from '@/components/charts/SegmentChart';

interface FullAnalytics {
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
  staff: { userId: string; name: string; stamps: number; transactions: number }[];
  locations: { locationId: string | null; name: string; stamps: number; transactions: number }[];
  retention: number;
}

export const metadata = { title: 'Analytics — LoyaltyApp' };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; locationId?: string }>;
}) {
  await requirePermission('analytics:read');
  const params = await searchParams;
  const days = params.days ?? '90';

  const query = new URLSearchParams({ days });
  if (params.locationId) query.set('locationId', params.locationId);
  const [data, locations] = await Promise.all([
    api<FullAnalytics>(`/v1/analytics/full?${query.toString()}`),
    api<{ items: { id: string; name: string }[] }>('/v1/business/locations'),
  ]);

  return (
    <>
      <div className="topbar">
        <h1>Analytics</h1>
        <form className="row">
          <select name="days" defaultValue={days}>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>
          <select name="locationId" defaultValue={params.locationId ?? ''}>
            <option value="">All locations</option>
            {locations.items.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button className="btn secondary" type="submit">
            Apply
          </button>
        </form>
      </div>

      <div className="grid cols-4">
        <div className="stat">
          <div className="label">Stamps this month</div>
          <div className="value">{data.stats.stampsMonth}</div>
        </div>
        <div className="stat">
          <div className="label">Returning customers</div>
          <div className="value">{data.stats.returningCustomers}</div>
          <div className="hint">More than one visit this month</div>
        </div>
        <div className="stat">
          <div className="label">Retention</div>
          <div className="value">{data.retention}%</div>
          <div className="hint">Last month&apos;s customers who came back</div>
        </div>
        <div className="stat">
          <div className="label">Rewards waiting</div>
          <div className="value">{data.stats.rewardsPending}</div>
          <div className="hint">Earned but not yet collected</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header">
          <h2>Stamps per day</h2>
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
            <h2>Segments</h2>
          </div>
          <SegmentChart segments={data.segments} />
        </div>

        <div className="card">
          <div className="card-header">
            <h2>By location</h2>
          </div>
          {data.locations.length === 0 ? (
            <p className="empty">No location activity yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Stamps</th>
                  <th>Transactions</th>
                </tr>
              </thead>
              <tbody>
                {data.locations.map((l) => (
                  <tr key={l.locationId ?? 'none'}>
                    <td>{l.name}</td>
                    <td>{l.stamps}</td>
                    <td>{l.transactions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Staff activity</h2>
          <small className="hint">Last 30 days</small>
        </div>
        {data.staff.length === 0 ? (
          <p className="empty">No staff stamping recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Stamps given</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s) => (
                <tr key={s.userId}>
                  <td>{s.name}</td>
                  <td>{s.stamps}</td>
                  <td>{s.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
