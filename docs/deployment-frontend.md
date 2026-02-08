# Frontend Deployment Guide

## Overview

The NBA Analytics frontend is a Next.js 14 App Router application deployed to **Azure App Service** with standalone output mode. It communicates with a separately deployed API backend.

## Prerequisites

- Azure account with an App Service (Node 18+ Linux)
- GitHub repository connected to Azure for CI/CD
- API backend deployed and accessible at a public URL
- Stripe account in test mode (for billing flow)

## Environment Variables

Set these in Azure App Service → Configuration → Application Settings:

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `https://nba-api.azurewebsites.net` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | `pk_test_...` |

These are **build-time** variables (prefixed `NEXT_PUBLIC_`). They must be set as **GitHub repository variables** (Settings → Variables → Actions) so the CI workflow can inject them at build time.

> Do NOT set `NEXT_PUBLIC_USE_MOCKS=true` in production.

## Deployment Options

### Option A: Azure App Service (Recommended)

The frontend uses `output: "standalone"` in `next.config.js`, which bundles a self-contained Node.js server.

**Manual deployment:**
```bash
cd apps/web
NEXT_PUBLIC_API_BASE_URL=https://your-api.azurewebsites.net npm run build
cp -r public .next/standalone/apps/web/public
cp -r .next/static .next/standalone/apps/web/.next/static
# Deploy .next/standalone/ to App Service
```

**Startup command** (set in Azure Portal → Configuration → General settings):
```
node apps/web/server.js
```

The port is auto-configured by Azure via the `PORT` environment variable.

**CI/CD:** The workflow at `.github/workflows/deploy-frontend.yml` automates build and deploy on push to `main`. Required secrets/variables:
- Secret: `AZURE_WEBAPP_PUBLISH_PROFILE` — download from Azure Portal → App Service → Get publish profile
- Variable: `NEXT_PUBLIC_API_BASE_URL` — your deployed API URL

### Option B: Azure Static Web Apps

If you prefer static hosting, remove `output: "standalone"` from `next.config.js`. Note that SSR/dynamic routes (`/players/[playerId]`, `/teams/[teamId]`) will become client-rendered.

Create a `staticwebapp.config.json` in `apps/web/`:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html"
  }
}
```

## Stripe Billing Flow

### How it works

1. User clicks "Upgrade to Premium" anywhere in the app
2. Frontend calls `POST /billing/create-checkout-session` with `{ interval, successUrl, cancelUrl }`
3. Backend creates a Stripe Checkout Session and returns `{ url }`
4. Browser redirects to Stripe-hosted checkout page
5. After payment:
   - **Success** → Stripe redirects to `/billing/success`
   - **Cancel** → Stripe redirects to `/billing/cancel`

### Billing pages

| Route | Behavior |
|-------|----------|
| `/billing/success` | Polls `GET /me` up to 10 times (every 3s) waiting for `plan: "PREMIUM"`. Shows confirmation when confirmed, retry button if webhook is slow. |
| `/billing/cancel` | Static page with "Upgrade canceled" message and links back to the app. |

### Error handling

| Scenario | Behavior |
|----------|----------|
| User not logged in | Redirects to `/login?next=<current-path>` |
| API returns 401 | Redirects to login |
| API returns 500+ | Shows "Billing service unavailable" toast (auto-dismisses) |
| Stripe not configured | Shows "Billing is not configured" toast |

### Backend requirements for Stripe

The backend must:
1. Accept `successUrl` and `cancelUrl` in the checkout request body
2. Pass them to `stripe.checkout.sessions.create({ success_url, cancel_url })`
3. Handle the Stripe webhook (`checkout.session.completed`) to update the user's plan
4. Return the updated plan in `GET /me`

## Premium State

Premium state is **entirely API-driven**. The frontend:
- Calls `GET /me` on page load via `AuthProvider`
- Checks `user.plan === "premium"` to gate features
- Never stores or toggles plan state locally
- Re-fetches `/me` on the billing success page to confirm upgrade

## Post-Deploy Verification Checklist

1. Visit the deployed URL — home page loads
2. Browse `/players`, `/teams`, `/leaderboards` — data loads from API
3. As anonymous user — free-tier gating appears (limited rows, locked features)
4. Sign in → click "Upgrade to Premium" → redirected to Stripe Checkout
5. Complete test payment → redirected to `/billing/success`
6. Success page polls and confirms premium status
7. Navigate back to app — Premium badge in navbar, all features unlocked
8. Cancel a checkout → redirected to `/billing/cancel` with friendly message
