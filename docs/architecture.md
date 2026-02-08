# Architecture — Frontend View

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS |
| Charts | Recharts |
| Shot Charts | Custom SVG (half-court overlay) |
| State | React Context for auth/plan state; SWR or fetch for data |
| Auth | Delegated to backend (NextAuth or JWT); frontend stores token in cookie/localStorage |
| Payments | Redirect to Stripe Checkout (backend creates session) |

---

## Route Map

```
apps/web/app/
  layout.tsx            — Root layout (nav, footer, auth provider)
  page.tsx              — Home (/)
  players/
    page.tsx            — Player directory (/players)
    [playerId]/
      page.tsx          — Player detail (/players/[playerId])
  teams/
    page.tsx            — Team directory (/teams)
    [teamId]/
      page.tsx          — Team detail (/teams/[teamId])
  leaderboards/
    page.tsx            — Leaderboards (/leaderboards)
  compare/
    page.tsx            — Compare (/compare)
  qa/
    page.tsx            — Q&A chat (/qa)
```

---

## Component Tree

```
<RootLayout>
  <Navbar />                  — Top navigation, logo, links, user menu, upgrade CTA
  <main>
    {children}                — Page content
  </main>
  <Footer />
</RootLayout>
```

### Shared Components (`apps/web/components/`)

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Title + breadcrumb + optional actions |
| `Card` | Reusable card with optional header/footer |
| `DataTable` | Sortable, paginated table with loading skeleton |
| `StatCard` | Compact stat display (value + label + trend) |
| `BarChartWrapper` | Recharts bar chart with consistent styling |
| `LineChartWrapper` | Recharts line chart with consistent styling |
| `ShotChart` | SVG half-court with shot dots (LOC_X, LOC_Y) |
| `UpgradePrompt` | Inline banner prompting upgrade |
| `FeatureGate` | Wraps children; shows upgrade prompt if feature not in plan |
| `LimitReached` | Modal/inline message when usage quota exhausted |
| `SearchInput` | Debounced search field |
| `PlayerCard` | Compact player info card for lists |
| `TeamCard` | Compact team info card for lists |
| `Skeleton` | Loading placeholder |
| `ErrorState` | Error display with retry |
| `EmptyState` | Empty results display |

---

## API Client Layer (`apps/web/lib/api.ts`)

A single typed module that wraps all API calls. Uses `NEXT_PUBLIC_API_BASE_URL` from env.

```typescript
// Pseudocode structure
const api = {
  // Auth / User
  getMe(): Promise<UserProfile>

  // Players
  getPlayers(params): Promise<PaginatedResponse<PlayerSummary>>
  getPlayer(id): Promise<PlayerDetail>
  getPlayerGameLog(id, params): Promise<GameLogEntry[]>
  getPlayerShots(id, params): Promise<ShotData[]>

  // Teams
  getTeams(): Promise<TeamSummary[]>
  getTeam(id): Promise<TeamDetail>
  getTeamRoster(id): Promise<PlayerSummary[]>
  getTeamGames(id, params): Promise<GameSummary[]>

  // Leaderboards
  getLeaderboard(stat, params): Promise<LeaderboardEntry[]>

  // Compare
  comparePlayers(ids): Promise<ComparisonData>

  // Q&A
  askQuestion(question): Promise<QAResponse>

  // Billing
  createCheckoutSession(plan): Promise<{url: string}>
}
```

If an endpoint is not yet implemented by the backend, the client falls back to mock data and logs a `// TODO: waiting on backend` warning.

---

## Auth & Plan State

```
AuthProvider (React Context — apps/web/lib/auth-context.tsx)
  ├── user: { id, email, plan, limits, usageRemaining } | null
  ├── isAuthenticated: boolean
  ├── isLoading: boolean
  ├── login(token) → saves JWT to localStorage, calls /me, sets user
  ├── logout() → clears token + user state
  └── refreshUser()
```

### Auth Flow

1. **Token storage**: JWT stored in `localStorage` via `apps/web/lib/auth.ts` (get/set/clear helpers).
2. **On mount**: `AuthProvider` checks for existing token. If present, calls `GET /me` to hydrate user state. If token is invalid/expired, clears it and sets `user = null`.
3. **API requests**: `fetchApi()` in `apps/web/lib/api.ts` automatically injects `Authorization: Bearer <token>` header when a token exists.
4. **Login/Register pages**: `/login` and `/register` routes accept `?next=` query param for post-auth redirect. Both call backend auth endpoints and store the returned JWT.
5. **Upgrade button**: If not authenticated, redirects to `/login?next=<currentPath>`. If authenticated, calls checkout API. On 401, redirects to login. On 500, shows toast instead of crashing.
6. **Navbar**: Shows "Sign in" link when anonymous, email + "Sign out" button when authenticated.

### Routes

```
apps/web/app/
  login/page.tsx       — Sign-in form (/login)
  register/page.tsx    — Registration form (/register)
```

### Error Handling

- `register()` and `login()` in `api.ts` return `{ ok, token }` or `{ ok: false, message }` — never throw unhandled.
- Checkout errors: 401 → redirect to login; 500 → amber toast; other → generic toast. All auto-dismiss after 4s.

---

## Freemium Gating Strategy

### Fully gated (premium-only) sections

1. **`<FeatureGate feature="exports">`** — wraps any premium-only UI. Checks `user.plan`. If free, renders `<UpgradePrompt />` instead of children.
2. **Advanced Metrics** — wrapped with `<FeatureGate feature="advanced_metrics">`.
3. **Export buttons** — disabled with tooltip for free users.

### Data-limited sections (free = last 5 games)

Backend enforces the free cap (5 games, restricted shots). Frontend displays appropriate messaging:

4. **Player detail — Recent Games table**: Free users see 5 rows with no pagination controls and a compact `<UpgradePrompt>` note. Premium users see full game log with a "Load more games" button (offset-based pagination, page size 20).
5. **Player detail — Shot Chart**: Free users see shots from recent 5 games with a "Recent 5 games" label in the chart legend. Premium users see all available shots.
6. **Player detail — Scoring Trend**: Free users see a line chart of the last 5 games with a modified title ("Last 5 Games") and compact upgrade prompt. Premium users see the full trend.

### Usage-limited sections

7. **Q&A page** — checks `user.usageRemaining.qa`. If 0, shows `<LimitReached />`.
8. **Leaderboards** — free users see top 10; `<FeatureGate>` wraps the "show all" button.

### DNP filtering

Backend filters out DNP (Did Not Play) rows by default. Frontend does not send `includeDNP=true`, so only games actually played are shown.

---

## Environment Variables (Frontend)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

All other secrets (Stripe, DB, auth) live on the backend only.
