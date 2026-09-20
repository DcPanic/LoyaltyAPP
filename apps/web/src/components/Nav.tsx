'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Permission } from '@loyaltyapp/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
  section?: string;
}

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '▤', permission: 'analytics:read' },
  { href: '/stamp', label: 'Stamp customer', icon: '☕' },
  { href: '/customers', label: 'Customers', icon: '👥', permission: 'customer:read' },
  { href: '/loyalty', label: 'Loyalty', icon: '🎫', permission: 'program:manage', section: 'Program' },
  { href: '/rewards', label: 'Rewards', icon: '🎁', permission: 'reward:manage' },
  { href: '/campaigns', label: 'Campaigns', icon: '📣', permission: 'campaign:manage' },
  { href: '/notifications', label: 'Notifications', icon: '🔔', permission: 'analytics:read' },
  { href: '/analytics', label: 'Analytics', icon: '📈', permission: 'analytics:read' },
  { href: '/staff', label: 'Staff', icon: '🧑‍🍳', permission: 'staff:manage', section: 'Café' },
  { href: '/locations', label: 'Locations', icon: '📍', permission: 'location:manage' },
  { href: '/nfc', label: 'NFC tags', icon: '📶', permission: 'nfc:manage' },
  { href: '/audit', label: 'Activity log', icon: '🗒', permission: 'audit:read' },
  { href: '/wallet', label: 'Wallet cards', icon: '💳', permission: 'settings:manage' },
  { href: '/settings', label: 'Settings', icon: '⚙', permission: 'settings:manage' },
  { href: '/billing', label: 'Billing', icon: '💳', permission: 'billing:manage' },
];

function visible(items: NavItem[], permissions: string[]): NavItem[] {
  return items.filter((i) => !i.permission || permissions.includes(i.permission));
}

export function Sidebar({
  permissions,
  businessName,
  logoUrl,
}: {
  permissions: string[];
  businessName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();
  const items = visible(NAV, permissions);

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span className="brand-mark">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            businessName.charAt(0).toUpperCase()
          )}
        </span>
        <span>{businessName}</span>
      </div>
      {items.map((item) => (
        <div key={item.href}>
          {item.section && <div className="nav-section">{item.section}</div>}
          <Link
            href={item.href}
            className="nav-link"
            aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}

export function MobileNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const items = visible(NAV, permissions).slice(0, 5);

  return (
    <nav className="mobile-nav" aria-label="Main">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
        >
          <span className="icon" aria-hidden>
            {item.icon}
          </span>
          {item.label.split(' ')[0]}
        </Link>
      ))}
    </nav>
  );
}
