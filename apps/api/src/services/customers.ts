import { Prisma } from '@prisma/client';
import { classifySegment, type Segment } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { randomCode } from '../lib/crypto.js';
import { signMemberToken } from '../lib/tokens.js';
import { bus } from '../lib/events.js';
import { recordAudit } from './audit.js';

export interface JoinInput {
  businessId: string;
  programId?: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  birthday?: string | null;
  marketingConsent: boolean;
  locationId?: string | null;
  source: string;
  ip?: string | null;
}

async function uniqueMemberCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode(12);
    const clash = await prisma.loyaltyMembership.findUnique({ where: { memberCode: code } });
    if (!clash) return code;
  }
  throw new Error('Could not allocate a unique member code');
}

export async function activeProgram(businessId: string, programId?: string) {
  const program = programId
    ? await prisma.loyaltyProgram.findFirst({ where: { id: programId, businessId } })
    : await prisma.loyaltyProgram.findFirst({
        where: { businessId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
  if (!program) throw notFound('This café has no active loyalty program yet');
  return program;
}

/** Finds an existing customer of this business by phone or email. */
export async function findExistingCustomer(
  businessId: string,
  phone?: string | null,
  email?: string | null,
) {
  const or: Prisma.CustomerWhereInput[] = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  if (or.length === 0) return null;
  return prisma.customer.findFirst({
    where: { businessId, status: { not: 'DELETED' }, OR: or },
  });
}

/**
 * Public join flow: creates (or reuses) the customer, opens a membership for the
 * program and returns a long-lived member token. That token is what identifies
 * the customer later on an NFC tap — no customer app involved.
 */
export async function joinLoyaltyProgram(input: JoinInput) {
  const program = await activeProgram(input.businessId, input.programId);
  if (!program.isActive) throw badRequest('This loyalty program is not accepting new members');

  const existing = await findExistingCustomer(input.businessId, input.phone, input.email);

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          firstName: input.firstName || existing.firstName,
          lastName: input.lastName ?? existing.lastName,
          phone: input.phone ?? existing.phone,
          email: input.email ?? existing.email,
          birthday: input.birthday ? new Date(input.birthday) : existing.birthday,
          marketingConsent: input.marketingConsent || existing.marketingConsent,
        },
      })
    : await prisma.customer.create({
        data: {
          businessId: input.businessId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          birthday: input.birthday ? new Date(input.birthday) : null,
          marketingConsent: input.marketingConsent,
          locationId: input.locationId ?? null,
        },
      });

  await prisma.consentRecord.create({
    data: {
      businessId: input.businessId,
      customerId: customer.id,
      granted: input.marketingConsent,
      source: input.source,
      ip: input.ip ?? null,
    },
  });

  const existingMembership = await prisma.loyaltyMembership.findUnique({
    where: { customerId_programId: { customerId: customer.id, programId: program.id } },
  });

  const membership =
    existingMembership ??
    (await prisma.loyaltyMembership.create({
      data: {
        businessId: input.businessId,
        customerId: customer.id,
        programId: program.id,
        memberCode: await uniqueMemberCode(),
      },
    }));

  if (!existingMembership) {
    await prisma.transaction.create({
      data: {
        businessId: input.businessId,
        customerId: customer.id,
        membershipId: membership.id,
        locationId: input.locationId ?? null,
        type: 'JOIN',
        channel: 'QR',
        amount: 0,
        balanceAfter: 0,
      },
    });
    bus.publish({ type: 'customer.created', businessId: input.businessId, customerId: customer.id });
    void recordAudit({
      businessId: input.businessId,
      actorLabel: `${customer.firstName} (customer)`,
      action: 'customer.join',
      targetType: 'customer',
      targetId: customer.id,
      metadata: { programId: program.id, source: input.source },
      ip: input.ip,
    });
  }

  const memberToken = signMemberToken({
    sub: customer.id,
    bid: input.businessId,
    mem: membership.id,
  });

  return { customer, membership, program, memberToken, rejoined: Boolean(existingMembership) };
}

export interface CustomerListItem {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  stamps: number;
  stampsRequired: number;
  totalStamps: number;
  rewardsRedeemed: number;
  lastActivityAt: string | null;
  joinedAt: string;
  segment: Segment;
  status: string;
  membershipId: string | null;
  memberCode: string | null;
}

const VIP_WINDOW_DAYS = 60;

