import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';

interface AuditEntry {
  id: string;
  actorLabel: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

const DESCRIPTION: Record<string, string> = {
  'stamp.add': 'added stamps',
  'stamp.remove': 'removed stamps',
  'stamp.adjust': 'corrected a balance',
  'reward.redeem': 'redeemed a reward',
  'customer.join': 'joined the program',
  'customer.create': 'added a customer',
  'customer.update': 'edited a customer',
  'customer.delete': 'erased a customer',
  'customer.export': 'exported customer data',
  'customer.export_csv': 'exported the customer list',
  'staff.invite': 'invited a staff member',
  'staff.update': 'changed staff access',
  'staff.deactivate': 'removed a staff member',
  'staff.accept_invite': 'accepted an invitation',
  'nfc.create': 'registered an NFC tag',
  'nfc.disable': 'disabled an NFC tag',
  'nfc.update': 'updated an NFC tag',
  'program.create': 'created a loyalty program',
  'program.update': 'changed the loyalty program',
  'reward.create': 'created a reward',
  'business.update': 'changed café settings',
  'business.register': 'created the café account',
  'location.create': 'added a location',
  'location.disable': 'closed a location',
  'campaign.create': 'created a campaign',
  'campaign.run': 'ran a campaign',
};

export const metadata = { title: 'Activity log — LoyaltyApp' };

export default async function AuditPage() {
  await requirePermission('audit:read');
  const { items } = await api<{ items: AuditEntry[] }>('/v1/audit?limit=100');

  return (
    <>
      <div className="topbar">
        <h1>Activity log</h1>
      </div>

      <div className="card">
        <p className="hint">
          Every action that touches stamps, customers, staff or tags is recorded here with who did
          it and when.
        </p>
        {items.length === 0 ? (
          <p className="empty">Nothing logged yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </td>
                    <td>{entry.actorLabel}</td>
                    <td>{DESCRIPTION[entry.action] ?? entry.action}</td>
                    <td>
                      <small className="hint">
                        {entry.metadata ? JSON.stringify(entry.metadata) : ''}
                      </small>
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
