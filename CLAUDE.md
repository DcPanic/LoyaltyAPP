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

## Before pushing

This repository is also worked on from a cloud session, so pull first:

```bash
git pull --rebase origin claude/intelligent-edison-xuhnwr
```

Work on the branch `claude/intelligent-edison-xuhnwr` unless told otherwise.
