process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/loyaltyapp_test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/loyaltyapp_test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-validation-123456';
process.env.APP_URL = 'http://localhost:3000';
process.env.API_URL = 'http://localhost:4000';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.LOG_LEVEL = 'silent';

// Wallet credentials are blanked so the suite behaves the same whether or not
// the developer has real (or dev) certificates in apps/api/.env. Setting them
// rather than deleting them matters: dotenv fills in keys that are absent, but
// never overwrites one that is already present. Tests that need credentials
// assign their own before importing the wallet modules.
for (const key of [
  'APPLE_PASS_TYPE_IDENTIFIER',
  'APPLE_TEAM_IDENTIFIER',
  'APPLE_PASS_CERT_PEM',
  'APPLE_PASS_KEY_PEM',
  'APPLE_PASS_KEY_PASSPHRASE',
  'APPLE_WWDR_CERT_PEM',
  'APPLE_APNS_TOPIC',
  'GOOGLE_WALLET_ISSUER_ID',
  'GOOGLE_WALLET_SA_EMAIL',
  'GOOGLE_WALLET_SA_PRIVATE_KEY',
]) {
  process.env[key] = '';
}
