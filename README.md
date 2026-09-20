# LoyaltyApp

A multi-tenant SaaS loyalty and CRM platform for cafés.

Customers keep their loyalty card in **Apple Wallet or Google Wallet** and collect
stamps by tapping an NFC stamp on the counter, scanning a QR code, or simply
asking the barista — including over the phone for delivery orders. **Customers
never install an app.** Café owners and staff use the React Native app and the
responsive web dashboard, both on the same backend.

Wallet passes are issued, signed and updated by this platform using the café
operator's own Apple and Google credentials. **There is no PassKit.com or any
other pass provider in the stack, and no per-card fee.**

```
React Native app  ─┐
                   ├─►  API (Express + Prisma)  ─►  PostgreSQL
Web app (Next.js) ─┘             │
                                 ├─►  Apple Wallet (PKCS#7 signed .pkpass + APNs)
                                 └─►  Google Wallet (loyalty objects + save JWT)
```

## What is in the box

| Area | Status |
|---|---|
| Multi-tenant architecture, server-side tenant isolation | ✅ |
| Owner registration, branding, locations | ✅ |
| Loyalty program (stamps) with rewards and expiry | ✅ |
| Customer CRM, profiles, activity history, segments | ✅ |
| Apple Wallet passes: build, sign, web service, APNs updates | ✅ |
| Google Wallet: classes, objects, save links, updates | ✅ |
| One persistent pass per customer per café | ✅ |
| Wallet setup status page + dev certificates for local testing | ✅ |
| Home-screen card fallback while wallet credentials are pending | ✅ |
| NFC tap stamping + QR fallback, no customer app | ✅ |
| Staff stamping: scan, search, phone and delivery orders | ✅ |
| Staff accounts, invitations, role permissions | ✅ |
| Rewards, redemption, transaction history | ✅ |
| Campaigns and segmentation, double stamp days | ✅ |
| Notifications through wallet pass updates (email/SMS pluggable) | ✅ |
| Analytics, staff and location activity, retention | ✅ |
| NFC tag management, disable a lost tag instantly | ✅ |
| Audit log, idempotency, rate limiting, fraud controls | ✅ |
| GDPR export, erasure, consent records | ✅ |
| Billing model (café subscription, Stripe-ready) | scaffolded |
| Points, referrals, gift cards, POS integrations | future (see `docs/ROADMAP.md`) |

## Repository layout

```
apps/api      Express + Prisma backend: the only writer of loyalty state
apps/web      Next.js dashboard, staff console and customer-facing pages
apps/mobile   Expo / React Native app for owners and staff (iOS + Android)
packages/shared  Types, zod schemas, roles and the segment classifier
docs/         Architecture, wallet setup, NFC, security and roadmap
```

## Getting started

Requirements: Node 20+, PostgreSQL 16 (or `docker compose up -d db`).

```bash
# 1. install
npm install

# 2. database
docker compose up -d db          # or use your own PostgreSQL
cp apps/api/.env.example apps/api/.env
#    set DATABASE_URL and a long random JWT_SECRET
npm run db:migrate -w @loyaltyapp/api
npm run db:seed -w @loyaltyapp/api

# 3. run the backend and the web app
npm run dev:api                  # http://localhost:4000
npm run dev:web                  # http://localhost:3000

# 4. run the mobile app (separate install, not part of the npm workspace)
cd apps/mobile && npm install && npx expo start
```

Scan the QR code with **Expo Go** (Expo SDK 57). The app finds the API by
itself from the address Expo serves the bundle on, so a phone on the same Wi-Fi
needs no configuration — see [`apps/mobile/README.md`](apps/mobile/README.md),
including what to do when Windows Firewall blocks it.

The seed creates a demo café:

| Account | Email | Password |
|---|---|---|
| Owner | `owner@coffeehouse.cy` | `CoffeeHouse123!` |
| Barista (stamp only) | `barista@coffeehouse.cy` | `CoffeeHouse123!` |

Then:

- Owner dashboard: <http://localhost:3000/dashboard>
- Staff stamping: <http://localhost:3000/stamp>
- Customer join page: <http://localhost:3000/j/coffee-house>

## Wallet credentials

Apple Wallet and Google Wallet are switched on by configuration. Without
credentials, everything else works: the customer's card lives at its web
address and can be kept on the phone's home screen. With them, the same card is
issued to both wallets — nobody has to re-join.

**Wallet cards** in the dashboard shows exactly which credentials are missing.
To see the Apple flow end to end on your own machine before you have Apple
certificates:

```bash
npm run wallet:dev-certs -w @loyaltyapp/api -- --write   # then restart the API
```

Those passes are signed with a throwaway certificate and a real iPhone will not
install them; the dashboard warns while one is in use. The full walkthrough —
certificates, service accounts, what to put in which environment variable — is
in **[`docs/WALLET.md`](docs/WALLET.md)**.

## Tests

```bash
npm test -w @loyaltyapp/api      # stamp engine + API integration tests
npm run typecheck                # shared, api and web
```

The tests need a PostgreSQL instance; set `TEST_DATABASE_URL` if it is not
`postgresql://postgres:postgres@localhost:5432/loyaltyapp_test`.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit together
- [`docs/WALLET.md`](docs/WALLET.md) — Apple and Google Wallet without a pass provider
- [`docs/NFC.md`](docs/NFC.md) — the low-cost NFC stamp and how a tap becomes a stamp
- [`docs/SECURITY.md`](docs/SECURITY.md) — tenancy, fraud controls, GDPR
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what is deliberately left for later
