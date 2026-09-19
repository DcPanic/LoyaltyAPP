import type { NextFunction, Request, Response } from 'express';
import { permissionsForRole, type Permission, type Role } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  businessId: string;
  membershipId: string;
  role: Role;
  permissions: Permission[];
  /** Empty array means "all locations of this business". */
  locationIds: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.access_token;
  return cookie ?? null;
}

/**
 * Resolves the caller's tenant from the signed token and re-reads the staff
 * membership on every request, so a revoked staff member loses access at once.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearer(req);
    if (!token) throw unauthorized();
    const claims = verifyAccessToken(token);

    const membership = await prisma.staffMembership.findUnique({
      where: { id: claims.mid },
      include: { user: true },
    });
    if (!membership || !membership.isActive || membership.userId !== claims.sub) {
      throw unauthorized('Session is no longer valid');
    }
    if (!membership.user.isActive) throw unauthorized('Account disabled');
    if (membership.businessId !== claims.bid) throw unauthorized('Session is no longer valid');

    const role = membership.role as Role;
    const permissions = (
      membership.permissions.length > 0 ? membership.permissions : permissionsForRole(role)
    ) as Permission[];

    req.auth = {
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      businessId: membership.businessId,
      membershipId: membership.id,
      role,
      permissions,
      locationIds: membership.locationIds,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function auth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const ctx = auth(req);
      const ok = required.some((p) => ctx.permissions.includes(p));
      if (!ok) throw forbidden(`Missing permission: ${required.join(' or ')}`);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Staff limited to certain locations may not act on another location. */
export function assertLocationAccess(ctx: AuthContext, locationId?: string | null): void {
  if (!locationId) return;
  if (ctx.locationIds.length === 0) return;
  if (!ctx.locationIds.includes(locationId)) {
    throw forbidden('You do not have access to this location');
  }
}
