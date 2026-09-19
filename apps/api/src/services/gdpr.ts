import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { bus } from '../lib/events.js';
import { revokeMembershipPasses } from '../wallet/index.js';
import { recordAudit } from './audit.js';

/** Everything the platform holds about one customer, for a GDPR access request. */
export async function exportCustomer(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      memberships: { include: { program: true, walletPasses: true } },
      transactions: { orderBy: { createdAt: 'asc' } },
      redemptions: { orderBy: { earnedAt: 'asc' } },
      consentRecords: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!customer) throw notFound('Customer not found');

  return {
    exportedAt: new Date().toISOString(),
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
      birthday: customer.birthday,
      marketingConsent: customer.marketingConsent,
      createdAt: customer.createdAt,
    },
    memberships: customer.memberships.map((m) => ({
      id: m.id,
      program: m.program.name,
      memberCode: m.memberCode,
      stamps: m.stamps,
      totalStamps: m.totalStamps,
      rewardsEarned: m.rewardsEarned,
      rewardsRedeemed: m.rewardsRedeemed,
      joinedAt: m.joinedAt,
      walletPasses: m.walletPasses.map((p) => ({ platform: p.platform, createdAt: p.createdAt })),
    })),
    transactions: customer.transactions,
    redemptions: customer.redemptions,
    consentRecords: customer.consentRecords,
  };
}

/**
 * Erasure: personal fields are cleared and wallet passes revoked, while the
 * anonymised transaction rows stay so the café's historic totals remain correct.
 */
export async function deleteCustomer(
  businessId: string,
  customerId: string,
  actor: { userId: string; label: string },
) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) throw notFound('Customer not found');

  const memberships = await prisma.loyaltyMembership.findMany({
    where: { customerId, businessId },
    select: { id: true },
  });
  for (const m of memberships) await revokeMembershipPasses(m.id);

  await prisma.$transaction([
    prisma.loyaltyMembership.updateMany({
      where: { customerId },
      data: { status: 'DELETED' },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: 'Deleted',
        lastName: null,
        phone: null,
        email: null,
        birthday: null,
        notes: null,
        marketingConsent: false,
        status: 'DELETED',
        deletedAt: new Date(),
      },
    }),
  ]);

  void recordAudit({
    businessId,
    actorUserId: actor.userId,
    actorLabel: actor.label,
    action: 'customer.delete',
    targetType: 'customer',
    targetId: customerId,
    metadata: { reason: 'gdpr_erasure' },
  });
  bus.publish({ type: 'customer.deleted', businessId, customerId });
}
