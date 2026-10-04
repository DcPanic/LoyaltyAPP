import { notFound } from 'next/navigation';
import { api, ApiError, apiUrl } from '@/lib/api';
import { BrandStyle, type Branding } from '@/components/Brand';

interface PosterData {
  business: Branding;
  program: { stampsRequired: number; rewardName: string };
}

export const metadata = {
  title: 'Counter poster',
  robots: { index: false, follow: false },
};

/**
 * The sheet a café prints and puts on the counter.
 *
 * Deliberately plain: a customer looks at this for about two seconds while
 * waiting for a coffee, so it says what they get, shows the code, and stops.
 * The café's own colour carries the branding; everything else is left white
 * because this is going through somebody's office printer.
 */
export default async function PosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data: PosterData;
  try {
    data = await api<PosterData>(`/v1/public/business/${slug}`, { auth: false });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <main className="poster">
      <BrandStyle business={data.business} />

      <div className="poster-sheet">
        {data.business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="poster-logo" src={data.business.logoUrl} alt="" />
        ) : (
          <div className="poster-logo poster-logo-letter">
            {data.business.name.charAt(0).toUpperCase()}
          </div>
        )}

        <h1>{data.business.name}</h1>

        <p className="poster-offer">
          <strong>{data.program.stampsRequired} stamps</strong> and {data.program.rewardName} is on
          us
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="poster-qr"
          src={`${apiUrl}/v1/public/qr/${encodeURIComponent(slug)}?size=1200`}
          alt={`QR code to join ${data.business.name}`}
        />

        <p className="poster-how">Point your camera here</p>
        <p className="poster-sub">
          Your card goes straight into Apple&nbsp;Wallet or Google&nbsp;Wallet.
          <br />
          No app to install.
        </p>
      </div>

      <p className="poster-note">
        Print this page, or save it as a PDF and send it to a print shop. A4 or Letter both work.
      </p>
    </main>
  );
}
