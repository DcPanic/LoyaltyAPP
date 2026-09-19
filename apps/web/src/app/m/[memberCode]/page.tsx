import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { BrandHeader, type Branding } from '@/components/Brand';
import { StampGrid, StampProgress } from '@/components/StampGrid';
import { QrCode } from '@/components/QrCode';
import { WalletButtons } from '@/components/WalletButtons';
import { RememberMe } from './RememberMe';
import { ConsentToggle } from './ConsentToggle';

interface MemberData {
  business: Branding;
  program: {
    name: string;
    stampsRequired: number;
    rewardName: string;
    rewardDescription: string | null;
  };
  customer: { firstName: string };
  membership: {
    stamps: number;
    stampsRequired: number;
    rewardAvailable: boolean;
    totalStamps: number;
    rewardsRedeemed: number;
  };
  memberCode: string;
  memberToken: string;
  wallet: { apple: string | null; google: string | null };
}

export const metadata = { title: 'My loyalty card' };

export default async function MemberPage({
  params,
}: {
  params: Promise<{ memberCode: string }>;
}) {
  const { memberCode } = await params;

  let data: MemberData;
  try {
    data = await api<MemberData>(`/v1/public/member/${memberCode}`, { auth: false });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { membership, program } = data;
  const remaining = Math.max(0, membership.stampsRequired - membership.stamps);

  return (
    <main className="public">
      <div className="public-inner">
        <RememberMe memberCode={data.memberCode} />
        <BrandHeader business={data.business} />
        <p className="center hint">Hi {data.customer.firstName} — here is your card</p>

        <div className="card">
          {membership.rewardAvailable ? (
            <div className="alert success" style={{ textAlign: 'center' }}>
              🎁 {program.rewardName} is ready — show this card to the barista.
            </div>
          ) : (
            <p className="center">
              <strong>{remaining}</strong> more {remaining === 1 ? 'stamp' : 'stamps'} until{' '}
              {program.rewardName}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0' }}>
            <StampGrid stamps={membership.stamps} required={membership.stampsRequired} />
          </div>
          <StampProgress stamps={membership.stamps} required={membership.stampsRequired} />
          <p className="center hint" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            {membership.stamps} / {membership.stampsRequired} stamps · {membership.totalStamps}{' '}
            collected all-time · {membership.rewardsRedeemed} rewards enjoyed
          </p>
        </div>

        <div className="card center">
          <h3>Show this to the barista</h3>
          <div className="qr-box">
            <QrCode value={data.memberCode} />
          </div>
          <p className="member-code" style={{ marginTop: '0.75rem' }}>
            {data.memberCode}
          </p>
        </div>

        <div className="card">
          <h3 className="center">Keep it in your wallet</h3>
          <WalletButtons
            wallet={data.wallet}
            available={{ apple: Boolean(data.wallet.apple), google: Boolean(data.wallet.google) }}
          />
        </div>

        <div className="card">
          <ConsentToggle memberCode={data.memberCode} memberToken={data.memberToken} />
          <p className="hint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            {data.business.name}
            {data.business.addressLine ? ` · ${data.business.addressLine}` : ''}
            {data.business.contactPhone ? ` · ${data.business.contactPhone}` : ''}
          </p>
        </div>
      </div>
    </main>
  );
}
