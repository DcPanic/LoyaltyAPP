import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { runCampaignAction, saveCampaignAction } from '@/app/actions/admin';

interface Campaign {
  id: string;
  name: string;
  type: string;
  message: string;
  segments: string[];
  startsAt: string | null;
  endsAt: string | null;
  stampMultiplier: number;
  isActive: boolean;
  lastRunAt: string | null;
  sentCount: number;
}

const TYPES = [
  ['DOUBLE_STAMP', 'Double stamp day — every stamp counts twice while it runs'],
  ['BIRTHDAY', 'Birthday reward — customers whose birthday is today'],
  ['WIN_BACK', 'Win back — customers who stopped coming'],
  ['VIP_OFFER', 'VIP offer — your most frequent customers'],
  ['ANNOUNCEMENT', 'Announcement — anyone who agreed to marketing'],
] as const;

const SEGMENTS = ['NEW', 'ACTIVE', 'VIP', 'AT_RISK', 'LOST'] as const;

export const metadata = { title: 'Campaigns — LoyaltyApp' };

export default async function CampaignsPage() {
  await requirePermission('campaign:manage');
  const { items } = await api<{ items: Campaign[] }>('/v1/campaigns');

  return (
    <>
      <div className="topbar">
        <h1>Campaigns</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Your campaigns</h2>
        </div>
        {items.length === 0 ? (
          <p className="empty">No campaigns yet.</p>
        ) : (
          <div className="grid">
            {items.map((c) => (
              <div key={c.id} className="search-result" style={{ cursor: 'default' }}>
                <div>
                  <strong>{c.name}</strong>{' '}
                  <span className={`badge ${c.isActive ? 'ok' : 'off'}`}>
                    {c.isActive ? 'active' : 'paused'}
                  </span>
                  <br />
                  <small className="hint">
                    {c.type.replace('_', ' ').toLowerCase()}
                    {c.type === 'DOUBLE_STAMP' ? ` ×${c.stampMultiplier}` : ''} ·{' '}
                    {c.segments.length > 0 ? c.segments.join(', ').toLowerCase() : 'all segments'}
                    {c.lastRunAt
                      ? ` · last run ${new Date(c.lastRunAt).toLocaleDateString()} (${c.sentCount} reached)`
                      : ''}
                  </small>
                  <br />
                  <small>{c.message}</small>
                </div>
                <ActionForm action={runCampaignAction} submitLabel="Run now" className="btn secondary">
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Create a campaign</h2>
        </div>
        <p className="hint">
          Campaigns only ever reach customers who agreed to marketing. A double stamp campaign
          applies automatically at the counter while it is active — nothing to send.
        </p>
        <ActionForm action={saveCampaignAction} submitLabel="Save campaign">
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="name">Campaign name</label>
              <input id="name" name="name" required placeholder="Rainy Monday double stamps" />
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <select id="type" name="type" defaultValue="DOUBLE_STAMP">
                {TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              required
              maxLength={300}
              placeholder="Today every coffee gives you two stamps ☕☕"
            />
          </div>

          <div className="grid cols-3">
            <div className="field">
              <label htmlFor="startsAt">Starts</label>
              <input id="startsAt" name="startsAt" type="datetime-local" />
            </div>
            <div className="field">
              <label htmlFor="endsAt">Ends</label>
              <input id="endsAt" name="endsAt" type="datetime-local" />
            </div>
            <div className="field">
              <label htmlFor="stampMultiplier">Stamp multiplier</label>
              <input
                id="stampMultiplier"
                name="stampMultiplier"
                type="number"
                min={1}
                max={5}
                defaultValue={2}
              />
            </div>
          </div>

          <div className="field">
            <label>Target segments</label>
            <div className="row">
              {SEGMENTS.map((s) => (
                <label key={s} className="checkbox" style={{ marginRight: '0.9rem' }}>
                  <input type="checkbox" name="segments" value={s} />
                  <span>{s.replace('_', ' ').toLowerCase()}</span>
                </label>
              ))}
            </div>
            <small className="hint">Leave all unticked to target every eligible customer.</small>
          </div>

          <div className="field">
            <label className="checkbox">
              <input type="checkbox" name="isActive" defaultChecked />
              <span>Active</span>
            </label>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
