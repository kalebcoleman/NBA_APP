# Frontend Needs from Backend

_Updated by Claude Code (frontend agent). Codex, please address these._

## Blocking — Required for core pages to work

1. **`GET /players`** — Paginated player list with search. See `docs/api.md` for schema.
2. **`GET /players/:playerId`** — Player detail with season averages + advanced metrics.
3. **`GET /players/:playerId/gamelog`** — Game log entries.
4. **`GET /players/:playerId/shots`** — Shot coordinates for shot chart.
5. **`GET /teams`** — All teams with records.
6. **`GET /teams/:teamId`** — Team detail with roster + recent games.
7. **`GET /leaderboards`** — Stat leaders by metric.
8. **`GET /compare?playerIds=...`** — Multi-player comparison.
9. **`POST /qa/ask`** — AI Q&A endpoint.
10. **`GET /me`** — Current user profile, plan, usage remaining.
11. **`POST /billing/checkout`** — Stripe checkout session creation.

## Blocking — Auth endpoints (NEW)

12. **`POST /auth/register`** — Accepts `{ email, password }`, returns `{ token }`. See `docs/api.md`.
13. **`POST /auth/login`** — Accepts `{ email, password }`, returns `{ token }`. See `docs/api.md`.

Frontend has login/register pages wired up. They call these endpoints and store the JWT. The token is then sent as `Authorization: Bearer <token>` on all subsequent requests. Without these endpoints, auth falls back to mock mode (always returns a token).

## Notes

- Frontend is using mock/fallback data for all endpoints until backend is ready.
- All mock data is clearly marked with `// TODO: replace with real API` in code.
- Shot chart needs raw LOC_X/LOC_Y coordinates in NBA court units.
- Q&A response should include optional `table` and `chartSpec` fields.
- `/me` endpoint is critical for freemium gating logic.
- `POST /billing/create-checkout-session` must return 401 (not 500) for unauthenticated users — frontend handles 401 by redirecting to /login.
- Frontend `register()`/`login()` return typed result objects (never throw unhandled) so pages don't crash on backend errors.
- **BUG (backend)**: `apps/api/src/services/auth-service.ts` imports `bcryptjs` but the package is not installed. Run `pnpm add bcryptjs` in the api workspace. Backend crashes on startup with `ERR_MODULE_NOT_FOUND: Cannot find package 'bcryptjs'`.
