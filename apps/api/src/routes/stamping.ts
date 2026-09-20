import { Router } from 'express';
import { z } from 'zod';
import { adjustSchema, redeemSchema, stampSchema } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { badRequest, notFound } from '../lib/errors.js';
import { randomToken } from '../lib/crypto.js';
import { assertLocationAccess, auth, requirePermission } from '../middleware/auth.js';
import { stampLimiter } from '../middleware/rateLimit.js';
import {
  addStamps,
  adjustStamps,
  loadMembership,
  redeemReward,
  removeStamps,
  summarise,
  undoRedemption,
} from '../services/loyalty.js';

export const stampingRouter: Router = Router();

function idempotencyKey(req: { headers: Record<string, unknown> }): string {
  const header = req.headers['idempotency-key'];
  return typeof header === 'string' && header.length >= 8 ? header.slice(0, 120) : randomToken(16);
}

async function membershipCard(businessId: string, membershipId: string) {
  const membership = await loadMembership(businessId, membershipId);
  const pendingReward = await prisma.rewardRedemption.findFirst({
    where: {
      membershipId,
      redeemedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    include: { reward: true },
  });
  return {
    customer: {
      id: membership.customer.id,
      firstName: membership.customer.firstName,
      lastName: membership.customer.lastName,
      phone: membership.customer.phone,
      email: membership.customer.email,
    },
    membership: await summarise(membership),
    program: {
      id: membership.program.id,
      name: membership.program.name,
      rewardName: membership.program.rewardName,
      allowedStampAmounts: membership.program.allowedStampAmounts,
    },
    pendingReward: pendingReward
      ? {
          id: pendingReward.id,
          name: pendingReward.reward?.name ?? membership.program.rewardName,
          expiresAt: pendingReward.expiresAt,
        }
      : null,
  };
}

/** Staff scans the customer's wallet QR (or types the member code). */
stampingRouter.post(
  '/resolve',
  requirePermission('customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { code } = parseBody(z.object({ code: z.string().trim().min(4).max(500) }), req);

    const membership = await prisma.loyaltyMembership.findFirst({
      where: {
        businessId: ctx.businessId,
        memberCode: code.toUpperCase().replace(/^LA1:/, ''),
        status: 'ACTIVE',
      },
    });
    if (!membership) throw notFound('No loyalty card matches this code');
    res.json(await membershipCard(ctx.businessId, membership.id));
  }),
);

/** Look up a customer by phone, email or name — used for phone and delivery orders. */
stampingRouter.get(
  '/search',
  requirePermission('customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) throw badRequest('Enter at least 2 characters');

    const memberships = await prisma.loyaltyMembership.findMany({
      where: {
        businessId: ctx.businessId,
        status: 'ACTIVE',
        customer: {
          status: 'ACTIVE',
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
            { id: q },
          ],
        },
      },
      include: { customer: true, program: true },
      take: 20,
      orderBy: { lastActivityAt: 'desc' },
    });

    res.json({
      items: memberships.map((m) => ({
        membershipId: m.id,
        customerId: m.customerId,
        name: [m.customer.firstName, m.customer.lastName].filter(Boolean).join(' '),
        phone: m.customer.phone,
        email: m.customer.email,
        stamps: m.stamps,
        stampsRequired: m.program.stampsRequired,
        rewardAvailable: m.stamps >= m.program.stampsRequired,
        memberCode: m.memberCode,
      })),
    });
  }),
);

stampingRouter.get(
  '/card/:membershipId',
  requirePermission('customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    res.json(await membershipCard(ctx.businessId, req.params.membershipId!));
  }),
);

stampingRouter.post(
  '/stamp',
  stampLimiter,
  requirePermission('stamp:add'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(stampSchema, req);
    if (!input.membershipId) throw badRequest('membershipId is required');
    assertLocationAccess(ctx, input.locationId);

    const result = await addStamps({
      businessId: ctx.businessId,
      membershipId: input.membershipId,
      amount: input.amount,
      channel: input.channel,
      locationId: input.locationId ?? ctx.locationIds[0] ?? null,
      staffUserId: ctx.userId,
      actorLabel: ctx.name,
      idempotencyKey: idempotencyKey(req),
      note: input.note,
      ip: clientIp(req),
    });
    res.json(result);
  }),
);

stampingRouter.post(
  '/remove',
  stampLimiter,
  requirePermission('stamp:remove'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(stampSchema, req);
    if (!input.membershipId) throw badRequest('membershipId is required');
    assertLocationAccess(ctx, input.locationId);

    res.json(
      await removeStamps({
        businessId: ctx.businessId,
        membershipId: input.membershipId,
        amount: input.amount,
        channel: input.channel,
        locationId: input.locationId ?? null,
        staffUserId: ctx.userId,
        actorLabel: ctx.name,
        idempotencyKey: idempotencyKey(req),
        note: input.note,
        ip: clientIp(req),
      }),
    );
  }),
);

stampingRouter.post(
  '/redeem',
  stampLimiter,
  requirePermission('reward:redeem'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(redeemSchema, req);
    assertLocationAccess(ctx, input.locationId);

    res.json(
      await redeemReward({
        businessId: ctx.businessId,
        membershipId: input.membershipId,
        rewardId: input.rewardId ?? null,
        locationId: input.locationId ?? null,
        staffUserId: ctx.userId,
        actorLabel: ctx.name,
        idempotencyKey: idempotencyKey(req),
        note: input.note,
        ip: clientIp(req),
      }),
    );
  }),
);

const undoRedeemSchema = z.object({
  membershipId: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

/**
 * Puts back a reward given out by mistake, filling the card again.
 *
 * Whoever may hand a reward over may also take it back, because the counter tag
 * redeems by itself and the person standing there is the one who has to fix it.
 * The correction is recorded like any other change.
 */
stampingRouter.post(
  '/undo-redeem',
  stampLimiter,
  requirePermission('reward:redeem'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(undoRedeemSchema, req);
    res.json(
      await undoRedemption({
        businessId: ctx.businessId,
        membershipId: input.membershipId,
        staffUserId: ctx.userId,
        actorLabel: ctx.name,
        reason: input.reason ?? null,
        ip: clientIp(req),
      }),
    );
  }),
);

/** Manual correction of a balance — owners and managers only, always audited. */
stampingRouter.post(
  '/adjust',
  requirePermission('program:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(adjustSchema, req);
    res.json(
      await adjustStamps({
        businessId: ctx.businessId,
        membershipId: input.membershipId,
        stamps: input.stamps,
        reason: input.reason,
        staffUserId: ctx.userId,
        actorLabel: ctx.name,
        ip: clientIp(req),
      }),
    );
  }),
);

/** The staff app's "recent activity" strip. */
stampingRouter.get(
  '/recent',
  requirePermission('stamp:add', 'customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const items = await prisma.transaction.findMany({
      where: {
        businessId: ctx.businessId,
        ...(ctx.locationIds.length > 0 ? { locationId: { in: ctx.locationIds } } : {}),
        type: { in: ['STAMP_ADD', 'REWARD_REDEEMED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { customer: { select: { firstName: true, lastName: true } } },
    });
    res.json({
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        channel: t.channel,
        createdAt: t.createdAt,
        customerName: [t.customer.firstName, t.customer.lastName].filter(Boolean).join(' '),
      })),
    });
  }),
);
