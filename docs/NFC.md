# The NFC stamp

## Hardware

An NTAG213 (or similar) sticker inside a branded 3D-printed stamp on the
counter. Tags cost cents; there is no reader, no terminal and no power.

Register the tag in **NFC tags** in the dashboard and write the URL it shows to
the sticker with any NFC writer app:

```
https://your-domain.example/t/AB12CD34
```

The same URL is shown as a QR code for phones that cannot read NFC — print it
next to the stamp. Both routes end in the same flow.

## What the tag knows

Nothing about the customer. The code identifies a tag, which belongs to a café
and optionally to a location. That is all. A tag that is lost or stolen is
switched off from the dashboard and stops working instantly.

## What happens on a tap

```
Customer taps the stamp
        │
        ▼
Phone opens /t/<tagCode>              (no app, no login)
        │
        ▼
Page reads the café-scoped member cookie on that phone
        │
        ├── no cookie ──► "Get your card" → join page → card + wallet pass
        │
        ▼
POST to the API: tag code + member token + request id
        │
        ▼
Server checks: tag exists · tag active · tag's café == member's café ·
               membership active · program cooldown · idempotency
        │
        ▼
+1 stamp, transaction recorded, wallet pass updated
        │
        ▼
"✓ Stamp added — 7 / 10"
```

The customer taps once and reads one line. There is nothing to press.

## Why this is safe

- **The tag is not a credential.** Knowing a tag code lets you open a page; it
  does not identify or stamp anyone.
- **The customer is proven by a signed token**, scoped to one café and stored in
  an httpOnly cookie that JavaScript on the page cannot read.
- **Cooldown.** A program setting (15 minutes by default) stops one person
  tapping repeatedly for a free coffee. Staff stamping is unaffected, so a
  customer who genuinely buys twice in an hour is still served.
- **Idempotency.** Repeat taps inside a 30-second bucket, or any client retry
  carrying the same request id, return the original stamp rather than adding
  another.
- **Rate limiting** per IP on the public surface, on top of the above.
- **Every tap is attributed** in the transaction row and the audit log: which
  tag, which location, which membership, when.
