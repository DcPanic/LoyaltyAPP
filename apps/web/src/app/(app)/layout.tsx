import { requireSession } from '@/lib/session';
import { MobileNav, Sidebar } from '@/components/Nav';
import { logoutAction } from '@/app/actions/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="shell">
      <Sidebar
        permissions={session.user.permissions}
        businessName={session.business.name}
        logoUrl={session.business.logoUrl}
      />
      <div className="main">
        <header className="topbar">
          <div>
            <small className="hint">{session.business.name}</small>
            <div style={{ fontWeight: 600 }}>{session.user.name}</div>
          </div>
          <form action={logoutAction}>
            <button className="btn secondary" type="submit">
              Sign out
            </button>
          </form>
        </header>
        {children}
      </div>
      <MobileNav permissions={session.user.permissions} />
    </div>
  );
}
