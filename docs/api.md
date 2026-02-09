# API Contract (Backend)

Base URL (local): `http://localhost:3001`

Auth behavior:

- If `Authorization: Bearer <jwt>` is provided, backend verifies token and resolves user identity from JWT `sub` (`userId`).
- If no token is provided, request context is anonymous (`userId=null`, `plan=FREE`) and only public endpoints are accessible.

## Health

### `GET /health`

Response:

```json
{
  "ok": true,
  "service": "nba-api",
  "timestamp": "2026-02-07T20:00:00.000Z",
  "checks": {
    "sqlite": "ok",
    "postgres": "ok"
  }
}
```

Failure response uses `503` with `ok: false` and the same `checks` object set to `"error"` values.

## Auth

### `POST /auth/register`

Body:

```json
{
  "email": "fan@example.com",
  "password": "StrongPass123!"
}
```

Notes:

- Email is normalized to lowercase and trimmed.
- Password minimum length is 8.
- JWT expiry is 7 days.

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "cm123...",
    "email": "fan@example.com",
    "plan": "FREE"
  }
}
```

### `POST /auth/login`

Body:

```json
{
  "email": "fan@example.com",
  "password": "StrongPass123!"
}
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "cm123...",
    "email": "fan@example.com",
    "plan": "FREE"
  }
}
```

### `GET /auth/me`

Requires `Authorization: Bearer <jwt>`.

Response:

```json
{
  "user": {
    "id": "cm123...",
    "email": "fan@example.com",
    "plan": "FREE",
    "actorKey": "user:cm123...",
    "isAuthenticated": true
  }
}
```

## NBA Data

### `GET /players?search=&limit=&offset=`

Returns paginated players from canonical `v_players`.

Response:

```json
{
  "data": [
    {
      "player_id": "2544",
      "full_name": "LeBron James",
      "position": "F",
      "team_abbrev": "LAL",
      "last_season": "2025-26"
    }
  ],
  "meta": {
    "limit": 25,
    "offset": 0,
    "total": 1634
  }
}
```

### `GET /players/:playerId`

Returns player profile + summary averages.

### `GET /players/:playerId/games?limit=&offset=&includeDNP=`

Returns paginated game logs ordered by most recent first (`game_date DESC`, then `game_id DESC`).

- Data is read from indexed NBA stats base tables (`nba_stats_player_box_traditional` + joins).
- `includeDNP=true` includes inactive/DNP rows.
- Alias: `GET /players/:playerId/gamelog` is identical.

Freemium behavior:

- FREE (including anonymous):
  - `limit` is capped to `5` even if client requests more.
  - `offset` is forced to `0`.
- PREMIUM:
  - `limit`/`offset` are honored, with `limit` max `200`.

Response `meta` includes effective pagination (`limit`, `offset`, `total`) and `includeDNP`.

### `GET /players/:playerId/shots?season=&limit=&offset=&scope=&gameId=`

Returns paginated shots from `v_shots`.

Query params:

- `scope=recent|all`
  - FREE default/effective scope is always `recent`.
  - PREMIUM default scope is `all`; `recent` is also allowed.

Freemium behavior:

- FREE:
  - Backend resolves the player’s last 5 played games from `v_player_game_logs_played`.
  - Shots are restricted to those game IDs only.
  - Total page size is capped (`limit` max `1500`).
- PREMIUM:
  - `scope=all` supports full history with optional `season`, `limit`, and `offset`.
  - `limit` max `5000`.

Response `meta` includes effective pagination (`limit`, `offset`, `total`) and resolved `scope`.

### `GET /teams`

Returns teams from canonical `v_teams`.

### `GET /teams/:teamId`

Returns one team + summary stats.

### `GET /games/upcoming?from=&to=&teamId=&limit=`

Returns upcoming game context sourced from ESPN data and served from the backend cache.

Query params:

- `from` (optional ISO datetime, default now)
- `to` (optional ISO datetime, default now + 14 days)
- `teamId` (optional; matches either home or away team)
- `limit` (optional; default 50, max 200)

Response:

```json
{
  "data": [
    {
      "gameId": "401811048",
      "startTime": "2026-04-13T00:30:00.000Z",
      "status": "Scheduled",
      "homeTeam": { "teamId": "6", "name": "Dallas Mavericks" },
      "awayTeam": { "teamId": "4", "name": "Chicago Bulls" },
      "homeRecord": "42-21",
      "awayRecord": "31-33",
      "homeLast10": "6-4",
      "awayLast10": "4-6",
      "lastSyncedAt": "2026-02-08T21:00:00.000Z",
      "isStale": false
    }
  ],
  "meta": {
    "from": "2026-02-08T21:00:00.000Z",
    "to": "2026-02-22T21:00:00.000Z",
    "limit": 50,
    "lastSyncedAt": "2026-02-08T21:00:00.000Z",
    "isStale": false
  }
}
```

### `GET /leaderboards?metric=&season=&limit=`

Allowed metrics:

- `points`
- `assists`
- `rebounds`
- `threePointPct`
- `trueShooting`

Response:

```json
{
  "data": [
    {
      "player_id": "1629029",
      "player_name": "Luka Doncic",
      "team_abbrev": "DAL",
      "games": 68,
      "value": 33.112
    }
  ],
  "meta": {
    "metric": "points",
    "season": "2024-25",
    "limit": 10
  }
}
```

### `GET /compare?playerA=&playerB=&season=`

Compares aggregated regular-season stats for two players.

## Entitlements / Usage

### `GET /me`

Returns current user identity, plan, limits, and today usage summary.

- Requires `Authorization: Bearer <jwt>`.
- With valid JWT: `isAuthenticated=true`, actor key is `user:<id>`.
- `PREMIUM` is granted only when the user has an `active` Stripe subscription recorded from webhook events.

Response:

```json
{
  "user": {
    "id": "cm123...",
    "actorKey": "auth:user_123",
    "plan": "FREE",
    "isAuthenticated": true
  },
  "limits": {
    "qaDailyLimit": 5,
    "qaRowLimit": 50,
    "gamesMax": 5,
    "shotsScope": "recent",
    "trendWindow": 5
  },
  "usage": {
    "date": "2026-02-07",
    "qaQueries": 1,
    "apiRequests": 14,
    "qaRemaining": 4
  }
}
```

`limits.gamesMax`, `limits.shotsScope`, and `limits.trendWindow` are plan-aware:

- FREE: `gamesMax=5`, `shotsScope="recent"`, `trendWindow=5`
- PREMIUM: `gamesMax=null`, `shotsScope="all"`, `trendWindow=null`

## Billing

### `POST /billing/create-checkout-session`

Body:

```json
{
  "interval": "monthly",
  "successUrl": "https://nba-analytics.example.com/billing/success",
  "cancelUrl": "https://nba-analytics.example.com/billing/cancel"
}
```

`interval` can be `monthly` or `annual`.
`successUrl` and `cancelUrl` are the frontend URLs Stripe should redirect to after checkout.
Requires `Authorization: Bearer <jwt>`.

Alias supported: `POST /billing/checkout` (same request/response).

Response:

```json
{
  "url": "https://checkout.stripe.com/..."
}
```

Notes:

- Requires `Authorization: Bearer <jwt>`.
- Does not grant premium locally.
- `metadata.userId` is attached to Checkout Session and subscription metadata.
- Backend should use `successUrl` and `cancelUrl` from the request body as `success_url` and `cancel_url` in `stripe.checkout.sessions.create()`. If not provided, backend should default to reasonable fallbacks.

### `POST /billing/webhook`

Stripe webhook endpoint (raw body signature verification enabled).

Handled events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Webhook signature is verified with `STRIPE_WEBHOOK_SECRET` using the raw request body.

## Q&A

### `POST /qa/ask`

Body:

```json
{
  "question": "Who are the top scorers in 2024-25?"
}
```

Requires `Authorization: Bearer <jwt>`.

Response schema:

```json
{
  "answer": "Top scorers for 2024-25 are ranked by regular-season points per game.",
  "table": {
    "columns": ["Player", "Team", "Games", "PPG"],
    "rows": [["Player Name", "TEAM", 75, 31.2]]
  },
  "chartSpec": {
    "type": "bar"
  },
  "meta": {
    "limited": false,
    "usageRemaining": 4,
    "intent": "TOP_SCORERS_SEASON"
  }
}
```

Current allowed Q&A templates:

- Top scorers by season
- Player average points over last N games
- Team net rating trend

Free-tier defaults:

- 5 Q&A requests/day
- 50 rows max per Q&A table result
