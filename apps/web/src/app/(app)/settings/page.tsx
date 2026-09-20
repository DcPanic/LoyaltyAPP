import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { ImageField } from '@/components/ImageField';
import { updateBusinessAction } from '@/app/actions/admin';

interface BusinessSettings {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string;
  currency: string;
  timezone: string;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  joinUrl: string;
}

export const metadata = { title: 'Settings — LoyaltyApp' };

export default async function SettingsPage() {
  await requirePermission('settings:manage');
  const business = await api<BusinessSettings>('/v1/business');

  return (
    <>
      <div className="topbar">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Branding</h2>
          <small className="hint">Used on wallet cards, the join page and every customer screen</small>
        </div>
        <ActionForm action={updateBusinessAction} submitLabel="Save settings">
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="name">Café name</label>
              <input id="name" name="name" defaultValue={business.name} required />
            </div>
            <div className="field">
              <label htmlFor="joinUrl">Public join link</label>
              <input id="joinUrl" readOnly value={business.joinUrl} />
            </div>
            <ImageField
              name="logoUrl"
              kind="logo"
              label="Logo"
              hint="Goes on the wallet card and the join page. A square picture works best."
              defaultValue={business.logoUrl}
            />
            <ImageField
              name="coverImageUrl"
              kind="cover"
              label="Cover picture"
              hint="The wide picture at the top of the join page."
              defaultValue={business.coverImageUrl}
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="primaryColor">Primary colour</label>
              <input
                id="primaryColor"
                name="primaryColor"
                type="color"
                defaultValue={business.primaryColor}
              />
            </div>
            <div className="field">
              <label htmlFor="secondaryColor">Secondary colour</label>
              <input
                id="secondaryColor"
                name="secondaryColor"
                type="color"
                defaultValue={business.secondaryColor}
              />
            </div>
          </div>

          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="contactEmail">Contact email</label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={business.contactEmail ?? ''}
              />
            </div>
            <div className="field">
              <label htmlFor="contactPhone">Contact phone</label>
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                defaultValue={business.contactPhone ?? ''}
              />
            </div>
            <div className="field">
              <label htmlFor="addressLine">Address</label>
              <input id="addressLine" name="addressLine" defaultValue={business.addressLine ?? ''} />
            </div>
            <div className="field">
              <label htmlFor="city">City</label>
              <input id="city" name="city" defaultValue={business.city ?? ''} />
            </div>
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <input id="currency" name="currency" defaultValue={business.currency} maxLength={3} />
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone</label>
              <input id="timezone" name="timezone" defaultValue={business.timezone} />
            </div>
          </div>

          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="privacyPolicyUrl">Privacy policy URL</label>
              <input
                id="privacyPolicyUrl"
                name="privacyPolicyUrl"
                defaultValue={business.privacyPolicyUrl ?? ''}
              />
            </div>
            <div className="field">
              <label htmlFor="termsUrl">Terms URL</label>
              <input id="termsUrl" name="termsUrl" defaultValue={business.termsUrl ?? ''} />
            </div>
          </div>
          <p className="hint">
            Cyprus and the EU: link your privacy policy and terms here. They appear on the join page
            and on the back of the wallet card, where customers can also withdraw marketing consent.
          </p>
        </ActionForm>
      </div>
    </>
  );
}
