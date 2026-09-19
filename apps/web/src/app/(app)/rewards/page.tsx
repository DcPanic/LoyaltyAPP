import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { saveRewardAction } from '@/app/actions/admin';

interface Reward {
  id: string;
  name: string;
  description: string | null;
  stampsRequired: number;
  expiryDays: number | null;
  isActive: boolean;
  _count: { redemptions: number };
}

interface Redemption {
  id: string;
  earnedAt: string;
  redeemedAt: string | null;
  expiresAt: string | null;
  customer: { firstName: string; lastName: string | null };
  reward: { name: string } | null;
  location: { name: string } | null;
}

export const metadata = { title: 'Rewards — LoyaltyApp' };

export default async function RewardsPage() {
  await requirePermission('reward:manage');
  const [{ items: rewards }, { items: redemptions }] = await Promise.all([
    api<{ items: Reward[] }>('/v1/rewards'),
    api<{ items: Redemption[] }>('/v1/rewards/redemptions'),
  ]);

  return (
    <>
      <div className="topbar">
        <h1>Rewards</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Your rewards</h2>
        </div>
        {rewards.length === 0 ? (
          <p className="empty">No rewards yet — add your first one below.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reward</th>
                  <th>Stamps</th>
                  <th>Expiry</th>
                  <th>Redeemed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <br />
                      <small className="hint">{r.description}</small>
                    </td>
                    <td>{r.stampsRequired}</td>
                    <td>{r.expiryDays ? `${r.expiryDays} days` : 'never'}</td>
                    <td>{r._count.redemptions}</td>
                    <td>
                      <span className={`badge ${r.isActive ? 'ok' : 'off'}`}>
                        {r.isActive ? 'active' : 'inactive'}
                      </span>
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
          <h2>Add a reward</h2>
        </div>
        <ActionForm action={saveRewardAction} submitLabel="Add reward">
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required placeholder="Free pastry" />
            </div>
            <div className="field">
              <label htmlFor="stampsRequired">Stamps required</label>
              <input
                id="stampsRequired"
                name="stampsRequired"
                type="number"
                min={1}
                max={100}
                defaultValue={10}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" placeholder="A croissant or a bougatsa." />
          </div>
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="expiryDays">Expires after (days)</label>
              <input id="expiryDays" name="expiryDays" type="number" min={1} max={3650} />
            </div>
            <div className="field">
              <label className="checkbox" style={{ marginTop: '1.7rem' }}>
                <input type="checkbox" name="isActive" defaultChecked />
                <span>Active</span>
              </label>
            </div>
          </div>
        </ActionForm>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Recent reward activity</h2>
        </div>
        {redemptions.length === 0 ? (
          <p className="empty">No rewards earned yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Reward</th>
                  <th>Earned</th>
                  <th>Redeemed</th>
                  <th>Where</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.slice(0, 40).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.customer.firstName} {r.customer.lastName ?? ''}
                    </td>
                    <td>{r.reward?.name ?? 'Program reward'}</td>
                    <td>
                      <small>{new Date(r.earnedAt).toLocaleDateString()}</small>
                    </td>
                    <td>
                      {r.redeemedAt ? (
                        <small>{new Date(r.redeemedAt).toLocaleDateString()}</small>
                      ) : (
                        <span className="badge at_risk">waiting</span>
                      )}
                    </td>
                    <td>
                      <small className="hint">{r.location?.name ?? '—'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
