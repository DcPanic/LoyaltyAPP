import { api, ApiError } from '@/lib/api';
import { InviteForm } from './InviteForm';

interface InviteInfo {
  email: string;
  name: string;
  role: string;
  businessName: string;
  businessLogo: string | null;
}

export const metadata = { title: 'Join your team — LoyaltyApp' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let invite: InviteInfo | null = null;
  let error: string | null = null;
  try {
    invite = await api<InviteInfo>(`/v1/auth/invite/${token}`, { auth: false });
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'This invitation is no longer valid';
  }

  return (
    <main className="public">
      <div className="public-inner">
        <div className="public-logo" aria-hidden>
          {invite?.businessName?.[0] ?? '☕'}
        </div>
        {error || !invite ? (
          <div className="card">
            <div className="alert error">{error}</div>
            <p className="hint">Ask the café owner to send you a new invitation link.</p>
          </div>
        ) : (
          <>
            <h1 className="center">Join {invite.businessName}</h1>
            <p className="center hint">
              You were invited as <strong>{invite.role.toLowerCase()}</strong> ({invite.email}).
            </p>
            <div className="card">
              <InviteForm token={token} defaultName={invite.name} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
