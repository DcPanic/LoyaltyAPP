import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { createTagAction, toggleTagAction } from '@/app/actions/admin';
import { TagQr } from './TagQr';

interface Tag {
  id: string;
  label: string;
  code: string;
  isActive: boolean;
  tapCount: number;
  lastActivityAt: string | null;
  location: { id: string; name: string } | null;
  tapUrl: string;
  createdAt: string;
}

export const metadata = { title: 'NFC tags — LoyaltyApp' };

export default async function NfcPage() {
  await requirePermission('nfc:manage');
  const [{ items }, locations] = await Promise.all([
    api<{ items: Tag[] }>('/v1/nfc'),
    api<{ items: { id: string; name: string }[] }>('/v1/business/locations'),
  ]);

  return (
    <>
      <div className="topbar">
        <h1>NFC tags</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>How it works</h2>
        </div>
        <p className="hint">
          Put a cheap NTAG213 sticker inside your 3D-printed stamp and write the tag link to it.
          When a customer taps it, their phone opens a page that adds one stamp to their own card —
          no app, no login. Print the same link as a QR code next to the stamp as a fallback for
          phones that cannot read NFC. The tag identifies your café only; it never carries customer
          data, and a lost tag can be switched off here immediately.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Register a tag</h2>
        </div>
        <ActionForm action={createTagAction} submitLabel="Register tag">
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="label">Label</label>
              <input id="label" name="label" required placeholder="Counter stamp — Nicosia" />
            </div>
            <div className="field">
              <label htmlFor="locationId">Location</label>
              <select id="locationId" name="locationId" defaultValue="">
                <option value="">No specific location</option>
                {locations.items.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </ActionForm>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <p className="empty">No tags registered yet.</p>
        </div>
      ) : (
        <div className="grid cols-2">
          {items.map((tag) => (
            <div key={tag.id} className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ marginBottom: 0 }}>{tag.label}</h3>
                  <small className="hint">
                    {tag.location?.name ?? 'All locations'} · {tag.tapCount} taps
                    {tag.lastActivityAt
                      ? ` · last ${new Date(tag.lastActivityAt).toLocaleDateString()}`
                      : ''}
                  </small>
                </div>
                <span className={`badge ${tag.isActive ? 'ok' : 'off'}`}>
                  {tag.isActive ? 'active' : 'disabled'}
                </span>
              </div>

              <TagQr url={tag.tapUrl} code={tag.code} />

              <ActionForm
                action={toggleTagAction}
                submitLabel={tag.isActive ? 'Disable tag' : 'Enable tag'}
                className={tag.isActive ? 'btn danger' : 'btn'}
              >
                <input type="hidden" name="id" value={tag.id} />
                <input type="hidden" name="isActive" value={tag.isActive ? 'false' : 'true'} />
              </ActionForm>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
