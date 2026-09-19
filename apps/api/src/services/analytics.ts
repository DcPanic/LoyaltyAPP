import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

function startOf(period: 'day' | 'week' | 'month'): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const weekday = (d.getDay() + 6) % 7; // Monday-based
    d.setDate(d.getDate() - weekday);
  }
  if (period === 'month') d.setDate(1);
  return d;
}

interface Scope {
  businessId: string;
  locationId?: string | null;
}

function scopeWhere({ businessId, locationId }: Scope): Prisma.TransactionWhereInput {
  return { businessId, ...(locationId ? { locationId } : {}) };
}

async function sumStamps(scope: Scope, since: Date): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: { ...scopeWhere(scope), type: 'STAMP_ADD', createdAt: { gte: since } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function dashboardStats(scope: Scope) {
  const monthStart = startOf('month');
  const [
    customers,
    activeMembers,
    stampsToday,
    stampsWeek,
    stampsMonth,
    newCustomers,
    rewardsRedeemed,
    rewardsPending,
    returningCustomers,
  ] = await Promise.all([
    prisma.customer.count({
      where: {
        businessId: scope.businessId,
        status: { not: 'DELETED' },
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
    }),
    prisma.loyaltyMembership.count({
      where: {
        businessId: scope.businessId,
        status: 'ACTIVE',
        lastActivityAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
    }),
    sumStamps(scope, startOf('day')),
    sumStamps(scope, startOf('week')),
    sumStamps(scope, monthStart),
    prisma.customer.count({
      where: {
        businessId: scope.businessId,
        status: { not: 'DELETED' },
        createdAt: { gte: monthStart },
      },
    }),
    prisma.rewardRedemption.count({
      where: {
        businessId: scope.businessId,
        redeemedAt: { gte: monthStart },
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
    }),
    prisma.rewardRedemption.count({
      where: { businessId: scope.businessId, redeemedAt: null },
    }),
    prisma.transaction
      .groupBy({
        by: ['customerId'],
        where: { ...scopeWhere(scope), type: 'STAMP_ADD', createdAt: { gte: monthStart } },
        _count: { _all: true },
        having: { customerId: { _count: { gt: 1 } } },
      })
      .then((rows) => rows.length),
  ]);

  return {
    customers,
    activeMembers,
    stampsToday,
    stampsWeek,
    stampsMonth,
    newCustomers,
    returningCustomers,
    rewardsRedeemed,
    rewardsPending,
  };
}

export interface SeriesPoint {
  date: string;
  stamps: number;
  joins: number;
  redemptions: number;
}

/** Daily activity for the dashboard charts. */
export async function activitySeries(scope: Scope, days: number): Promise<SeriesPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const locationFilter = scope.locationId
    ? Prisma.sql`AND "locationId" = ${scope.locationId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { day: Date; stamps: bigint | null; joins: bigint | null; redemptions: bigint | null }[]
  >`
    SELECT date_trunc('day', "createdAt") AS day,
           SUM(CASE WHEN "type" = 'STAMP_ADD' THEN "amount" ELSE 0 END) AS stamps,
           COUNT(*) FILTER (WHERE "type" = 'JOIN') AS joins,
           COUNT(*) FILTER (WHERE "type" = 'REWARD_REDEEMED') AS redemptions
    FROM "Transaction"
    WHERE "businessId" = ${scope.businessId}
      AND "createdAt" >= ${since}
      ${locationFilter}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const byDay = new Map(
    rows.map((r) => [
      r.day.toISOString().slice(0, 10),
      {
        stamps: Number(r.stamps ?? 0),
        joins: Number(r.joins ?? 0),
        redemptions: Number(r.redemptions ?? 0),
      },
    ]),
  );

  const series: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const entry = byDay.get(key);
    series.push({
      date: key,
      stamps: entry?.stamps ?? 0,
      joins: entry?.joins ?? 0,
      redemptions: entry?.redemptions ?? 0,
    });
  }
  return series;
}

export async function staffActivity(businessId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.transaction.groupBy({
    by: ['staffUserId'],
    where: { businessId, type: 'STAMP_ADD', staffUserId: { not: null }, createdAt: { gte: since } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.staffUserId!).filter(Boolean) } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows
    .map((r) => ({
      userId: r.staffUserId!,
      name: byId.get(r.staffUserId!)?.name ?? 'Removed staff member',
      stamps: r._sum.amount ?? 0,
      transactions: r._count._all,
    }))
    .sort((a, b) => b.stamps - a.stamps);
}

export async function locationActivity(businessId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.transaction.groupBy({
    by: ['locationId'],
    where: { businessId, type: 'STAMP_ADD', createdAt: { gte: since } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const locations = await prisma.location.findMany({ where: { businessId } });
  const byId = new Map(locations.map((l) => [l.id, l.name]));
  return rows.map((r) => ({
    locationId: r.locationId,
    name: r.locationId ? (byId.get(r.locationId) ?? 'Unknown') : 'Unassigned',
    stamps: r._sum.amount ?? 0,
    transactions: r._count._all,
  }));
}

export async function segmentBreakdown(businessId: string) {
  const memberships = await prisma.loyaltyMembership.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { id: true, joinedAt: true, lastActivityAt: true },
  });
  const { classifySegment } = await import('@loyaltyapp/shared');
  const vipRows = await prisma.transaction.groupBy({
    by: ['membershipId'],
    where: {
      businessId,
      type: 'STAMP_ADD',
      createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) },
    },
    _sum: { amount: true },
  });
  const vip = new Map(vipRows.map((r) => [r.membershipId, r._sum.amount ?? 0]));

  const counts: Record<string, number> = { NEW: 0, ACTIVE: 0, VIP: 0, AT_RISK: 0, LOST: 0 };
  for (const m of memberships) {
    const segment = classifySegment({
      joinedAt: m.joinedAt,
      lastActivityAt: m.lastActivityAt,
      stampsInVipWindow: vip.get(m.id) ?? 0,
    });
    counts[segment] = (counts[segment] ?? 0) + 1;
  }
  return counts;
}

/** Retention: share of members from the previous month who came back this month. */
export async function retentionRate(businessId: string): Promise<number> {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const previous = await prisma.transaction.findMany({
    where: {
      businessId,
      type: 'STAMP_ADD',
      createdAt: { gte: prevMonth, lt: thisMonth },
    },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  if (previous.length === 0) return 0;

  const returned = await prisma.transaction.findMany({
    where: {
      businessId,
      type: 'STAMP_ADD',
      createdAt: { gte: thisMonth },
      customerId: { in: previous.map((p) => p.customerId) },
    },
    select: { customerId: true },
    distinct: ['customerId'],
  });
  return Math.round((returned.length / previous.length) * 100);
}
