process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/loyaltyapp_test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/loyaltyapp_test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-validation-123456';
process.env.APP_URL = 'http://localhost:3000';
process.env.API_URL = 'http://localhost:4000';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.LOG_LEVEL = 'silent';
