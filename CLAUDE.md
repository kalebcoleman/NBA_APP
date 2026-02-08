# AGENTS.md — Multi-agent boundaries & rules (2-agent setup)

## Project goal
Build a web-first NBA analytics platform with:
- Freemium → premium subscriptions (Stripe)
- AI-style Q&A over NBA data (safe querying)
- Dashboards (players/teams/leaderboards/compare)
- SQLite DB (editable copy)

We are using 2 agents:
- Codex = backend + DB + infra
- Claude Code = frontend + docs

The database provided is a COPY and may be modified freely.

---

## Source-of-truth inputs
The repo currently starts with:
- PDFs (product/monetization research)
- SQLite database file

These must be preserved but moved into an organized structure:
- PDFs → `docs/research/`
- DB → `db/local/nba.sqlite` (or similar)

If filenames differ, update `.env.example` and docs accordingly.

---

## Stack decisions
- Frontend: Next.js (App Router) + TypeScript + TailwindCSS + Recharts
- Backend API: Node.js + TypeScript (Express or Fastify; pick one and stay consistent)
- DB: SQLite for dev/local (Prisma recommended for schema/migrations with SQLite)
- Rate limiting + caching: optional Redis; MUST have in-memory fallback for local
- Billing: Stripe subscriptions + webhook
- Auth: NextAuth (recommended) OR backend JWT — choose one approach and document it

---

## Repo structure (target)
nba-app/
  AGENTS.md
  README.md
  .env.example
  docker-compose.yml              (optional if using redis/stripe-cli)
  docs/
    requirements.md               (derived from PDFs)
    architecture.md
    api.md
    data_model.md
    research/                     (PDFs go here)
  db/
    local/                        (local db lives here)
    migrations/                   (if using Prisma, prisma/migrations instead)
    seeds/
  apps/
    api/
      src/
        index.ts
        server.ts
        routes/
        middleware/
        services/
        db/
        billing/
        auth/
        qa/
    web/
      app/
      components/
      lib/
  packages/
    shared/                       (optional: shared types/constants)

---

## Division of responsibilities (STRICT)
### Codex owns (may edit freely)
- `apps/api/**`
- `db/**` (including moving/renaming DB file and creating migrations/seed scripts)
- root configs needed to run backend: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `docker-compose.yml`, `.env.example`
- Stripe webhook handler + entitlements + rate limiting + Q&A backend
- Shared types if needed: `packages/shared/**`

### Claude Code owns (may edit freely)
- `apps/web/**`
- `docs/**` (including reading PDFs and writing requirements)
- UI components, pages, charts, gating UX (upgrade prompts, limits reached)
- Frontend API client layer

### Both agents MAY
- Add new files within their owned areas
- Update docs to reflect env vars/endpoints they introduce

### Both agents MUST NOT
- Make sweeping refactors outside their area
- Rename API routes without updating `docs/api.md`
- Hardcode table names without inspecting the actual SQLite DB

---

## Database reality rules (IMPORTANT)
- You MUST inspect the actual SQLite database schema (tables/columns/indexes).
- Use real table/column names in queries.
- If the schema is messy, create:
  - adapter mappings OR
  - SQL views (preferred) OR
  - a minimal normalized layer
- It is allowed to modify the DB (it is a copy).

---

## API contract rules
- Backend should publish OpenAPI or a documented route list in `docs/api.md`.
- Frontend should not invent endpoints. If an endpoint is missing, Claude adds a TODO + uses mock data until Codex implements it OR files a clear request in `docs/api.md`.

---

## Minimal “Definition of Done”
Local dev should work with:
- `pnpm install`
- `pnpm dev` (runs web + api)
- Visiting web app shows:
  - Home, Players, Teams, Leaderboards, Compare, Q&A
- Q&A works (even if basic)
- Free tier limits are enforced
- Stripe integration in test mode is wired (even if not fully polished)

---

## Environment variables (must be documented in .env.example)
- DATABASE_PATH=...
- API_BASE_URL=...
- STRIPE_SECRET_KEY=...
- STRIPE_WEBHOOK_SECRET=...
- NEXTAUTH_SECRET=... (if using NextAuth)
- NEXT_PUBLIC_* variables as needed

---

## Communication protocol between agents
- Codex updates: `docs/api.md` whenever endpoints change
- Claude updates: `docs/requirements.md` and UI route list
- If blocked, write a short note in:
  - `docs/notes_frontend_needs.md` (Claude)
  - `docs/notes_backend_needs.md` (Codex)
