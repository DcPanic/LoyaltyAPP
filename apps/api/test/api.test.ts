import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { randomCode, sha256 } from '../src/lib/crypto.js';

const app = createApp();

async function registerBusiness(name: string, email: string) {
  const res = await request(app).post('/v1/auth/register').send({
    businessName: name,
    ownerName: 'Owner',
    email,
    password: 'SuperSecret123!',
    country: 'CY',
    currency: 'EUR',
    timezone: 'Asia/Nicosia',
  });
  expect(res.status).toBe(201);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; businessId: string };
    business: { id: string; slug: string };
  };
}

describe('API', () => {
  let cafeA: Awaited<ReturnType<typeof registerBusiness>>;
  let cafeB: Awaited<ReturnType<typeof registerBusiness>>;

  beforeAll(async () => {
    const suffix = randomCode(6).toLowerCase();
    cafeA = await registerBusiness('Coffee House', `a-${suffix}@example.com`);
    cafeB = await registerBusiness('Espresso Corner', `b-${suffix}@example.com`);
  });

  it('registers a business with a program, a location and a trial subscription', async () => {
    const res = await request(app)
      .get('/v1/business')
      .set('authorization', `Bearer ${cafeA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(1);
    expect(res.body.subscription.status).toBe('TRIALING');
    expect(res.body.joinUrl).toContain(`/j/${cafeA.business.slug}`);
  });

  it('lets a customer join from the public page without an account', async () => {
    const page = await request(app).get(`/v1/public/business/${cafeA.business.slug}`);
    expect(page.status).toBe(200);
    expect(page.body.program.stampsRequired).toBe(10);

    const join = await request(app)
      .post(`/v1/public/join/${cafeA.business.slug}`)
      .send({
        firstName: 'Maria',
        lastName: 'K.',
        phone: '+35799123456',
        marketingConsent: true,
        termsAccepted: true,
      });

    expect(join.status).toBe(201);
    expect(join.body.memberToken).toBeTruthy();
    expect(join.body.membership.stamps).toBe(0);
    expect(join.body.memberPageUrl).toContain(join.body.memberCode);
  });

  it('keeps tenants isolated', async () => {
    const join = await request(app)
      .post(`/v1/public/join/${cafeA.business.slug}`)
      .send({
        firstName: 'Giorgos',
        phone: '+35799222333',
        marketingConsent: false,
        termsAccepted: true,
      });
    const membershipId = join.body.membershipId as string;

    // Café B may not read or stamp café A's membership.
    const readAsB = await request(app)
      .get(`/v1/stamping/card/${membershipId}`)
      .set('authorization', `Bearer ${cafeB.accessToken}`);
    expect(readAsB.status).toBe(404);

    const stampAsB = await request(app)
      .post('/v1/stamping/stamp')
      .set('authorization', `Bearer ${cafeB.accessToken}`)
      .send({ membershipId, amount: 1 });
    expect(stampAsB.status).toBe(404);

    const stampAsA = await request(app)
      .post('/v1/stamping/stamp')
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .set('idempotency-key', `tenant-test-${randomCode(8)}`)
      .send({ membershipId, amount: 1 });
    expect(stampAsA.status).toBe(200);
    expect(stampAsA.body.membership.stamps).toBe(1);
  });

  it('honours the Idempotency-Key header on repeated stamp requests', async () => {
    const join = await request(app)
      .post(`/v1/public/join/${cafeA.business.slug}`)
      .send({ firstName: 'Elena', phone: '+35799444555', termsAccepted: true, marketingConsent: false });
    const membershipId = join.body.membershipId as string;
    const key = `retry-${randomCode(10)}`;

    const first = await request(app)
      .post('/v1/stamping/stamp')
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .set('idempotency-key', key)
      .send({ membershipId, amount: 1 });
    const second = await request(app)
      .post('/v1/stamping/stamp')
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .set('idempotency-key', key)
      .send({ membershipId, amount: 1 });

    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.membership.stamps).toBe(1);
  });

  it('restricts staff to stamping only', async () => {
    const invite = await request(app)
      .post('/v1/staff/invite')
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .send({ name: 'Barista', email: `barista-${randomCode(6)}@example.com`, role: 'STAFF' });
    expect(invite.status).toBe(201);

    const token = (invite.body.inviteUrl as string).split('/invite/')[1]!;
    const accepted = await request(app).post('/v1/auth/accept-invite').send({
      token,
      name: 'Barista',
      password: 'SuperSecret123!',
    });
    expect(accepted.status).toBe(201);
    const staffToken = accepted.body.accessToken as string;

    const analytics = await request(app)
      .get('/v1/analytics/dashboard')
      .set('authorization', `Bearer ${staffToken}`);
    expect(analytics.status).toBe(403);

    const staffList = await request(app)
      .get('/v1/staff')
      .set('authorization', `Bearer ${staffToken}`);
    expect(staffList.status).toBe(403);

    const search = await request(app)
      .get('/v1/stamping/search?q=Maria')
      .set('authorization', `Bearer ${staffToken}`);
    expect(search.status).toBe(200);
  });

  it('stamps through an NFC tag and rejects a disabled tag', async () => {
    const tag = await request(app)
      .post('/v1/nfc')
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .send({ label: 'Counter stamp' });
    expect(tag.status).toBe(201);
    const code = tag.body.code as string;

    const join = await request(app)
      .post(`/v1/public/join/${cafeA.business.slug}`)
      .send({ firstName: 'Nikos', phone: '+35799777888', termsAccepted: true, marketingConsent: false });
    const memberToken = join.body.memberToken as string;

    const tap = await request(app).post(`/v1/public/tap/${code}`).send({ memberToken });
    expect(tap.status).toBe(200);
    expect(tap.body.membership.stamps).toBe(1);

    // A replayed tap inside the same time bucket must not add a second stamp.
    const replay = await request(app).post(`/v1/public/tap/${code}`).send({ memberToken });
    expect(replay.body.duplicate).toBe(true);
    expect(replay.body.membership.stamps).toBe(1);

    await request(app)
      .patch(`/v1/nfc/${tag.body.id}`)
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .send({ isActive: false });

    const afterDisable = await request(app).post(`/v1/public/tap/${code}`).send({ memberToken });
    expect(afterDisable.status).toBe(403);
  });

  it('refuses a member token from another café on a tag', async () => {
    const tag = await request(app)
      .post('/v1/nfc')
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .send({ label: 'Cross tenant tag' });

    const joinB = await request(app)
      .post(`/v1/public/join/${cafeB.business.slug}`)
      .send({ firstName: 'Sofia', phone: '+35799999000', termsAccepted: true, marketingConsent: false });

    const tap = await request(app)
      .post(`/v1/public/tap/${tag.body.code}`)
      .send({ memberToken: joinB.body.memberToken });
    expect(tap.status).toBe(403);
  });

  it('rotates refresh tokens and rejects a reused one', async () => {
    const first = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: cafeB.refreshToken });
    expect(first.status).toBe(200);

    const reuse = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: cafeB.refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('erases a customer on request but keeps the café totals', async () => {
    const join = await request(app)
      .post(`/v1/public/join/${cafeA.business.slug}`)
      .send({ firstName: 'Petros', phone: '+35799555666', termsAccepted: true, marketingConsent: true });
    const customerId = (
      await prisma.loyaltyMembership.findUnique({ where: { id: join.body.membershipId } })
    )!.customerId;

    await request(app)
      .post('/v1/stamping/stamp')
      .set('authorization', `Bearer ${cafeA.accessToken}`)
      .set('idempotency-key', `erase-${randomCode(8)}`)
      .send({ membershipId: join.body.membershipId, amount: 2 });

    const exported = await request(app)
      .get(`/v1/customers/${customerId}/export`)
      .set('authorization', `Bearer ${cafeA.accessToken}`);
    expect(exported.status).toBe(200);
    expect(exported.body.transactions.length).toBeGreaterThan(0);

    const deleted = await request(app)
      .delete(`/v1/customers/${customerId}`)
      .set('authorization', `Bearer ${cafeA.accessToken}`);
    expect(deleted.status).toBe(204);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    expect(customer?.phone).toBeNull();
    expect(customer?.status).toBe('DELETED');

    const stamps = await prisma.transaction.count({ where: { customerId, type: 'STAMP_ADD' } });
    expect(stamps).toBe(1);
  });

  it('exposes wallet availability without leaking credentials', async () => {
    const res = await request(app).get('/v1/wallet/availability');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ apple: false, google: false });
  });

  it('never accepts an Apple pass web service call without the pass token', async () => {
    const res = await request(app)
      .get(`/v1/wallet/apple/v1/passes/pass.test/${sha256('x').slice(0, 16)}`)
      .set('authorization', 'ApplePass wrong-token');
    expect(res.status).toBe(401);
  });
});
