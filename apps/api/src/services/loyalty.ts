import { Prisma, type LoyaltyMembership, type LoyaltyProgram } from '@prisma/client';
import { classifySegment, type MembershipSummary, type StampResult } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound, tooManyRequests } from '../lib/errors.js';
import { bus } from '../lib/events.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from './audit.js';
import { syncMembershipPasses } from '../wallet/index.js';

type Channel = 'STAFF_APP' | 'STAFF_WEB' | 'PHONE_ORDER' | 'DELIVERY' | 'NFC' | 'QR' | 'SYSTEM';

const SELF_SERVICE: Channel[] = ['NFC', 'QR'];

export interface StampCommand {
  businessId: string;
  membershipId: string;
  amount: number;
  channel: Channel;
  locationId?: string | null;
  nfcDeviceId?: string | null;
  staffUserId?: string | null;
  actorLabel: string;
  idempotencyKey: string;
  note?: string | null;
  ip?: string | null;
}

export interface RedeemCommand {
  businessId: string;
  membershipId: string;
  rewardId?: string | null;
  locationId?: string | null;
  staffUserId?: string | null;
  actorLabel: string;
  idempotencyKey: string;
  note?: string | null;
  ip?: string | null;
}

export async function loadMembership(businessId: string, membershipId: string) {
  const membership = await prisma.loyaltyMembership.findFirst({
    where: { id: membershipId, businessId, status: { not: 'DELETED' } },
    include: { program: true, customer: true },
  });
  if (!membership) throw notFound('Loyalty membership not found');
  return membership;
}

/** Entitlements are derived from the balance, never stored twice. */
export function entitlementsFor(stamps: number, stampsRequired: number): number {
  if (stampsRequired <= 0) return 0;
  return Math.floor(stamps / stampsRequired);
}

export async function summarise(
  membership: LoyaltyMembership & { program: LoyaltyProgram },
): Promise<MembershipSummary> {
  const since = new Date(Date.now() - 60 * 86_400_000);
  const recent = await prisma.transaction.aggregate({
    where: {
      membershipId: membership.id,
      type: 'STAMP_ADD',
      createdAt: { gte: since },
    },
    _sum: { amount: true },
  });

  return toSummary(membership, recent._sum.amount ?? 0);
}

export function toSummary(
  membership: LoyaltyMembership & { program: LoyaltyProgram },
  stampsInVipWindow: number,
): MembershipSummary {
  return {
    id: membership.id,
    customerId: membership.customerId,
    programId: membership.programId,
    stamps: membership.stamps,
    stampsRequired: membership.program.stampsRequired,
    totalStamps: membership.totalStamps,
    rewardsEarned: membership.rewardsEarned,
    rewardsRedeemed: membership.rewardsRedeemed,
    rewardAvailable: membership.stamps >= membership.program.stampsRequired,
    joinedAt: membership.joinedAt.toISOString(),
    lastActivityAt: membership.lastActivityAt?.toISOString() ?? null,
    segment: classifySegment({
      joinedAt: membership.joinedAt,
      lastActivityAt: membership.lastActivityAt,
      stampsInVipWindow,
    }),
  };
}

