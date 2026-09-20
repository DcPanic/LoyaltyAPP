# LoyaltyApp — owner & staff app

React Native (Expo SDK 57) for iOS and Android. Same backend, same accounts and
the same permissions as the web dashboard: a staff member sees the stamping
screen, an owner also sees customers and the dashboard.

Customers never install this — their card lives in Apple Wallet, Google Wallet
or the web page.

## Run it with Expo Go

**On your computer**

```bash
# 1. the backend must be running first (from the repository root)
npm run dev:api

# 2. the app
cd apps/mobile
npm install
npx expo start
```

**On your phone**

1. Install **Expo Go** from the App Store or Play Store.
2. Make sure the phone is on the **same Wi-Fi** as the computer.
3. Android: scan the QR code from inside Expo Go.
   iPhone: scan it with the Camera app and open the link.

The app finds the API by itself: it reuses the address Expo is serving the
bundle from, so if the API runs on the same computer as `expo start`, there is
nothing to configure. The sign-in screen shows which address it is using and
warns when it cannot reach it.

Sign in with the seeded accounts:

| Account | Email | Password |
|---|---|---|
| Owner | `owner@coffeehouse.cy` | `CoffeeHouse123!` |
| Barista (stamp only) | `barista@coffeehouse.cy` | `CoffeeHouse123!` |

## If the phone cannot reach the API

The sign-in screen says `Cannot reach the API at http://…`. In order of
likelihood:

1. **Windows Firewall** is blocking Node. The first time you run the API,
   Windows asks — allow it on **private networks**. If you dismissed that
   dialog, add an inbound rule for TCP port `4000` (and `8081` for Metro), or
   run once from an admin PowerShell:
   ```powershell
   New-NetFirewallRule -DisplayName "LoyaltyApp API" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -Profile Private
   New-NetFirewallRule -DisplayName "Expo Metro" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow -Profile Private
   ```
2. **Different networks** — the phone is on mobile data or a guest Wi-Fi.
3. **The API is not running**, or it crashed. Check `http://localhost:4000/health`
   in the computer's browser.
4. **Address detection failed** (some VPNs and corporate networks). Point the
   app at your computer's IP by hand — find it with `ipconfig` on Windows or
   `ifconfig | grep inet` on macOS, then create `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
   ```
   Restart `npx expo start` afterwards; `EXPO_PUBLIC_*` values are read at
   bundle time.

## What is in here

```
app/                 screens, routed by expo-router
  login.tsx          sign in, with a reachability check
  (tabs)/stamp.tsx   the barista's main screen
  (tabs)/customers   customer list, tapping opens a profile
  (tabs)/dashboard   owner statistics
  (tabs)/settings    account, role and what it may do
  scan.tsx           native QR scanner (expo-camera)
src/lib/api.ts       API client, token refresh, address detection
src/lib/session.tsx  session context shared by every screen
```

Tokens are stored in the device keychain (`expo-secure-store`), never in plain
storage. Tabs the signed-in role may not use are not rendered — and the server
refuses those requests regardless of what the app shows.

## Checks

```bash
npm run typecheck
npx expo export --platform android   # proves the app bundles
```
