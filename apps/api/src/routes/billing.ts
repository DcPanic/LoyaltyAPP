import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/http.js';
import { notConfigured } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';

export const billingRouter: Router = Router();

billingRouter.use(requirePermission('billing:manage'));

/**
 * Billing is per café subscription, never per loyalty card or per customer.
 * Stripe is wired in behind this interface; the MVP tracks the trial locally.
 */
billingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: ctx.businessId },
    });
    const [customers, stampsThisMonth] = await Promise.all([
      prisma.customer.count({ where: { businessId: ctx.businessId, status: 'ACTIVE' } }),
      prisma.transaction.aggregate({
        where: {
          businessId: ctx.businessId,
          type: 'STAMP_ADD',
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      subscription,
      usage: { customers, stampsThisMonth: stampsThisMonth._sum.amount ?? 0 },
      stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
    });
  }),
);

billingRouter.post(
  '/checkout',
  asyncHandler(async () => {
    throw notConfigured(
      'Stripe is not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID to enable checkout.',
    );
  }),
);
