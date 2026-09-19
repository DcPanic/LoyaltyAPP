import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';

interface Billing {
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  usage: { customers: number; stampsThisMonth: number };
  stripeConfigured: boolean;
}

export const metadata = { title: 'Billing — LoyaltyApp' };

export default async function BillingPage() {
  await requirePermission('billing:manage');
  const billing = await api<Billing>('/v1/billing');

  return (
    <>
      <div className="topbar">
        <h1>Billing</h1>
      </div>

      <div className="grid cols-3">
        <div className="stat">
          <div className="label">Plan</div>
          <div className="value" style={{ fontSize: '1.4rem' }}>
            {billing.subscription?.plan ?? 'starter'}
          </div>
          <div className="hint">{billing.subscription?.status.toLowerCase() ?? 'trialing'}</div>
        </div>
        <div className="stat">
          <div className="label">Customers</div>
          <div className="value">{billing.usage.customers}</div>
          <div className="hint">You are never charged per loyalty card</div>
        </div>
        <div className="stat">
          <div className="label">Stamps this month</div>
          <div className="value">{billing.usage.stampsThisMonth}</div>
          <div className="hint">Included in your subscription</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Your subscription</h2>
        </div>
        {billing.subscription?.trialEndsAt && (
          <p>
            Your trial runs until{' '}
            <strong>{new Date(billing.subscription.trialEndsAt).toLocaleDateString()}</strong>.
          </p>
        )}
        <p className="hint">
          The café pays one subscription. Customers never pay, staff accounts are free, and there is
          no per-wallet-pass fee — the wallet passes are issued by this platform with your own Apple
          and Google credentials.
        </p>
        {billing.stripeConfigured ? (
          <button className="btn" disabled>
            Manage payment method
          </button>
        ) : (
          <div className="alert info">
            Card payments are not switched on for this deployment yet. Add your Stripe keys to the
            API environment to enable checkout.
          </div>
        )}
      </div>
    </>
  );
}
