# NBA App Monorepo

Backend/infra foundation for an NBA analytics platform with hybrid data storage (SQLite analytics + PostgreSQL operational data), entitlements, usage limits, Stripe billing, and safe Q&A templates.

## Repository Layout

- `apps/api` - Fastify + TypeScript backend
- `apps/web` - frontend placeholder (implemented by frontend agent)
- `db/local/nba.sqlite` - local NBA SQLite copy (source data)
- `db/migrations/001_create_canonical_views.sql` - canonical SQL views for API queries
- `docs/research` - product research PDFs

## Prerequisites

- Node.js 20+
- pnpm 9+

## Environment

1. Copy `.env.example` to `.env`
2. Set required values:

- `DATABASE_URL=postgresql://...` (required operational DB)
- `DATABASE_PATH=./db/local/nba.sqlite` (required analytics DB)
- `POSTGRES_REQUIRED_ON_BOOT=false` (set `true` to fail-fast when Postgres is down)
- `SQLITE_READONLY=true` in production (default behavior)
- `SQLITE_WRITE_ENABLED=false` in production (default behavior)
- `SQLITE_REFRESH_ON_BOOT=false` in production (default behavior)
- `API_PORT=3001`
- `JWT_SECRET=<any strong secret>`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` (for billing)

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev:api
```

Starts API at `http://localhost:3001`.

Container note:

- API image no longer bundles `nba.sqlite`.
- Mount analytics SQLite file into container and point `DATABASE_PATH` to that mount (default inside image: `/data/nba.sqlite`).
- In production, API opens SQLite in read-only mode by default and skips cache/view rebuild writes on boot.

To run monorepo dev launcher (API + web placeholder until frontend app exists):

```bash
pnpm dev
```

## API Scripts

```bash
pnpm --filter @nba-app/api dev
pnpm --filter @nba-app/api test
pnpm --filter @nba-app/api lint
pnpm --filter @nba-app/api prisma:generate
pnpm --filter @nba-app/api prisma:migrate
pnpm --filter @nba-app/api sqlite:refresh-cache
pnpm --filter @nba-app/api sqlite:refresh-cache:all
pnpm --filter @nba-app/api backfill:postgres
```

## Testing

Run backend tests:

```bash
pnpm --filter @nba-app/api test
```

Run tests with Stripe forced off via env overrides:

```bash
NODE_ENV=test STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= STRIPE_PRICE_MONTHLY= STRIPE_PRICE_ANNUAL= pnpm --filter @nba-app/api test
```

Deterministic test behavior:

- `apps/api/tests/routes-contract.test.ts` mocks Prisma, so tests do not need a live PostgreSQL server.
- Analytics queries still use `DATABASE_PATH` (SQLite copy).
- Stripe checkout tests can be forced deterministic by disabling Stripe config in-process via `withStripeDisabled(...)`.
- In `NODE_ENV=test`, `DATABASE_URL` falls back to a local placeholder if unset and SQLite bootstrap avoids rebuilding large caches when cache rows already exist.

## Stripe Setup (Test Mode)

1. In Stripe test mode, create monthly and annual recurring prices.
2. Put the two price IDs into:
   - `STRIPE_PRICE_MONTHLY`
   - `STRIPE_PRICE_ANNUAL`
3. Set `STRIPE_SECRET_KEY`.
4. Run Stripe CLI forwarding:

```bash
stripe listen --forward-to localhost:3001/billing/webhook
```

5. Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Use `POST /billing/create-checkout-session` to open Stripe Checkout.

## Auth Model

Backend JWT auth is used.

- Register/login endpoints:
  - `POST /auth/register` with `{ email, password }`
  - `POST /auth/login` with `{ email, password }`
- Both return a JWT token (`sub = userId`, expires in 7 days).
- Send `Authorization: Bearer <jwt>` for authenticated identity.
- If missing/invalid, backend falls back to anonymous identity keyed from IP hash for public endpoints.
- `GET /me` and `POST /qa/ask` require authenticated JWT context.
- Premium requires an active subscription, unless `DEV_PREMIUM_BYPASS=true` is set for local dev.

## Q&A Safety

`POST /qa/ask` does **not** execute user-provided SQL.

- Questions are classified into a strict template allowlist.
- Each template runs parameterized SQL only.
- Season/limit values are validated and clamped.
- Free tier daily usage and row limits are enforced.

## Notes for Frontend Agent

Frontend should consume these routes and response shapes from `docs/api.md`:

- Dashboard lists: `/players`, `/teams`, `/leaderboards`
- Upcoming game context: `/games/upcoming`
- Detail pages: `/players/:playerId`, `/teams/:teamId`
- Compare: `/compare`
- Q&A: `/qa/ask`
- User plan/limits: `/me`
- Billing: `/billing/create-checkout-session`
