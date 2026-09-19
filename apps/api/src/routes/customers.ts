import { Router } from 'express';
import { consentSchema, customerSchema, customerSearchSchema } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody, parseQuery } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';
import {
  createCustomerManually,
  getCustomerProfile,
  listCustomers,
} from '../services/customers.js';
import { deleteCustomer, exportCustomer } from '../services/gdpr.js';
import { recordAudit } from '../services/audit.js';
import { bus } from '../lib/events.js';
import { env } from '../config/env.js';

export const customerRouter: Router = Router();

customerRouter.get(
  '/',
  requirePermission('customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const params = parseQuery(customerSearchSchema, req);
    res.json(await listCustomers(ctx.businessId, params));
  }),
);

customerRouter.post(
  '/',
  requirePermission('customer:write'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(customerSchema, req);
    const result = await createCustomerManually(
      ctx.businessId,
      { ...input, marketingConsent: input.marketingConsent ?? false },
      { userId: ctx.userId, label: ctx.name },
    );
    res.status(201).json({
      customer: result.customer,
      membership: result.membership,
      memberPageUrl: `${env.APP_URL}/m/${result.membership.memberCode}`,
    });
  }),
);

customerRouter.get(
  '/:id',
  requirePermission('customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    res.json(await getCustomerProfile(ctx.businessId, req.params.id!));
  }),
);

customerRouter.patch(
  '/:id',
  requirePermission('customer:write'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(customerSchema.partial(), req);
    const { count } = await prisma.customer.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId, status: { not: 'DELETED' } },
      data: {
        ...input,
        birthday: input.birthday ? new Date(input.birthday) : undefined,
      },
    });
    if (count === 0) throw notFound('Customer not found');
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'customer.update',
      targetType: 'customer',
      targetId: req.params.id!,
      metadata: { fields: Object.keys(input) },
      ip: clientIp(req),
    });
    bus.publish({ type: 'customer.updated', businessId: ctx.businessId, customerId: req.params.id! });
    res.json(await prisma.customer.findUnique({ where: { id: req.params.id! } }));
  }),
);

/** GDPR: record of consent changes, never a silent flag flip. */
customerRouter.post(
  '/:id/consent',
  requirePermission('customer:write'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(consentSchema, req);
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id!, businessId: ctx.businessId },
    });
    if (!customer) throw notFound('Customer not found');

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: { marketingConsent: input.marketingConsent },
      }),
      prisma.consentRecord.create({
        data: {
          businessId: ctx.businessId,
          customerId: customer.id,
          granted: input.marketingConsent,
          source: input.source,
          ip: clientIp(req) ?? null,
        },
      }),
    ]);
    res.status(204).end();
  }),
);

customerRouter.get(
  '/:id/export',
  requirePermission('customer:export'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const data = await exportCustomer(ctx.businessId, req.params.id!);
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'customer.export',
      targetType: 'customer',
      targetId: req.params.id!,
      ip: clientIp(req),
    });
    res.setHeader('Content-Disposition', `attachment; filename="customer-${req.params.id}.json"`);
    res.json(data);
  }),
);

customerRouter.delete(
  '/:id',
  requirePermission('customer:delete'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    await deleteCustomer(ctx.businessId, req.params.id!, { userId: ctx.userId, label: ctx.name });
    res.status(204).end();
  }),
);

/** CSV export of the whole customer list. */
customerRouter.get(
  '/export/csv',
  requirePermission('customer:export'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { items } = await listCustomers(ctx.businessId, { limit: 100 });
    const header = 'first_name,last_name,phone,email,stamps,total_stamps,rewards,segment,joined_at';
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = items.map((c) =>
      [
        c.firstName,
        c.lastName,
        c.phone,
        c.email,
        c.stamps,
        c.totalStamps,
        c.rewardsRedeemed,
        c.segment,
        c.joinedAt,
      ]
        .map(escape)
        .join(','),
    );
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'customer.export_csv',
      ip: clientIp(req),
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send([header, ...rows].join('\n'));
  }),
);
