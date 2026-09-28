import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import {
  addLinkAction,
  deleteLinkAction,
  updateCounterPageAction,
  updateLinkAction,
} from '@/app/actions/admin';
import { LinkKindPicker } from './LinkKindPicker';

interface BusinessLink {
  id: string;
  kind: string;
  label: string;
  url: string | null;
  value: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Business {
  slug: string;
  joinUrl: string;
  suggestionsEnabled: boolean;
  gameEnabled: boolean;
}

export const metadata = { title: 'Counter page — LoyaltyApp' };

export default async function LinksPage() {
  await requirePermission('settings:manage');
  const [{ items }, business] = await Promise.all([
    api<{ items: BusinessLink[] }>('/v1/business/links'),
    api<Business>('/v1/business'),
  ]);

  return (
    <>
      <div className="topbar">
        <h1>Counter page</h1>
        <a className="btn secondary" href={business.joinUrl} target="_blank" rel="noreferrer">
          Open it
        </a>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>What your QR code opens</h2>
        </div>
        <p className="hint">
          This is the page a customer reaches by scanning the code on your counter. The loyalty card
          is always first. Everything you add here follows it, in this order.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Add a row</h2>
        </div>
        <ActionForm action={addLinkAction} submitLabel="Add">
          <LinkKindPicker />
        </ActionForm>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Your rows</h2>
          <span className="hint">{items.length} added</span>
        </div>

        {items.length === 0 ? (
          <p className="hint">
            Nothing yet. Your Instagram and your menu are the two most people add first.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {items.map((link, index) => (
              <div key={link.id} className="search-result" style={{ cursor: 'default' }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{link.label}</strong>
                  <div className="hint" style={{ wordBreak: 'break-all' }}>
                    {link.kind.toLowerCase()}
                    {link.kind === 'WIFI' ? ` · password: ${link.value ?? ''}` : ` · ${link.url ?? ''}`}
                    {link.isActive ? '' : ' · hidden'}
                  </div>
                </div>

                <div className="row">
                  {/* Order is a number rather than dragging: it survives a page
                      reload, works on a phone, and needs no JavaScript. */}
                  <ActionForm action={updateLinkAction} submitLabel="↑" className="btn secondary">
                    <input type="hidden" name="id" value={link.id} />
                    <input type="hidden" name="sortOrder" value={Math.max(0, index - 1)} />
                  </ActionForm>
                  <ActionForm action={updateLinkAction} submitLabel="↓" className="btn secondary">
                    <input type="hidden" name="id" value={link.id} />
                    <input type="hidden" name="sortOrder" value={index + 1} />
                  </ActionForm>
                  <ActionForm
                    action={updateLinkAction}
                    submitLabel={link.isActive ? 'Hide' : 'Show'}
                    className="btn secondary"
                  >
                    <input type="hidden" name="id" value={link.id} />
                    <input type="hidden" name="isActive" value={link.isActive ? '0' : '1'} />
                  </ActionForm>
                  <ActionForm action={deleteLinkAction} submitLabel="Remove" className="btn secondary">
                    <input type="hidden" name="id" value={link.id} />
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>The two extras</h2>
        </div>
        <ActionForm action={updateCounterPageAction} submitLabel="Save">
          <label className="checkbox">
            <input
              type="checkbox"
              name="suggestionsEnabled"
              defaultChecked={business.suggestionsEnabled}
            />
            <span>
              <strong>Leave us a note</strong> — customers can write to you. Anonymous unless they
              leave a way to be answered. You read them under <em>Notes</em>.
            </span>
          </label>
          <label className="checkbox">
            <input type="checkbox" name="gameEnabled" defaultChecked={business.gameEnabled} />
            <span>
              <strong>Play while you wait</strong> — a small memory game on the page. Nothing is
              recorded; it is only there to keep someone on your page a little longer.
            </span>
          </label>
        </ActionForm>
      </div>
    </>
  );
}
