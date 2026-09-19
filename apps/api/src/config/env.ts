import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),

  /** Public URL of the web app (join pages, NFC tap pages, dashboard). */
  APP_URL: z.string().url().default('http://localhost:3000'),
  /** Public URL of this API — Wallet passes call back to it. */
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().default(30),
  MEMBER_TOKEN_TTL_DAYS: z.coerce.number().int().default(730),

  // ---- Apple Wallet (our own certificates, no third-party pass provider) ----
  APPLE_PASS_TYPE_IDENTIFIER: z.string().optional(),
  APPLE_TEAM_IDENTIFIER: z.string().optional(),
  /** PEM contents (not paths) so they can live in a secret manager. */
  APPLE_PASS_CERT_PEM: z.string().optional(),
  APPLE_PASS_KEY_PEM: z.string().optional(),
  APPLE_PASS_KEY_PASSPHRASE: z.string().optional(),
  APPLE_WWDR_CERT_PEM: z.string().optional(),
  APPLE_APNS_TOPIC: z.string().optional(),
  APPLE_APNS_HOST: z.string().default('https://api.push.apple.com'),

  // ---- Google Wallet (our own service account) ----
  GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
  GOOGLE_WALLET_SA_EMAIL: z.string().optional(),
  GOOGLE_WALLET_SA_PRIVATE_KEY: z.string().optional(),

  // ---- Billing (architecture only for MVP) ----
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  RATE_LIMIT_DISABLED: bool(false),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof envSchema>;

function load(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = load();

export const appleWalletConfigured = Boolean(
  env.APPLE_PASS_TYPE_IDENTIFIER &&
    env.APPLE_TEAM_IDENTIFIER &&
    env.APPLE_PASS_CERT_PEM &&
    env.APPLE_PASS_KEY_PEM &&
    env.APPLE_WWDR_CERT_PEM,
);

export const googleWalletConfigured = Boolean(
  env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SA_EMAIL && env.GOOGLE_WALLET_SA_PRIVATE_KEY,
);

export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
