import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/http.js';
import { auth, requirePermission } from '../middleware/auth.js';

export const auditRouter: Router = Router();

auditRouter.get(
  '/',
  requirePermission('audit:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const cursor = req.query.cursor as string | undefined;

    const items = await prisma.auditLog.findMany({
      where: {
        businessId: ctx.businessId,
        ...(req.query.action ? { action: String(req.query.action) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    res.json({
      items: items.slice(0, limit),
      nextCursor: hasMore ? (items[limit - 1]?.id ?? null) : null,
    });
  }),
);