async function vipWindowStamps(membershipIds: string[]): Promise<Map<string, number>> {
  if (membershipIds.length === 0) return new Map();
  const rows = await prisma.transaction.groupBy({
    by: ['membershipId'],
    where: {
      membershipId: { in: membershipIds },
      type: 'STAMP_ADD',
      createdAt: { gte: new Date(Date.now() - VIP_WINDOW_DAYS * 86_400_000) },
    },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.membershipId, r._sum.amount ?? 0]));
}

export async function listCustomers(
  businessId: string,
  params: { q?: string; segment?: Segment; locationId?: string; cursor?: string; limit: number },
): Promise<{ items: CustomerListItem[]; nextCursor: string | null }> {
  const q = params.q?.trim();
  const where: Prisma.CustomerWhereInput = {
    businessId,
    status: { not: 'DELETED' },
    ...(params.locationId ? { locationId: params.locationId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
            { id: q },
            { memberships: { some: { memberCode: q.toUpperCase() } } },
          ],
        }
      : {}),
  };

  // Over-fetch a little: segment filtering happens after the derived classification.
  const take = params.segment ? params.limit * 4 : params.limit + 1;
  const customers = await prisma.customer.findMany({
    where,
    take,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: { memberships: { include: { program: true }, orderBy: { joinedAt: 'asc' } } },
  });

  const membershipIds = customers.flatMap((c) => c.memberships.map((m) => m.id));
  const vipStamps = await vipWindowStamps(membershipIds);

  let items: CustomerListItem[] = customers.map((c) => {
    const membership = c.memberships[0] ?? null;
    const segment = membership
      ? classifySegment({
          joinedAt: membership.joinedAt,
          lastActivityAt: membership.lastActivityAt,
          stampsInVipWindow: vipStamps.get(membership.id) ?? 0,
        })
      : 'NEW';
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      stamps: membership?.stamps ?? 0,
      stampsRequired: membership?.program.stampsRequired ?? 0,
      totalStamps: membership?.totalStamps ?? 0,
      rewardsRedeemed: membership?.rewardsRedeemed ?? 0,
      lastActivityAt: membership?.lastActivityAt?.toISOString() ?? null,
      joinedAt: (membership?.joinedAt ?? c.createdAt).toISOString(),
      segment,
      status: c.status,
      membershipId: membership?.id ?? null,
      memberCode: membership?.memberCode ?? null,
    };
  });

  if (params.segment) items = items.filter((i) => i.segment === params.segment);

  const hasMore = items.length > params.limit;
  items = items.slice(0, params.limit);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function getCustomerProfile(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId, status: { not: 'DELETED' } },
    include: {
      memberships: { include: { program: true } },
      location: true,
    },
  });
  if (!customer) throw notFound('Customer not found');

  const [transactions, redemptions, vip] = await Promise.all([
    prisma.transaction.findMany({
      where: { customerId, businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { location: true },
    }),
    prisma.rewardRedemption.findMany({
      where: { customerId, businessId },
      orderBy: { earnedAt: 'desc' },
      take: 25,
      include: { reward: true },
    }),
    vipWindowStamps(customer.memberships.map((m) => m.id)),
  ]);

  return {
    customer,
    memberships: customer.memberships.map((m) => ({
      ...m,
      segment: classifySegment({
        joinedAt: m.joinedAt,
        lastActivityAt: m.lastActivityAt,
        stampsInVipWindow: vip.get(m.id) ?? 0,
      }),
      rewardAvailable: m.stamps >= m.program.stampsRequired,
    })),
    transactions,
    redemptions,
  };
}

export async function createCustomerManually(
  businessId: string,
  input: {
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    birthday?: string | null;
    marketingConsent: boolean;
    locationId?: string | null;
  },
  actor: { userId: string; label: string },
) {
  if (!input.phone && !input.email) {
    throw badRequest('A phone number or an email address is required');
  }
  const existing = await findExistingCustomer(businessId, input.phone, input.email);
  if (existing) throw conflict('A customer with this phone or email already exists');

  const result = await joinLoyaltyProgram({
    businessId,
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    birthday: input.birthday ?? null,
    marketingConsent: input.marketingConsent,
    locationId: input.locationId ?? null,
    source: 'dashboard',
  });

  void recordAudit({
    businessId,
    actorUserId: actor.userId,
    actorLabel: actor.label,
    action: 'customer.create',
    targetType: 'customer',
    targetId: result.customer.id,
  });

  return result;
}
