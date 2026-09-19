import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { BrandStyle, type Branding } from '@/components/Brand';
import { TapFlow } from './TapFlow';

interface TagData {
  business: Branding;
  location: { id: string; name: string } | null;
  program: { id: string; name: string; stampsRequired: number; rewardName: string };
  joinUrl: string;
}

export const metadata = {
  title: 'Adding your stamp…',
  robots: { index: false, follow: false },
};

/**
 * The page an NFC tap opens. It stays deliberately small: branding, one request,
 * one answer. No customer app, no login, no navigation.
 */
export default async function TapPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let tag: TagData;
  try {
    tag = await api<TagData>(`/v1/public/tag/${code}`, { auth: false });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      return (
        <main className="public">
          <div className="public-inner">
            <div className="card center">
              <h1>Tag not available</h1>
              <p className="hint">
                {err.status === 403
                  ? 'This stamp has been switched off by the café.'
                  : 'This stamp is not registered.'}
              </p>
            </div>
          </div>
        </main>
      );
    }
    notFound();
  }

  return (
    <main className="public">
      <div className="public-inner">
        <BrandStyle business={tag.business} />
        <div className="public-logo" style={{ background: tag.business.primaryColor }}>
          {tag.business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tag.business.logoUrl} alt="" />
          ) : (
            tag.business.name.charAt(0).toUpperCase()
          )}
        </div>
        <h1 className="center">{tag.business.name}</h1>
        {tag.location && <p className="center hint">{tag.location.name}</p>}

        <div className="card">
          <TapFlow
            code={code}
            joinUrl={tag.joinUrl}
            rewardName={tag.program.rewardName}
            stampsRequired={tag.program.stampsRequired}
          />
        </div>
      </div>
    </main>
  );
}
