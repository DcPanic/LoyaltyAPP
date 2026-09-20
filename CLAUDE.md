# LoyaltyApp — notes for Claude

## Who you are working with

The owner of this project is **not a programmer** and reads Greek.

- Answer in Greek, in plain words. No jargon without explaining it once.
- Prefer doing things over telling them how: run the commands yourself and
  report what happened.
- Never assume they know what a terminal error means — read it for them.
- When something needs their hands (a website, a phone, a password), give
  numbered steps and say what they should see after each one.

## What this is

A multi-tenant SaaS loyalty and CRM platform for cafés. Customers keep their
loyalty card in Apple Wallet or Google Wallet and collect stamps by tapping an
NFC sticker, scanning a QR code, or asking the barista — including by phone for
delivery orders. **Customers never install an app.** Owners and staff use the
React Native app and the web dashboard, both on the same backend.

Wallet passes are built and signed by this platform with the operator's own
Apple and Google credentials. **No PassKit.com or other pass provider** — that
is a product requirement, not an implementation detail.

## Layout

```
apps/api      Express + Prisma backend — the only writer of loyalty state
apps/web      Next.js dashboard, staff console and customer-facing pages
apps/mobile   Expo / React Native app (separate install, not in the workspace)
packages/shared  Types, zod schemas, roles, the segment classifier
docs/         Architecture, wallet setup, NFC, security, deployment, ΟΔΗΓΟΣ.md
scripts/      setup.mjs (first run) and preview.mjs (phone preview via tunnel)
```

## Commands

```bash
npm run setup            # first time: database address, tables, demo data
npm run preview          # phone preview through Expo Go, works off-network
npm run dev:api          # http://localhost:4000
npm run dev:web          # http://localhost:3000
npm test                 # API tests (needs PostgreSQL reachable)
npm run typecheck        # shared + api + web
cd apps/mobile && npx tsc --noEmit    # mobile
```

## Rules that matter

- **Tenant isolation.** Every tenant-owned query is scoped by `businessId` taken
  from the session, never from the request body. Use `findFirst({ where: { id,
  businessId } })`, not `findUnique({ where: { id } })`.
- **Permissions are server-side.** The apps use the permission list only to
  decide what to render; every route checks it again.
- **Stamps are exactly-once.** The unique index on
  `(businessId, idempotencyKey)` is what guarantees it — not a read-then-write
  check. Do not weaken this.
- **The database is the source of truth.** A wallet pass, an NFC URL, a QR code
  and a mobile app are representations of it.
- **Secrets never enter the repository.** Wallet certificates and database
  passwords live in environment variables; `.env` files are ignored by git.
- Keep the tests green: `npm test` before saying something is done.

## How we work

Branch: `claude/intelligent-edison-xuhnwr` unless told otherwise.

**Pull before you start.** The repository is also worked on from a cloud
session:

```bash
git pull --rebase origin claude/intelligent-edison-xuhnwr
```

**Commit and push after every change that works.** The owner asked for this
explicitly: nothing should live only on their laptop. A change is finished when
it is pushed, not when it runs locally.

```bash
git add -A && git commit -m "..." && git push origin claude/intelligent-edison-xuhnwr
```

Do not wait to be asked, and do not batch a day's work into one commit. One
commit per coherent change, with a message that says what changed and why.
Never commit a `.env` file, a certificate or a database password — they are
ignored by git and must stay that way.

## Where the project stands

Working end to end, with tests: multi-tenancy, owner and staff accounts with
server-side permissions, loyalty programs, the stamp engine (staff, NFC tap, QR
fallback, phone and delivery orders), rewards and redemption, customer CRM with
segments, campaigns, analytics, NFC tag management, audit log, GDPR export and
erasure, the Apple Wallet pass writer and web service, the Google Wallet client,
the responsive web app and the Expo app.

Deliberately not done yet:

- **Apple and Google credentials.** The code is complete and tested against a
  throwaway certificate (`npm run wallet:dev-certs -w @loyaltyapp/api -- --write`),
  but real passes need an Apple Developer account and a Google Wallet issuer.
  The **Wallet cards** page in the dashboard reports what is missing.
- **Email and SMS.** Campaign audiences resolve correctly; no provider is
  connected, and the Notifications page says so rather than pretending.
- **Stripe.** The subscription model exists; checkout is a stub.
- **Redis.** Live updates use an in-process bus, fine for one API instance.

Immediate goal: the owner wants to use the app on their phone through Expo Go,
from anywhere, with `npm run setup` once and `npm run preview` after that.
Hosting it so their laptop can be switched off is the step after
(`docs/DEPLOY.md`).
