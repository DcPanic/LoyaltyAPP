# Security, fraud and privacy

## Authentication

- Passwords are hashed with bcrypt (cost 12).
- Access tokens are short-lived JWTs; refresh tokens are random, stored hashed,
  single-use and rotated on every refresh — a replayed refresh token is
  rejected and the test suite asserts it.
- The web app keeps both tokens in httpOnly cookies and talks to narrow server
  routes, so no token is ever exposed to browser JavaScript. The mobile app
  keeps them in the device keychain (`expo-secure-store`).
- Every request re-reads the staff membership, so removing a staff member ends
  their access immediately rather than at token expiry.

## Tenant isolation

Every query is scoped by `businessId` taken from the session, never from the
request body. Attempting to read or stamp another café's membership returns
404 — the object is simply not there for that tenant.

## Fraud controls on stamping

| Risk | Control |
|---|---|
| Double tap / retry / refresh | Unique `(businessId, idempotencyKey)` index; replays return the first result |
| Customer taps the NFC stamp repeatedly | Per-program self-service cooldown, default 15 minutes |
| Automated hammering of public endpoints | Rate limits on join, tap and member routes |
| Staff stamping themselves rich | Every stamp carries the staff user id; staff activity is reported per person |
| A stolen NFC tag | Disable it in the dashboard; taps stop at once |
| A screenshotted customer QR | The code is opaque and useless without an authenticated staff session |
| Silent balance edits | Corrections require `program:manage`, demand a reason, and are written to the audit log |
| Reward redeemed twice | Redemption consumes a pending entitlement inside a database transaction |

## Audit log

Stamps, removals, corrections, redemptions, customer creation and erasure,
exports, staff invitations and role changes, NFC tag changes, program and
branding changes, campaign runs — each recorded with actor, target, metadata,
IP and timestamp, and readable by owners and managers under **Activity log**.

## Wallet credentials

Apple certificates, the pass private key and the Google service-account key are
read from environment variables on the API only. They are never bundled into
the web or mobile app and never returned by an endpoint. `/v1/wallet/availability`
reports only whether each platform is configured.

## GDPR (Cyprus / EU)

- **Lawful basis and consent.** Marketing consent is captured at join time and
  written to `ConsentRecord` with source and IP. Every change — by the café or
  by the customer from their own card page — writes a new record. Campaigns
  other than double-stamp only ever include customers who consented.
- **Data minimisation.** A card needs a first name and one contact detail.
  Birthday is optional and used only for a birthday reward.
- **Access.** `GET /v1/customers/:id/export` returns everything held about one
  customer as JSON; the dashboard exposes it as a download.
- **Erasure.** Deleting a customer clears personal fields, marks the record
  deleted, revokes Apple registrations and expires the Google object, while
  leaving anonymous transaction rows so the café's historic totals stay correct.
- **Transparency.** Privacy policy and terms URLs are configured per café and
  appear on the join page and on the back of the wallet pass.

## Before going to production

- Serve everything over HTTPS; `API_URL` is embedded in issued passes.
- Set a long random `JWT_SECRET` and keep wallet keys in a secret manager.
- Put the API behind a proxy that sets `X-Forwarded-For` (rate limits and the
  audit log use it) — `trust proxy` is already enabled.
- Move the realtime bus to Redis before running more than one API instance.
- Take database backups: the database, not the wallet, is the source of truth.
