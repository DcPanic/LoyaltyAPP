import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { markSuggestionReadAction } from '@/app/actions/admin';

interface Note {
  id: string;
  message: string;
  contact: string | null;
  readAt: string | null;
  createdAt: string;
  customer: { id: string; firstName: string; lastName: string | null } | null;
}

export const metadata = { title: 'Notes — LoyaltyApp' };

function when(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  const days = Math.round(minutes / (60 * 24));
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default async function SuggestionsPage() {
  await requirePermission('customer:read');
  const { items, unread } = await api<{ items: Note[]; unread: number }>(
    '/v1/business/suggestions',
  );

  return (
    <>
      <div className="topbar">
        <h1>Notes</h1>
        {unread > 0 && <span className="badge">{unread} unread</span>}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>What customers told you</h2>
        </div>
        <p className="hint">
          Left from the page your counter code opens. Most are anonymous on purpose — someone about
          to complain should not have to give their name first — so a note with a way to reply is
          someone who actually wants an answer.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <div className="empty">
            Nothing yet. The note box appears on your counter page as long as it is switched on
            under <strong>Counter page</strong>.
          </div>
        </div>
      ) : (
        items.map((note) => (
          <div
            className="card"
            key={note.id}
            style={
              note.readAt
                ? undefined
                : { borderLeft: '4px solid var(--coffee)', background: 'var(--foam)' }
            }
          >
            <div className="card-header">
              <h2 style={{ fontSize: '1rem' }}>
                {note.customer
                  ? `${note.customer.firstName} ${note.customer.lastName ?? ''}`.trim()
                  : 'Anonymous'}
              </h2>
              <span className="hint">{when(note.createdAt)}</span>
            </div>

            <p style={{ whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>{note.message}</p>

            <div className="row">
              {note.contact ? (
                <a className="btn secondary" href={contactHref(note.contact)}>
                  Reply to {note.contact}
                </a>
              ) : (
                <span className="hint">No way to reply — they did not leave one.</span>
              )}

              {!note.readAt && (
                <ActionForm
                  action={markSuggestionReadAction}
                  submitLabel="Mark as read"
                  className="btn secondary"
                >
                  <input type="hidden" name="id" value={note.id} />
                </ActionForm>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}

/** A contact is whatever they typed, so guess at an email before a phone. */
function contactHref(contact: string): string {
  return contact.includes('@')
    ? `mailto:${contact}`
    : `tel:${contact.replace(/[^+\d]/g, '')}`;
}
