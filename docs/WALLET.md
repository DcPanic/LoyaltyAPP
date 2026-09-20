# Apple Wallet and Google Wallet — on our own credentials

This platform issues wallet passes itself. There is no PassKit.com and no other
pass provider anywhere in the code or in the cost model: you pay Apple's and
Google's ordinary developer fees, not a fee per active loyalty card.

Everything below is configuration. With no credentials the platform still runs —
customers get a web card at `/m/<memberCode>` and staff can stamp normally — and
the "Add to Wallet" buttons appear as soon as the variables are set.

## Apple Wallet

### What you need from Apple

1. An Apple Developer Program account (the café platform operator's, not each
   café's — one Pass Type ID serves every tenant).
2. A **Pass Type ID**, e.g. `pass.com.yourcompany.loyaltyapp`, created under
   Certificates, Identifiers & Profiles → Identifiers → Pass Type IDs.
3. A **pass certificate** for that identifier. Create a certificate signing
   request in Keychain Access, upload it, download the `.cer`.
4. The **Apple WWDR intermediate certificate** (G4), from Apple's certificate
   authority page.
5. Your **Team ID**, shown in the developer portal membership details.

### Turning them into environment variables

```bash
# pass certificate: .cer  ->  PEM
openssl x509 -inform DER -in passcert.cer -out passcert.pem

# private key: export the certificate + key from Keychain as pass.p12, then
openssl pkcs12 -in pass.p12 -nocerts -out passkey.pem -nodes -legacy

# WWDR intermediate: .cer -> PEM
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

Set on the API:

```
APPLE_PASS_TYPE_IDENTIFIER=pass.com.yourcompany.loyaltyapp
APPLE_TEAM_IDENTIFIER=ABCDE12345
APPLE_PASS_CERT_PEM="-----BEGIN CERTIFICATE----- …"
APPLE_PASS_KEY_PEM="-----BEGIN PRIVATE KEY----- …"
APPLE_PASS_KEY_PASSPHRASE=          # only if the key is encrypted
APPLE_WWDR_CERT_PEM="-----BEGIN CERTIFICATE----- …"
APPLE_APNS_TOPIC=pass.com.yourcompany.loyaltyapp
```

Store the PEM contents in your secret manager — they are read as values, never
as file paths, and they are never sent to any frontend.

### What the platform does with them

- `apps/api/src/wallet/apple/pass.ts` builds `pass.json` (a `storeCard` with the
  café's colours, logo, stamp count, reward status and the member QR), hashes
  every file into `manifest.json`, signs the manifest as a **detached PKCS#7**
  with your certificate, and zips the result as a `.pkpass`.
- `apps/api/src/routes/wallet.ts` implements Apple's **pass web service**:
  device registration, the changed-serial-numbers query, the latest-pass fetch
  and de-registration, all authenticated with the per-pass `ApplePass` token.
- `apps/api/src/wallet/apple/apns.ts` pushes an empty background notification
  over HTTP/2 to `api.push.apple.com`, authenticated with the same pass
  certificate. The device then pulls the fresh pass from us. A `410` response
  drops the stale device registration.

`API_URL` must be a public HTTPS address in production — it is baked into every
pass as `webServiceURL`.

## Google Wallet

### What you need from Google

1. A Google Wallet API issuer account (Google Pay & Wallet Console) — note the
   **issuer id**.
2. A Google Cloud **service account** with the Wallet Object Issuer role, and a
   JSON key.
3. Authorise the service account email in the Wallet console.

```
GOOGLE_WALLET_ISSUER_ID=3388000000022xxxxxx
GOOGLE_WALLET_SA_EMAIL=wallet@your-project.iam.gserviceaccount.com
GOOGLE_WALLET_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…"
```

(The `\n` escapes in the key are handled for you.)

### What the platform does with them

- `apps/api/src/wallet/google/client.ts` gets an access token with the JWT
  bearer grant, creates or updates one **loyalty class** per café program and
  one **loyalty object** per membership, and signs the
  `https://pay.google.com/gp/v/save/<jwt>` link behind the "Add to Google
  Wallet" button.
- Every stamp, removal, reward and redemption patches the same object. The
  object id is derived from the member code, so a customer keeps one card
  forever.

## One persistent pass per customer

`WalletPass` is unique on `(membershipId, platform)`. A stamp never creates a
pass; it updates the one that exists. Deleting a customer (GDPR erasure)
revokes the Apple registrations and expires the Google object.

## Where to check what is missing

**Wallet cards** in the dashboard lists every credential, says which ones are
set, warns when a pass certificate is self-signed, and shows the pass web
service address your passes were issued with. `GET /v1/wallet/availability`
answers the same question for scripts.

## Trying Apple Wallet before you have Apple credentials

```bash
npm run wallet:dev-certs -w @loyaltyapp/api -- --write   # then restart the API
```

This writes a throwaway certificate chain to `apps/api/.env`. The whole flow
then runs on your machine: the "Add to Apple Wallet" button appears, the
`.pkpass` is built, signed and served, the pass web service authenticates, and
every stamp updates the pass.

**A real iPhone will refuse to install these passes** — the signature is not
Apple's. Use it to develop and demo; replace the values with the real
certificates before customers touch it. The dashboard shows a red warning for
as long as a self-signed certificate is in use.

## Before wallet credentials exist

Nothing blocks the loyalty program. The customer's card lives at
`/m/<memberCode>`: stamps, the QR the barista scans, and an *Add to Home
Screen* prompt so it sits on their phone like an app, with the café's own icon
and colours (each card serves its own web app manifest). When you later switch
Apple or Google on, the same card gains the wallet buttons — nobody has to
re-join.
