import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { updateProgramAction } from '@/app/actions/admin';

interface Program {
  id: string;
  name: string;
  description: string | null;
  stampsRequired: number;
  rewardName: string;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  rewardExpiryDays: number | null;
  allowedStampAmounts: number[];
  maxStampsPerVisit: number;
  selfServiceCooldownSeconds: number;
  shareAcrossLocations: boolean;
  isActive: boolean;
  _count: { memberships: number };
}

export const metadata = { title: 'Loyalty program — LoyaltyApp' };

export default async function LoyaltyPage() {
  await requirePermission('program:manage');
  const { items } = await api<{ items: Program[] }>('/v1/programs');
  const program = items[0];

  return (
    <>
      <div className="topbar">
        <h1>Loyalty program</h1>
        {program && <span className="badge">{program._count.memberships} members</span>}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>{program ? 'Program settings' : 'Create your program'}</h2>
        </div>
        <ActionForm action={updateProgramAction} submitLabel="Save program">
          {program && <input type="hidden" name="id" value={program.id} />}

          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="name">Program name</label>
              <input id="name" name="name" defaultValue={program?.name ?? 'Coffee Loyalty'} required />
            </div>
            <div className="field">
              <label htmlFor="stampsRequired">Stamps needed for a reward</label>
              <input
                id="stampsRequired"
                name="stampsRequired"
                type="number"
                min={1}
                max={100}
                defaultValue={program?.stampsRequired ?? 10}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Description shown on the join page</label>
            <textarea
              id="description"
              name="description"
              defaultValue={program?.description ?? 'Collect stamps with every coffee.'}
            />
          </div>

          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="rewardName">Reward name</label>
              <input
                id="rewardName"
                name="rewardName"
                defaultValue={program?.rewardName ?? 'Free coffee'}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rewardExpiryDays">Reward expires after (days)</label>
              <input
                id="rewardExpiryDays"
                name="rewardExpiryDays"
                type="number"
                min={1}
                max={3650}
                defaultValue={program?.rewardExpiryDays ?? 90}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="rewardDescription">Reward description</label>
            <textarea
              id="rewardDescription"
              name="rewardDescription"
              defaultValue={program?.rewardDescription ?? 'Any coffee of your choice, on us.'}
            />
          </div>

          <div className="field">
            <label htmlFor="rewardImageUrl">Reward picture (PNG)</label>
            <input
              id="rewardImageUrl"
              name="rewardImageUrl"
              type="text"
              placeholder="https://…/free-coffee.png"
              defaultValue={program?.rewardImageUrl ?? ''}
            />
            <p className="hint">
              Shown on the join page and across the middle of the wallet card. A wide picture works
              best — roughly 750 by 196. Leave it empty to use your secondary colour instead.
            </p>
            {program?.rewardImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={program.rewardImageUrl}
                alt="Reward"
                style={{ marginTop: '0.5rem', maxWidth: '100%', borderRadius: 8 }}
              />
            )}
          </div>

          <div className="grid cols-3">
            <div className="field">
              <label htmlFor="allowedStampAmounts">Quick stamp buttons</label>
              <input
                id="allowedStampAmounts"
                name="allowedStampAmounts"
                defaultValue={(program?.allowedStampAmounts ?? [1, 2, 3, 5, 10]).join(', ')}
              />
              <small className="hint">Comma separated, shown to staff.</small>
            </div>
            <div className="field">
              <label htmlFor="maxStampsPerVisit">Maximum per transaction</label>
              <input
                id="maxStampsPerVisit"
                name="maxStampsPerVisit"
                type="number"
                min={1}
                max={50}
                defaultValue={program?.maxStampsPerVisit ?? 10}
              />
            </div>
            <div className="field">
              <label htmlFor="selfServiceCooldownSeconds">NFC/QR cooldown (seconds)</label>
              <input
                id="selfServiceCooldownSeconds"
                name="selfServiceCooldownSeconds"
                type="number"
                min={0}
                max={86400}
                defaultValue={program?.selfServiceCooldownSeconds ?? 900}
              />
              <small className="hint">Stops one customer tapping the stamp repeatedly.</small>
            </div>
          </div>

          <div className="field">
            <label className="checkbox">
              <input
                type="checkbox"
                name="shareAcrossLocations"
                defaultChecked={program?.shareAcrossLocations ?? true}
              />
              <span>One card across all my locations</span>
            </label>
          </div>
          <div className="field">
            <label className="checkbox">
              <input type="checkbox" name="isActive" defaultChecked={program?.isActive ?? true} />
              <span>Program is active and accepting new members</span>
            </label>
          </div>
        </ActionForm>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>How stamping works</h2>
        </div>
        <ul className="hint" style={{ paddingLeft: '1.1rem' }}>
          <li>Staff scan the customer&apos;s wallet QR, or search by phone for delivery orders.</li>
          <li>Customers can tap the NFC stamp on the counter — their phone opens a page that stamps their own card.</li>
          <li>Every stamp is recorded once, even if a request is retried, and updates the wallet pass.</li>
          <li>When the balance reaches the target the card shows the reward until a barista redeems it.</li>
        </ul>
      </div>
    </>
  );
}
