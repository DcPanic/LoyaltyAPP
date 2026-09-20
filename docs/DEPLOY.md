# Putting it online

The platform needs three pieces running somewhere: a **database**, the **API**
and the **web app**. The phone app and the customer's wallet card are clients of
those — they hold no data of their own, which is exactly why a barista, a
customer and the owner all see the same balance.

There is no way to run this without a server. Keeping everything on one phone,
the way a personal notes or CRM app can, would mean every phone had its own
separate truth.

## What it costs

| Setup | Cost | Sleeps? | Deleted? |
|---|---|---|---|
| **Neon + Render free** | €0 | Services sleep after 15 min idle, ~1 min to wake | Nothing is deleted |
| **Neon + Vercel free** | €0 | No | Nothing is deleted |
| **Neon + Render starter** | ~$14 / month | No | No |

Free is genuinely free on all three: Neon's free project does not expire, and
neither Render nor Vercel delete a free service. Only Render's *own* free
database expires after 30 days, which is why the database lives on Neon instead.

Vercel's free plan is for non-commercial use — the moment the platform earns
money, that one needs their paid plan.

## 1. The database — Neon (both routes)

1. Sign up at <https://neon.tech> and create a project (region: Frankfurt).
2. Copy the **connection string** — it looks like
   `postgresql://user:password@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

Keep it handy; it is the only value you have to paste by hand. Prefer the
**pooled** connection string when Neon offers a choice.

## 2a. The API and web app — Render

`render.yaml` in the repository describes both services and connects them.

1. Sign up at <https://render.com>, connect GitHub (private repositories work).
2. **New → Blueprint** → pick `LoyaltyAPP` → **Apply**.
3. Render asks for `DATABASE_URL` → paste the Neon connection string. Leave the
   Apple and Google values empty for now.
4. Wait for both services to go green; the first build takes a few minutes.
5. Open the web service's address and register your café at `/register`.

Addresses wire themselves up: the API takes its own from `RENDER_EXTERNAL_URL`
(this is what wallet passes call back to) and the web app's from `APP_HOST`;
the web app gets the API's from `API_HOST`.

## 2b. The API and web app — Vercel

Same repository, two projects, no sleeping.

1. Sign up at <https://vercel.com> and import the repository **twice**:
   - **API project** — root directory: the repository root. `vercel.json` there
     already points at the serverless entry in `api/index.ts`.
     Environment variables: `DATABASE_URL` (Neon), `JWT_SECRET` (any long random
     string), `API_URL` (this project's own URL, after the first deploy) and
     `APP_URL` (the web project's URL).
   - **Web project** — root directory: `apps/web`. Environment variable:
     `API_URL` = the API project's URL.
2. Redeploy both once the URLs are filled in.

Trade-off: on a serverless host the dashboard's live stream is cut every minute
or so, so the page falls back to refreshing on a timer. Stamps are unaffected.

## 3. The mobile app in Expo Go

This part needs Node.js and a terminal on your computer, once.

```bash
cd apps/mobile
npx eas login          # your expo.dev account
npx eas init           # registers the project, writes its id into app.json
npx eas update --branch preview --message "First preview"
```

Before publishing, point the app at the hosted API in `apps/mobile/app.json`:

```json
"extra": { "apiUrl": "https://your-api-address" }
```

Then open **Expo Go**, sign in with the same account, and the project is listed
under *Projects*. It works from anywhere, because the data lives on the server
rather than on the computer.

While developing, that address is ignored — the app talks to whichever machine
serves the bundle. Only a published preview uses it. Publish again after any
change with the same `eas update` command.

## Without Expo at all

The web app is responsive. Once step 2 is done:

- staff stamping: `https://<web address>/stamp`
- owner dashboard: `https://<web address>/dashboard`

Add either to the phone's home screen and it behaves like an app — no Expo
account, no terminal. Expo Go is for previewing the native app specifically.

## After the first deploy

- Register the café at `/register`; the seeded demo data is local only.
- Wallet passes are issued with the API address they were created with, so set
  the final address **before** handing cards to customers.
- Wallet credentials go in the host's environment variables, never in the
  repository. The **Wallet cards** page in the dashboard reports what is
  missing.
