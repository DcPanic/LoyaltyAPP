# Putting it online

Two separate things, in this order:

1. **Host the platform** — the API, the database and the web app. Once this is
   done, everything works from anywhere: the owner dashboard, the staff
   stamping screen, the customer join page and the wallet cards.
2. **Publish the mobile app** to an Expo account, so it can be opened in Expo
   Go on a phone.

Step 1 is done entirely in a browser. Step 2 needs a terminal once.

## 1. Host it — Render blueprint

`render.yaml` in the repository root describes the whole deployment: a
PostgreSQL database, the API and the web app, wired to each other.

1. Create an account at <https://render.com> and connect GitHub (Render works
   with private repositories).
2. **New → Blueprint** → pick the `LoyaltyAPP` repository → **Apply**.
3. Wait for the three services to go green (the first build takes a few
   minutes).
4. Open the web service's URL and register your café at `/register`.

That is all. The services find each other's addresses by themselves:

- the API takes its own public address from `RENDER_EXTERNAL_URL`, which is what
  wallet passes call back to;
- the API learns the web app's address from `APP_HOST`, for join links;
- the web app learns the API's address from `API_HOST`;
- `JWT_SECRET` is generated once by Render and never leaves it.

### What the free plan means

The blueprint uses free plans, which are enough to try the platform:

| | Free | What to change for real use |
|---|---|---|
| API and web | Sleep after 15 minutes idle, ~1 minute to wake | `plan: starter` |
| Database | Removed after 30 days | `plan: basic-256mb` |

A sleeping service is fine while testing and wrong for a café: a customer
scanning the join QR would wait a minute. Change the plans before real
customers touch it.

### Wallet credentials

The Apple and Google values in `render.yaml` are marked `sync: false`, so Render
asks for them instead of reading them from the repository. Leave them empty
until you have them — everything else works, and the **Wallet cards** page in
the dashboard shows what is still missing. See [`WALLET.md`](WALLET.md).

## 2. Publish the mobile app to Expo Go

This needs Node.js on your computer and a terminal, once. Everything after that
is a single command.

```bash
# from the repository, in apps/mobile
npx eas login          # your expo.dev account
npx eas init           # creates the project, writes its id into app.json
npx eas update --branch preview --message "First preview"
```

Then open **Expo Go** on the phone, sign in with the same account, and the
project appears under *Projects*. It opens from anywhere — no computer, no
Wi-Fi requirement — because the app talks to the hosted API.

Point the published app at the hosted API by setting it in `apps/mobile/app.json`
before publishing:

```json
"extra": { "apiUrl": "https://loyaltyapp-api.onrender.com" }
```

While developing, that value is ignored: the app uses whichever machine is
serving the bundle. Only a published preview uses it.

Publish again after any change to the app with the same `eas update` command.

## Without Expo: the phone browser

The web app is responsive and works on a phone as it is. Once step 1 is done:

- staff stamping: `https://<your-web-service>/stamp`
- owner dashboard: `https://<your-web-service>/dashboard`

Add either to the home screen and it behaves like an app. This needs no Expo
account and no terminal — step 2 is for seeing the native app.
