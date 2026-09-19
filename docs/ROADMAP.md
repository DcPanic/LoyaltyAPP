# Roadmap

The MVP is deliberately a stamp-card platform done properly. The data model and
the service boundaries were chosen so the following can be added without a
rewrite.

## Ready in the model, not yet built

- **Points loyalty.** `LoyaltyProgram` already separates the earning rule from
  the reward; a points program adds a program type and a second earning path in
  the stamp engine. `Transaction.amount` is already an integer ledger.
- **Multiple rewards per program.** `Reward` supports several per program with
  their own thresholds and expiry; the redemption flow picks one today.
- **Email and SMS delivery for campaigns.** `resolveAudience` returns the
  audience with consent already applied; a provider plugs in at `runCampaign`.
- **Stripe billing.** `Subscription` carries the Stripe customer and
  subscription ids; `/v1/billing/checkout` is the seam.

## Needs new tables, not new architecture

- Referrals, gift cards, memberships and coupons
- POS, online ordering and delivery integrations
- Payment-linked loyalty
- Advanced marketing automation (journeys, triggers)

## Platform work

- Redis pub/sub in place of the in-process event bus, for multiple API instances
- Background job runner for scheduled campaigns and birthday rewards
- Apple VAS / Google Smart Tap for terminal-based tap-to-identify, when a café
  has reader hardware
- AI customer insights and churn prediction on top of the existing transaction
  history and segment classifier

## Explicitly not planned

- A customer-facing mobile app. The customer experience is Apple Wallet, Google
  Wallet, NFC, QR and the web card.
- Any third-party wallet pass provider. Passes stay on the operator's own Apple
  and Google credentials.
