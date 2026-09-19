import rateLimit, { type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';
import { clientIp } from '../lib/http.js';

function build(options: Partial<Options>) {
  return rateLimit({
    windowMs: 60_000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT_DISABLED,
    keyGenerator: (req: Request) => clientIp(req) ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'rate_limited', message: 'Too many requests, please slow down' },
      });
    },
    ...options,
  });
}

/** Login / register / invite acceptance. */
export const authLimiter = build({ windowMs: 15 * 60_000, limit: 20 });

/** Public join and NFC tap pages — generous enough for a busy café, tight enough to stop abuse. */
export const publicLimiter = build({ windowMs: 60_000, limit: 30 });

/** Stamp endpoints keyed by staff user rather than IP (a café shares one IP). */
export const stampLimiter = build({
  windowMs: 60_000,
  limit: 120,
  keyGenerator: (req: Request) => req.auth?.userId ?? clientIp(req) ?? 'unknown',
});

export const apiLimiter = build({ windowMs: 60_000, limit: 600 });
