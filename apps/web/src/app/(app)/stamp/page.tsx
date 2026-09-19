import { requireSession } from '@/lib/session';
import { api } from '@/lib/api';
import { StampConsole } from './StampConsole';
import { LiveRefresh } from '@/components/LiveRefresh';

interface LocationsResponse {
  items: { id: string; name: string; isActive: boolean }[];
}

export const metadata = { title: 'Stamp customer — LoyaltyApp' };

export default async function StampPage() {
  const session = await requireSession();
  const locations = await api<LocationsResponse>('/v1/business/locations').catch(() => ({
    items: [],
  }));

  return (
    <>
      <div className="topbar">
        <h1>Stamp customer</h1>
        <LiveRefresh />
      </div>
      <StampConsole
        locations={locations.items.filter((l) => l.isActive)}
        canRedeem={session.user.permissions.includes('reward:redeem')}
        canRemove={session.user.permissions.includes('stamp:remove')}
      />
    </>
  );
}
