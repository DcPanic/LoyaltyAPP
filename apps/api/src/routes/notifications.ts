import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/http.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { walletAvailability } from '../wallet/index.js';

export const notificationRouter: Router = Router();

notificationRouter.use(requirePermission('analytics:read'));

/**
 * What the platform can tell a customer, and through which channel.
 *
 * Customers have no app, so the delivery channel is the wallet pass itself:
 * Apple devices are pushed and re-fetch the pass, Google objects are patched.
 * Anything that needs email or SMS is reported here as not yet connected
 * rather than silently dropped.
 */
notificationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const availability = walletAvailability();

    const [applePasses, googlePasses, devices, lastPush, customers, consented, pendingRewards] =
      await Promise.all([
        prisma.walletPass.count({
          where: { businessId: ctx.businessId, platform: 'APPLE', revokedAt: null },
        }),
        prisma.walletPass.count({
          where: { businessId: ctx.businessId, platform: 'GOOGLE', revokedAt: null },
        }),
        prisma.walletDeviceRegistration.count({
          where: { pass: { businessId: ctx.businessId, revokedAt: null } },
        }),
        prisma.walletPass.findFirst({
          where: { businessId: ctx.businessId, lastPushedAt: { not: null } },
          orderBy: { lastPushedAt: 'desc' },
          select: { lastPushedAt: true, platform: true },
        }),
        prisma.customer.count({ where: { businessId: ctx.businessId, status: 'ACTIVE' } }),
        prisma.customer.count({
          where: { businessId: ctx.businessId, status: 'ACTIVE', marketingConsent: true },
        }),
        prisma.rewardRedemption.count({
          where: { businessId: ctx.businessId, redeemedAt: null },
        }),
      ]);

    // Birthdays in the next 7 days, for the birthday campaign.
    const today = new Date();
    const upcoming = await prisma.customer.findMany({
      where: { businessId: ctx.businessId, status: 'ACTIVE', birthday: { not: null } },
      select: { id: true, firstName: true, lastName: true, birthday: true },
    });
    const birthdaysThisWeek = upcoming.filter((c) => {
      if (!c.birthday) return false;
      const next = new Date(
        Date.UTC(today.getUTCFullYear(), c.birthday.getUTCMonth(), c.birthday.getUTCDate()),
      );
      if (next < today) next.setUTCFullYear(today.getUTCFullYear() + 1);
      return next.getTime() - today.getTime() <= 7 * 86_400_000;
    });

    res.json({
      wallet: {
        ...availability,
        applePasses,
        googlePasses,
        appleDevices: devices,
        lastPushedAt: lastPush?.lastPushedAt ?? null,
        lastPushedPlatform: lastPush?.platform ?? null,
      },
      consent: { customers, consented },
      pendingRewards,
      birthdaysThisWeek: birthdaysThisWeek.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' '),
        birthday: c.birthday,
      })),
      channels: [
        {
          key: 'wallet_update',
          name: 'Stamp added / reward available',
          channel: 'Wallet pass',
          status: availability.apple || availability.google ? 'live' : 'needs_wallet_setup',
          description:
            'Every stamp, redemption and correction updates the customer’s wallet card. Apple devices are pushed and pull the new pass; Google objects are patched directly.',
        },
        {
          key: 'reward_ready',
          name: 'Reward is ready to collect',
          channel: 'Wallet pass',
          status: availability.apple || availability.google ? 'live' : 'needs_wallet_setup',
          description:
            'The card shows the reward as available until a barista redeems it, so the customer sees it whenever they open their wallet.',
        },
        {
          key: 'double_stamp',
          name: 'Double stamp day',
          channel: 'At the counter',
          status: 'live',
          description:
            'An active double stamp campaign applies automatically when staff or a tag adds stamps — nothing needs sending.',
        },
        {
          key: 'birthday',
          name: 'Birthday reward',
          channel: 'Email / SMS',
          status: 'not_connected',
          description:
            'The audience is resolved from consented customers with a birthday today. Connect an email or SMS provider to deliver it.',
        },
        {
          key: 'win_back',
          name: 'Win back inactive customers',
          channel: 'Email / SMS',
          status: 'not_connected',
          description:
            'At-risk and lost customers who agreed to marketing. Connect a provider to deliver the message.',
        },
      ],
    });
  }),
);