/** Active DOUBLE_STAMP campaign multiplies what staff or a tap awards. */
async function stampMultiplier(businessId: string): Promise<number> {
  const now = new Date();
  const campaign = await prisma.campaign.findFirst({
    where: {
      businessId,
      type: 'DOUBLE_STAMP',
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { stampMultiplier: 'desc' },
  });
  return campaign?.stampMultiplier ?? 1;
}

async function existingTransaction(businessId: string, idempotencyKey: string) {
  return prisma.transaction.findFirst({
    where: { businessId, idempotencyKey },
    include: { membership: { include: { program: true } } },
  });
}

/**
 * Adds stamps to a membership.
 *
 * Guarantees:
 *  - one stamp per request, even if the request arrives twice (idempotencyKey is
 *    unique per business and the unique index, not a read-check, enforces it);
 *  - self-service (NFC/QR) taps respect the program cooldown;
 *  - the database is updated and only then are wallet passes refreshed.
 */
export async function addStamps(cmd: StampCommand): Promise<StampResult> {
  // A replay (double tap, retry, refresh) is answered with the original result
  // before any rule can reject it as "too soon".
  const replay = await existingTransaction(cmd.businessId, cmd.idempotencyKey);
  if (replay) {
    return {
      membership: await summarise(replay.membership),
      transactionId: replay.id,
      stampsAdded: replay.amount,
      rewardUnlocked: false,
      duplicate: true,
    };
  }

  const membership = await loadMembership(cmd.businessId, cmd.membershipId);
  if (membership.status !== 'ACTIVE') throw badRequest('This loyalty membership is not active');
  if (!membership.program.isActive) throw badRequest('This loyalty program is not active');
  if (membership.customer.status === 'BLOCKED') throw badRequest('This customer is blocked');

  const multiplier = await stampMultiplier(cmd.businessId);
  const requested = Math.min(cmd.amount, membership.program.maxStampsPerVisit);
  if (requested < 1) throw badRequest('Stamp amount must be at least 1');
  const amount = requested * multiplier;

  if (SELF_SERVICE.includes(cmd.channel)) {
    const cooldown = membership.program.selfServiceCooldownSeconds;
    const last = membership.lastStampAt;
    if (cooldown > 0 && last && Date.now() - last.getTime() < cooldown * 1000) {
      const wait = Math.ceil((cooldown * 1000 - (Date.now() - last.getTime())) / 1000);
      throw tooManyRequests(
        `This card was already stamped recently. Please try again in ${Math.ceil(wait / 60)} minute(s).`,
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.loyaltyMembership.update({
        where: { id: membership.id },
        data: {
          stamps: { increment: amount },
          totalStamps: { increment: amount },
          lastActivityAt: new Date(),
          lastStampAt: new Date(),
        },
        include: { program: true },
      });

      const transaction = await tx.transaction.create({
        data: {
          businessId: cmd.businessId,
          customerId: membership.customerId,
          membershipId: membership.id,
          locationId: cmd.locationId ?? null,
          nfcDeviceId: cmd.nfcDeviceId ?? null,
          staffUserId: cmd.staffUserId ?? null,
          type: 'STAMP_ADD',
          channel: cmd.channel,
          amount,
          balanceAfter: updated.stamps,
          note: cmd.note ?? null,
          idempotencyKey: cmd.idempotencyKey,
        },
      });

      const required = updated.program.stampsRequired;
      const entitlements = entitlementsFor(updated.stamps, required);
      const pending = await tx.rewardRedemption.count({
        where: { membershipId: membership.id, redeemedAt: null },
      });

      let unlocked = 0;
      for (let i = pending; i < entitlements; i += 1) {
        const reward = await tx.reward.findFirst({
          where: { businessId: cmd.businessId, programId: updated.programId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        const expiryDays = reward?.expiryDays ?? updated.program.rewardExpiryDays ?? null;
        await tx.rewardRedemption.create({
          data: {
            businessId: cmd.businessId,
            customerId: membership.customerId,
            membershipId: membership.id,
            rewardId: reward?.id ?? null,
            locationId: cmd.locationId ?? null,
            stampsSpent: 0,
            expiresAt: expiryDays ? new Date(Date.now() + expiryDays * 86_400_000) : null,
          },
        });
        await tx.transaction.create({
          data: {
            businessId: cmd.businessId,
            customerId: membership.customerId,
            membershipId: membership.id,
            locationId: cmd.locationId ?? null,
            type: 'REWARD_EARNED',
            channel: 'SYSTEM',
            amount: 0,
            balanceAfter: updated.stamps,
          },
        });
        unlocked += 1;
      }

      const finalMembership = unlocked
        ? await tx.loyaltyMembership.update({
            where: { id: membership.id },
            data: { rewardsEarned: { increment: unlocked } },
            include: { program: true },
          })
        : updated;

      return { transaction, membership: finalMembership, unlocked };
    });

    bus.publish({
      type: 'stamp.added',
      businessId: cmd.businessId,
      membershipId: membership.id,
      customerId: membership.customerId,
      stamps: result.membership.stamps,
    });
    if (result.unlocked > 0) {
      bus.publish({
        type: 'reward.earned',
        businessId: cmd.businessId,
        membershipId: membership.id,
        customerId: membership.customerId,
      });
    }

    void recordAudit({
      businessId: cmd.businessId,
      actorUserId: cmd.staffUserId,
      actorLabel: cmd.actorLabel,
      action: 'stamp.add',
      targetType: 'membership',
      targetId: membership.id,
      metadata: { amount, channel: cmd.channel, balanceAfter: result.membership.stamps },
      ip: cmd.ip,
    });
    void refreshPasses(membership.id);

    return {
      membership: await summarise(result.membership),
      transactionId: result.transaction.id,
      stampsAdded: amount,
      rewardUnlocked: result.unlocked > 0,
      duplicate: false,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Same request replayed (double tap, retry, flaky network): return the first result.
      const previous = await existingTransaction(cmd.businessId, cmd.idempotencyKey);
      if (previous) {
        return {
          membership: await summarise(previous.membership),
          transactionId: previous.id,
          stampsAdded: previous.amount,
          rewardUnlocked: false,
          duplicate: true,
        };
      }
    }
    throw err;
  }
}

export async function removeStamps(cmd: StampCommand): Promise<StampResult> {
  const membership = await loadMembership(cmd.businessId, cmd.membershipId);
  const amount = Math.min(cmd.amount, membership.stamps);
  if (amount < 1) throw badRequest('There are no stamps to remove');

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.loyaltyMembership.update({
      where: { id: membership.id },
      data: { stamps: { decrement: amount }, lastActivityAt: new Date() },
      include: { program: true },
    });
    const transaction = await tx.transaction.create({
      data: {
        businessId: cmd.businessId,
        customerId: membership.customerId,
        membershipId: membership.id,
        locationId: cmd.locationId ?? null,
        staffUserId: cmd.staffUserId ?? null,
        type: 'STAMP_REMOVE',
        channel: cmd.channel,
        amount,
        balanceAfter: updated.stamps,
        note: cmd.note ?? null,
        idempotencyKey: cmd.idempotencyKey,
      },
    });
    return { updated, transaction };
  });

  bus.publish({
    type: 'stamp.removed',
    businessId: cmd.businessId,
    membershipId: membership.id,
    customerId: membership.customerId,
    stamps: result.updated.stamps,
  });
  void recordAudit({
    businessId: cmd.businessId,
    actorUserId: cmd.staffUserId,
    actorLabel: cmd.actorLabel,
    action: 'stamp.remove',
    targetType: 'membership',
    targetId: membership.id,
    metadata: { amount, balanceAfter: result.updated.stamps },
    ip: cmd.ip,
  });
  void refreshPasses(membership.id);

  return {
    membership: await summarise(result.updated),
    transactionId: result.transaction.id,
    stampsAdded: -amount,
    rewardUnlocked: false,
    duplicate: false,
  };
}

export async function redeemReward(cmd: RedeemCommand) {
  const membership = await loadMembership(cmd.businessId, cmd.membershipId);
  const required = membership.program.stampsRequired;
  if (membership.stamps < required) {
    throw badRequest(`This customer has ${membership.stamps} of ${required} stamps`);
  }

  const pending = await prisma.rewardRedemption.findFirst({
    where: {
      membershipId: membership.id,
      redeemedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { earnedAt: 'asc' },
  });
  if (!pending) throw conflict('This reward has expired or was already redeemed');

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.loyaltyMembership.update({
      where: { id: membership.id },
      data: {
        stamps: { decrement: required },
        rewardsRedeemed: { increment: 1 },
        lastActivityAt: new Date(),
      },
      include: { program: true },
    });
    const redemption = await tx.rewardRedemption.update({
      where: { id: pending.id },
      data: {
        redeemedAt: new Date(),
        stampsSpent: required,
        staffUserId: cmd.staffUserId ?? null,
        locationId: cmd.locationId ?? null,
        rewardId: cmd.rewardId ?? pending.rewardId,
        note: cmd.note ?? null,
      },
    });
    await tx.transaction.create({
      data: {
        businessId: cmd.businessId,
        customerId: membership.customerId,
        membershipId: membership.id,
        locationId: cmd.locationId ?? null,
        staffUserId: cmd.staffUserId ?? null,
        type: 'REWARD_REDEEMED',
        channel: 'STAFF_APP',
        amount: required,
        balanceAfter: updated.stamps,
        note: cmd.note ?? null,
        idempotencyKey: cmd.idempotencyKey,
      },
    });
    return { updated, redemption };
  });

  bus.publish({
    type: 'reward.redeemed',
    businessId: cmd.businessId,
    membershipId: membership.id,
    customerId: membership.customerId,
  });
  void recordAudit({
    businessId: cmd.businessId,
    actorUserId: cmd.staffUserId,
    actorLabel: cmd.actorLabel,
    action: 'reward.redeem',
    targetType: 'membership',
    targetId: membership.id,
    metadata: { stampsSpent: required, redemptionId: result.redemption.id },
    ip: cmd.ip,
  });
  void refreshPasses(membership.id);

  return { membership: await summarise(result.updated), redemptionId: result.redemption.id };
}

/** Owner-only manual correction, always attributed and audited. */
export async function adjustStamps(params: {
  businessId: string;
  membershipId: string;
  stamps: number;
  reason: string;
  staffUserId: string;
  actorLabel: string;
  ip?: string | null;
}) {
  const membership = await loadMembership(params.businessId, params.membershipId);
  const delta = params.stamps - membership.stamps;

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.loyaltyMembership.update({
      where: { id: membership.id },
      data: {
        stamps: params.stamps,
        totalStamps: delta > 0 ? { increment: delta } : undefined,
        lastActivityAt: new Date(),
      },
      include: { program: true },
    });
    await tx.transaction.create({
      data: {
        businessId: params.businessId,
        customerId: membership.customerId,
        membershipId: membership.id,
        staffUserId: params.staffUserId,
        type: 'ADJUSTMENT',
        channel: 'STAFF_WEB',
        amount: delta,
        balanceAfter: m.stamps,
        note: params.reason,
      },
    });
    return m;
  });

  void recordAudit({
    businessId: params.businessId,
    actorUserId: params.staffUserId,
    actorLabel: params.actorLabel,
    action: 'stamp.adjust',
    targetType: 'membership',
    targetId: membership.id,
    metadata: { from: membership.stamps, to: params.stamps, reason: params.reason },
    ip: params.ip,
  });
  void refreshPasses(membership.id);
  bus.publish({
    type: 'stamp.added',
    businessId: params.businessId,
    membershipId: membership.id,
    customerId: membership.customerId,
    stamps: updated.stamps,
  });

  return summarise(updated);
}

/** Wallet updates are best-effort: the database stays the source of truth. */
async function refreshPasses(membershipId: string): Promise<void> {
  try {
    await syncMembershipPasses(membershipId);
  } catch (err) {
    logger.error({ err, membershipId }, 'Wallet pass sync failed');
  }
}
