/**
 * Roles and permissions. Authorization is always enforced server-side;
 * the frontends use this table only to decide what to render.
 */
export const ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'stamp:add',
  'stamp:remove',
  'reward:redeem',
  'customer:read',
  'customer:write',
  'customer:export',
  'customer:delete',
  'program:manage',
  'reward:manage',
  'campaign:manage',
  'analytics:read',
  'staff:manage',
  'location:manage',
  'nfc:manage',
  'settings:manage',
  'billing:manage',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Default permission set per role. A staff membership may override this list. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER: [
    'stamp:add',
    'stamp:remove',
    'reward:redeem',
    'customer:read',
    'customer:write',
    'customer:export',
    'program:manage',
    'reward:manage',
    'campaign:manage',
    'analytics:read',
    'location:manage',
    'nfc:manage',
    'audit:read',
  ],
  // Staff serve the counter: find the customer, sign up a new one, add stamps,
  // and hand over a reward that has been earned. Signing someone up matters for
  // phone and delivery orders, where the customer never stands in front of the
  // QR code and the barista is the only one who can start their card. They see
  // no takings, no settings and no other staff. A membership may narrow or
  // widen this per person.
  STAFF: ['stamp:add', 'customer:read', 'customer:write', 'reward:redeem'],
};

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(granted: readonly string[], required: Permission): boolean {
  return granted.includes(required);
}
