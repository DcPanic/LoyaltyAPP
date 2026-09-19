export interface Branding {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  addressLine: string | null;
  city: string | null;
  contactPhone: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
}

/** Applies the café's own colours to the customer-facing page. */
export function BrandStyle({ business }: { business: Pick<Branding, 'primaryColor' | 'secondaryColor'> }) {
  return (
    <style>{`.public{--brand:${business.primaryColor};--brand-secondary:${business.secondaryColor};}
.public .btn{background:${business.primaryColor};}
.public .stamp-dot.filled{background:${business.primaryColor};border-color:${business.primaryColor};}
.public .progress>span{background:${business.primaryColor};}`}</style>
  );
}

export function BrandHeader({ business }: { business: Branding }) {
  return (
    <>
      <BrandStyle business={business} />
      {business.coverImageUrl ? (
        <div
          className="public-cover"
          style={{
            backgroundImage: `url(${business.coverImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        <div className="public-cover" style={{ background: business.secondaryColor }} />
      )}
      <div className="public-logo" style={{ background: business.primaryColor }}>
        {business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logoUrl} alt="" />
        ) : (
          business.name.charAt(0).toUpperCase()
        )}
      </div>
      <h1 className="center">{business.name}</h1>
    </>
  );
}
