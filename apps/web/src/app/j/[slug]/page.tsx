import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { BrandHeader, type Branding } from '@/components/Brand';
import { JoinForm } from './JoinForm';

interface JoinPageData {
  business: Branding;
  program: {
    id: string;
    name: string;
    description: string | null;
    stampsRequired: number;
    rewardName: string;
    rewardDescription: string | null;
    rewardImageUrl: string | null;
  };
  wallet: { apple: boolean; google: boolean };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await api<JoinPageData>(`/v1/public/business/${slug}`, { auth: false });
    return {
      title: `${data.business.name} — loyalty card`,
      description: `Collect ${data.program.stampsRequired} stamps and get ${data.program.rewardName}.`,
    };
  } catch {
    return { title: 'Loyalty card' };
  }
}

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data: JoinPageData;
  try {
    data = await api<JoinPageData>(`/v1/public/business/${slug}`, { auth: false });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <main className="public">
      <div className="public-inner">
        <BrandHeader business={data.business} />
        <p className="center hint">Join our loyalty program</p>

        <div className="card center" style={{ marginTop: '1rem' }}>
          <h2>
            Collect {data.program.stampsRequired} stamps, get {data.program.rewardName}
          </h2>
          <p className="hint" style={{ marginBottom: 0 }}>
            {data.program.rewardDescription ??
              data.program.description ??
              'Your card lives in Apple Wallet or Google Wallet — no app to install.'}
          </p>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <JoinForm
            slug={slug}
            business={data.business}
            wallet={data.wallet}
            stampsRequired={data.program.stampsRequired}
            rewardName={data.program.rewardName}
          />
        </div>

        <p className="center hint" style={{ marginTop: '1rem' }}>
          {data.business.termsUrl && (
            <a href={data.business.termsUrl} target="_blank" rel="noreferrer">
              Terms
            </a>
          )}
          {data.business.termsUrl && data.business.privacyPolicyUrl && ' · '}
          {data.business.privacyPolicyUrl && (
            <a href={data.business.privacyPolicyUrl} target="_blank" rel="noreferrer">
              Privacy policy
            </a>
          )}
        </p>
      </div>
    </main>
  );
}
