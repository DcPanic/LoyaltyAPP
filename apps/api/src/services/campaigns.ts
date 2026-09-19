import { classifySegment, type Segment } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { recordAudit } from './audit.js';

export interface AudienceMember {
  customerId: string;
  membershipId: string;
  name: string;
  phone: string | null;
  email: string | null;
  segment: Segment;
  marketingConsent: boolean;
}

/**
 * Resolves who a campaign targets. Marketing campaigns only ever include
 * customers who gave marketing consent; transactional types do not need it.
 */
export async function resolveAudience(
  businessId: string,
  campaignId: string,
): Promise<AudienceMember[]> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, businessId } });
  if (!campaign) throw notFound('Campaign not found');

  const memberships = await prisma.loyaltyMembership.findMany({
    where: { businessId, status: 'ACTIVE', customer: { status: 'ACTIVE' } },
    include: { customer: true },
  });

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

  const today = new Date();
  const audience: AudienceMember[] = [];

  for (const m of memberships) {
    const segment = classifySegment({
      joinedAt: m.joinedAt,
      lastActivityAt: m.lastActivityAt,
      stampsInVipWindow: vip.get(m.id) ?? 0,
    });

    if (campaign.segments.length > 0 && !campaign.segments.includes(segment)) continue;

    if (campaign.type === 'BIRTHDAY') {
      const b = m.customer.birthday;
      if (!b) continue;
      if (b.getUTCDate() !== today.getUTCDate() || b.getUTCMonth() !== today.getUTCMonth()) continue;
    }
    if (campaign.type === 'WIN_BACK' && !['AT_RISK', 'LOST'].includes(segment)) continue;
    if (campaign.type === 'VIP_OFFER' && segment !== 'VIP') continue;
    if (!m.customer.marketingConsent && campaign.type !== 'DOUBLE_STAMP') continue;

    audience.push({
      customerId: m.customerId,
      membershipId: m.id,
      name: [m.customer.firstName, m.customer.lastName].filter(Boolean).join(' '),
      phone: m.customer.phone,
      email: m.customer.email,
      segment,
      marketingConsent: m.customer.marketingConsent,
    });
  }

  return audience;
}

/**
 * MVP delivery: the audience is resolved and recorded, DOUBLE_STAMP campaigns
 * take effect in the stamp engine immediately. Email/SMS delivery plugs in here
 * as a provider without touching the rest of the platform.
 */
export async function runCampaign(
  businessId: string,
  campaignId: string,
  actor: { userId: string; label: string },
) {
  const audience = await resolveAudience(businessId, campaignId);
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { lastRunAt: new Date(), sentCount: { increment: audience.length } },
  });

  void recordAudit({
    businessId,
    actorUserId: actor.userId,
    actorLabel: actor.label,
    action: 'campaign.run',
    targetType: 'campaign',
    targetId: campaignId,
    metadata: { audienceSize: audience.length, type: campaign.type },
  });

  return { campaign, audienceSize: audience.length, audience };
}
