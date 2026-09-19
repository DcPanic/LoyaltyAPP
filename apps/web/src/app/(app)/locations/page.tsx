import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';
import { ActionForm } from '@/components/ActionForm';
import { saveLocationAction } from '@/app/actions/admin';

interface LocationRow {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  phone: string | null;
  isActive: boolean;
}

export const metadata = { title: 'Locations — LoyaltyApp' };

export default async function LocationsPage() {
  await requirePermission('location:manage');
  const { items } = await api<{ items: LocationRow[] }>('/v1/business/locations');

  return (
    <>
      <div className="topbar">
        <h1>Locations</h1>
      </div>

      <div className="grid cols-2">
        {items.map((location) => (
          <div key={location.id} className="card">
            <div className="card-header">
              <h3 style={{ marginBottom: 0 }}>{location.name}</h3>
              <span className={`badge ${location.isActive ? 'ok' : 'off'}`}>
                {location.isActive ? 'open' : 'closed'}
              </span>
            </div>
            <ActionForm action={saveLocationAction} submitLabel="Save" className="btn secondary">
              <input type="hidden" name="id" value={location.id} />
              <div className="field">
                <label htmlFor={`name-${location.id}`}>Name</label>
                <input id={`name-${location.id}`} name="name" defaultValue={location.name} required />
              </div>
              <div className="field">
                <label htmlFor={`address-${location.id}`}>Address</label>
                <input
                  id={`address-${location.id}`}
                  name="addressLine"
                  defaultValue={location.addressLine ?? ''}
                />
              </div>
              <div className="grid cols-2">
                <div className="field">
                  <label htmlFor={`city-${location.id}`}>City</label>
                  <input id={`city-${location.id}`} name="city" defaultValue={location.city ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor={`phone-${location.id}`}>Phone</label>
                  <input
                    id={`phone-${location.id}`}
                    name="phone"
                    type="tel"
                    defaultValue={location.phone ?? ''}
                  />
                </div>
              </div>
              <div className="field">
                <label className="checkbox">
                  <input type="checkbox" name="isActive" defaultChecked={location.isActive} />
                  <span>Open for business</span>
                </label>
              </div>
            </ActionForm>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Add a location</h2>
        </div>
        <ActionForm action={saveLocationAction} submitLabel="Add location">
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="new-name">Name</label>
              <input id="new-name" name="name" required placeholder="Strovolos" />
            </div>
            <div className="field">
              <label htmlFor="new-city">City</label>
              <input id="new-city" name="city" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-address">Address</label>
            <input id="new-address" name="addressLine" />
          </div>
        </ActionForm>
      </div>
    </>
  );
}
