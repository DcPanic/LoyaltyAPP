import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { auth, requirePermission } from '../middleware/auth.js';
import {
  activitySeries,
  dashboardStats,
  locationActivity,
  retentionRate,
  segmentBreakdown,
  staffActivity,
} from '../services/analytics.js';

export const analyticsRouter: Router = Router();

analyticsRouter.use(requirePermission('analytics:read'));

analyticsRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const locationId = (req.query.locationId as string | undefined) ?? null;
    const scope = { businessId: ctx.businessId, locationId };
    const [stats, series, segments] = await Promise.all([
      dashboardStats(scope),
      activitySeries(scope, 30),
      segmentBreakdown(ctx.businessId),
    ]);
    res.json({ stats, series, segments });
  }),
);

analyticsRouter.get(
  '/full',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const locationId = (req.query.locationId as string | undefined) ?? null;
    const days = Math.min(Number(req.query.days ?? 90), 365);
    const scope = { businessId: ctx.businessId, locationId };

    const [stats, series, segments, staff, locations, retention] = await Promise.all([
      dashboardStats(scope),
      activitySeries(scope, days),
      segmentBreakdown(ctx.businessId),
      staffActivity(ctx.businessId),
      locationActivity(ctx.businessId),
      retentionRate(ctx.businessId),
    ]);
    res.json({ stats, series, segments, staff, locations, retention });
  }),
);
