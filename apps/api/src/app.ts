import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { corsOrigins, env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { businessRouter } from './routes/business.js';
import { programRouter, rewardRouter } from './routes/programs.js';
import { customerRouter } from './routes/customers.js';
import { stampingRouter } from './routes/stamping.js';
import { staffRouter } from './routes/staff.js';
import { nfcRouter } from './routes/nfc.js';
import { campaignRouter } from './routes/campaigns.js';
import { analyticsRouter } from './routes/analytics.js';
import { auditRouter } from './routes/audit.js';
import { notificationRouter } from './routes/notifications.js';
import { billingRouter } from './routes/billing.js';
import { mediaRouter } from './routes/media.js';
import { publicRouter } from './routes/public.js';
import { walletRouter } from './routes/wallet.js';
import { eventsRouter } from './routes/events.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req: { url?: string }) => req.url === '/health' } }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, time: new Date().toISOString() });
  });

  // Public, customer-facing surface (no account, no app).
  app.use('/v1/public', publicRouter);
  // Wallet: Apple's pass web service and the Google save links.
  app.use('/v1/wallet', walletRouter);
  app.use('/v1/auth', apiLimiter, authRouter);

  // Everything below is tenant-scoped and requires a staff session.
  app.use('/v1/business', apiLimiter, requireAuth, businessRouter);
  app.use('/v1/programs', apiLimiter, requireAuth, programRouter);
  app.use('/v1/rewards', apiLimiter, requireAuth, rewardRouter);
  app.use('/v1/customers', apiLimiter, requireAuth, customerRouter);
  app.use('/v1/stamping', requireAuth, stampingRouter);
  app.use('/v1/staff', apiLimiter, requireAuth, staffRouter);
  app.use('/v1/nfc', apiLimiter, requireAuth, nfcRouter);
  app.use('/v1/campaigns', apiLimiter, requireAuth, campaignRouter);
  app.use('/v1/analytics', apiLimiter, requireAuth, analyticsRouter);
  app.use('/v1/audit', apiLimiter, requireAuth, auditRouter);
  app.use('/v1/notifications', apiLimiter, requireAuth, notificationRouter);
  app.use('/v1/billing', apiLimiter, requireAuth, billingRouter);
  app.use('/v1/media', apiLimiter, requireAuth, mediaRouter);
  app.use('/v1/events', requireAuth, eventsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
