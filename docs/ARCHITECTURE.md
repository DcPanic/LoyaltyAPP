# Architecture

## One backend, several faces

```
                    ┌──────────────────────────┐
  Owner / staff  ───►  React Native app (Expo)  │
                    └───────────┬──────────────┘
                                │  same REST API, same permissions
                    ┌───────────▼──────────────┐
  Owner / staff  ───►  Web app (Next.js)       │
                    └───────────┬──────────────┘
                                │
  Customer ── QR / NFC / Wallet ─┤
                                │
                    ┌───────────▼──────────────┐
                    │  API (Express + Prisma)  │
                    │  auth · tenancy · loyalty│
                    │  wallet · analytics      │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │  PostgreSQL — the source │
                    │  of truth for everything │
                    └──────────────────────────┘
```

Nothing is trusted from a client. A wallet pass, an NFC URL, a QR code and a
mobile app are all *representations* of state the database owns.

## Multi-tenancy

Every tenant-owned table carries `businessId`. A staff session resolves to
exactly one business (`StaffMembership`), and every query is written against
that id — `findFirst({ where: { id, businessId } })` rather than
`findUnique({ where: { id } })`. A café can therefore never read or write
another café's customers, staff, transactions, analytics or wallet passes, even
with a valid id in hand. The API test suite asserts this directly.

## Permissions

Roles (`OWNER`, `MANAGER`, `STAFF`) expand to a permission list in
`packages/shared/src/roles.ts`; a membership may override the list. The server
checks permissions on every route; the web app and mobile app use the same list
only to decide what to render. Staff default to counter work: find a customer,
add stamps, hand over a reward that has been earned, and put one back that was
given by mistake. They see no takings, no settings, no other staff and no
customer they have not searched for — on either platform.

## The stamp engine

`apps/api/src/services/loyalty.ts` is the only place stamps change.

1. **Replay check.** A transaction already stored under this request's
   idempotency key returns the original result. A double tap, a retry or a
   refreshed page never becomes a second stamp.
2. **Eligibility.** Membership active, program active, customer not blocked;
   self-service (NFC/QR) respects the program cooldown.
3. **Campaign multiplier.** An active double-stamp campaign multiplies the
   amount at this point, not in the client.
4. **Atomic write.** Balance, transaction row and any reward entitlement are
   written in one database transaction. The unique index on
   `(businessId, idempotencyKey)` — not a read-then-write check — is what
   guarantees exactly-once.
5. **Reward entitlements** are derived: `floor(stamps / stampsRequired)` minus
   the entitlements already pending. The balance is not reset on earning; it is
   reduced when the reward is handed over, which is what keeps the wallet card
   honest ("10/10 — reward available" until someone actually gives the coffee).
   Every path that moves a balance settles entitlements in the same
   transaction, including an owner's manual correction — otherwise a card can
   claim a reward that cannot be redeemed.
6. **Wallet sync** happens after the commit and is best-effort: a failed push
   never fails a stamp, and the next pass fetch rebuilds from the database.

## A full card at the tag

A tap on the counter tag adds a stamp, except when the card is already full and
a reward is waiting: then it hands that reward over instead, the balance drops
by one card's worth, and the customer starts again. This is what lets a full
card settle itself with nobody behind the counter, which is the point for phone
and delivery orders. The tap keeps the caller's idempotency key, so it is one
action either way and can never both stamp and redeem; an expired entitlement
falls back to an ordinary stamp rather than an error.

Because a tap can spend a card on its own, a customer who only wanted a stamp
can spend one by accident. Whoever may hand a reward over may also put it back
(`undoRedemption`): the stamps return, the entitlement opens again, and both the
redemption and the correction stay in the history.

## Realtime

The API publishes tenant-scoped events on an in-process bus; the web dashboard
subscribes through a server-sent-events endpoint proxied by Next.js, so a stamp
added in the mobile app shows up on the web within a second. For more than one
API instance, swap the bus for Redis pub/sub — that is the only change needed.

## Customer identity without a customer app

The join flow issues a long-lived **member token** (signed, audience-scoped).
The web app stores it in an httpOnly cookie *named per café*, so a customer can
hold cards from several cafés on one phone and a tag belonging to café A can
never resolve a membership of café B. The NFC tap page reads that cookie and
asks the API to stamp; a phone with no cookie is offered the join page instead.

The QR on the wallet pass carries an opaque `memberCode` — no name, no phone,
no token. It is useless without an authenticated staff session, which is what
the barista's app has.
