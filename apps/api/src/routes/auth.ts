import { Router } from 'express';
import {
  acceptInviteSchema,
  loginSchema,
  permissionsForRole,
  refreshSchema,
  registerSchema,
  type Permission,
  type Role,
} from '@loyaltyapp/shared';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { conflict, unauthorized } from '../lib/errors.js';
import {
  hashPassword,
  randomToken,
  sha256,
  slugify,
  verifyPassword,
} from '../lib/crypto.js';
import { signAccessToken, verifyInviteToken } from '../lib/tokens.js';
import { requireAuth, auth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { recordAudit } from '../services/audit.js';

export const authRouter: Router = Router();

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await prisma.business.findUnique({ where: { slug: candidate } });
    if (!clash) return candidate;
  }
  return `${base}-${randomToken(4).toLowerCase()}`;
}

async function issueSession(userId: string, businessId: string, membershipId: string, userAgent?: string) {
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      userAgent: userAgent?.slice(0, 200) ?? null,
    },
  });
  return {
    accessToken: signAccessToken({ sub: userId, bid: businessId, mid: membershipId }),
    refreshToken,
  };
}

async function sessionPayload(userId: string, businessId: string) {
  const membership = await prisma.staffMembership.findUnique({
    where: { businessId_userId: { businessId, userId } },
    include: { user: true, business: true },
  });
  if (!membership) throw unauthorized();
  const role = membership.role as Role;
  return {
    user: {
      id: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      businessId,
      role,
      permissions: (membership.permissions.length > 0
        ? membership.permissions
        : permissionsForRole(role)) as Permission[],
      locationIds: membership.locationIds,
    },
    business: {
      id: membership.business.id,
      name: membership.business.name,
      slug: membership.business.slug,
      primaryColor: membership.business.primaryColor,
      secondaryColor: membership.business.secondaryColor,
      logoUrl: membership.business.logoUrl,
      currency: membership.business.currency,
      timezone: membership.business.timezone,
      country: membership.business.country,
    },
    membershipId: membership.id,
  };
}

/** Owner sign-up: business, owner account, a starter program and a first location. */
authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req);

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) throw conflict('An account with this email already exists');

    const slug = await uniqueSlug(input.businessName);
    const passwordHash = await hashPassword(input.password);

    const { business, user, membership } = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: input.businessName,
          slug,
          country: input.country,
          currency: input.currency,
          timezone: input.timezone,
          contactEmail: input.email,
          contactPhone: input.phone ?? null,
        },
      });
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.ownerName,
          phone: input.phone ?? null,
          passwordHash,
        },
      });
      const membership = await tx.staffMembership.create({
        data: { businessId: business.id, userId: user.id, role: 'OWNER' },
      });
      await tx.location.create({
        data: { businessId: business.id, name: input.businessName, timezone: input.timezone },
      });
      const program = await tx.loyaltyProgram.create({
        data: {
          businessId: business.id,
          name: 'Coffee Loyalty',
          description: 'Collect stamps with every coffee and get a free one.',
          stampsRequired: 10,
          rewardName: 'Free coffee',
        },
      });
      await tx.reward.create({
        data: {
          businessId: business.id,
          programId: program.id,
          name: 'Free coffee',
          description: 'One free coffee of your choice.',
          stampsRequired: 10,
        },
      });
      await tx.subscription.create({
        data: {
          businessId: business.id,
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
        },
      });
      return { business, user, membership };
    });

    void recordAudit({
      businessId: business.id,
      actorUserId: user.id,
      actorLabel: user.name,
      action: 'business.register',
      targetType: 'business',
      targetId: business.id,
      ip: clientIp(req),
    });

    const tokens = await issueSession(user.id, business.id, membership.id, req.headers['user-agent']);
    res.status(201).json({ ...tokens, ...(await sessionPayload(user.id, business.id)) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(loginSchema, req);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { staffMemberships: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!user || !user.isActive) throw unauthorized('Invalid email or password');

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw unauthorized('Invalid email or password');

    const membership = user.staffMemberships[0];
    if (!membership) throw unauthorized('This account is not linked to a business');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await issueSession(
      user.id,
      membership.businessId,
      membership.id,
      req.headers['user-agent'],
    );
    res.json({ ...tokens, ...(await sessionPayload(user.id, membership.businessId)) });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = parseBody(refreshSchema, req);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { include: { staffMemberships: { where: { isActive: true } } } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw unauthorized('Session expired, please sign in again');
    }
    const membership = stored.user.staffMemberships[0];
    if (!membership || !stored.user.isActive) throw unauthorized('Session is no longer valid');

    // Rotate: a refresh token is single-use.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueSession(
      stored.userId,
      membership.businessId,
      membership.id,
      req.headers['user-agent'],
    );
    res.json({ ...tokens, ...(await sessionPayload(stored.userId, membership.businessId)) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = (req.body as { refreshToken?: string })?.refreshToken;
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    res.json(await sessionPayload(ctx.userId, ctx.businessId));
  }),
);

/** Staff invitation acceptance — creates the account and joins the tenant. */
authRouter.post(
  '/accept-invite',
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parseBody(acceptInviteSchema, req);
    const claims = verifyInviteToken(input.token);

    const invite = await prisma.staffInvite.findFirst({
      where: { id: claims.sub, tokenHash: sha256(input.token) },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw unauthorized('This invitation is no longer valid');
    }

    const passwordHash = await hashPassword(input.password);
    const { user, membership } = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: invite.email } });
      const user =
        existing ??
        (await tx.user.create({
          data: { email: invite.email, name: input.name, passwordHash },
        }));

      const membership = await tx.staffMembership.upsert({
        where: { businessId_userId: { businessId: invite.businessId, userId: user.id } },
        create: {
          businessId: invite.businessId,
          userId: user.id,
          role: invite.role,
          permissions: invite.permissions,
          locationIds: invite.locationIds,
        },
        update: {
          role: invite.role,
          permissions: invite.permissions,
          locationIds: invite.locationIds,
          isActive: true,
        },
      });
      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return { user, membership };
    });

    void recordAudit({
      businessId: invite.businessId,
      actorUserId: user.id,
      actorLabel: user.name,
      action: 'staff.accept_invite',
      targetType: 'user',
      targetId: user.id,
      ip: clientIp(req),
    });

    const tokens = await issueSession(
      user.id,
      invite.businessId,
      membership.id,
      req.headers['user-agent'],
    );
    res.status(201).json({ ...tokens, ...(await sessionPayload(user.id, invite.businessId)) });
  }),
);

/** Lets the invite page show who invited the staff member before they sign up. */
authRouter.get(
  '/invite/:token',
  asyncHandler(async (req, res) => {
    const token = req.params.token!;
    const claims = verifyInviteToken(token);
    const invite = await prisma.staffInvite.findFirst({
      where: { id: claims.sub, tokenHash: sha256(token) },
      include: { business: true },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw unauthorized('This invitation is no longer valid');
    }
    res.json({
      email: invite.email,
      name: invite.name,
      role: invite.role,
      businessName: invite.business.name,
      businessLogo: invite.business.logoUrl,
    });
  }),
);
