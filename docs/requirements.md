# Requirements — NBA Analytics Platform

_Derived from research PDFs in `docs/research/`._

---

## Product Vision

Build a **web-first NBA analytics platform** that combines:

1. **AI-powered natural-language Q&A** over a rich NBA dataset (StatMuse-style)
2. **Interactive dashboards** — player pages, team pages, leaderboards, head-to-head comparisons, and shot charts
3. **Advanced proprietary metrics** — xFG (Expected FG%), Shot Difficulty Index (SDI), Points Over Expected (POE)
4. **Freemium monetization** via Stripe subscriptions

The platform starts as a responsive web app (Next.js) with a backend API. A mobile app may follow once the concept is validated.

---

## Target User Groups

| Segment | Needs | Willingness to Pay |
|---------|-------|--------------------|
| **Fantasy Basketball Players** | Projections, player comparisons, lineup advice, trend analysis | High — many subscribe to FantasyPros-like services |
| **Sports Bettors** | Data-driven picks, player prop analysis, trend alerts | Very high — BettingPros charges $10–$30/mo |
| **Analytics Enthusiasts / Content Creators** | Deep historical data, custom queries, data export, advanced visualizations | Moderate–High — Stathead charges ~$8/mo |
| **General NBA Fans** | Quick stat lookups, fun trivia, basic charts | Low — free tier; drive traffic and word-of-mouth |

**Initial focus:** Fantasy players + analytics enthusiasts (largest overlap with existing data). Betting features are a stretch goal requiring external odds data.

---

## Free vs Premium Feature Gates

### Free Tier
- Basic player/team stat pages (current season + last season)
- Up to **5 AI Q&A queries per day**
- Top-10 leaderboards (truncated)
- Basic shot chart (single game or season summary, non-interactive)
- Player comparison (up to 2 players, basic stats only)
- Ads shown

### Premium Tier ($9.99/month or $79.99/year)
- **Unlimited AI Q&A queries**
- Full leaderboards with filters and sorting
- Multi-season historical data
- Advanced metrics: xFG, SDI, POE, POE/$M
- Interactive shot charts with filters (zone, period, clutch, shot type)
- Player comparison with unlimited players and advanced metrics
- Data export (CSV download)
- Saved search history
- No ads
- Early access to new features

### Future Considerations
- Betting tools (prop analyzer, alerts) — gated to premium
- Enterprise/API licensing for teams, media, or third-party apps
- Seasonal one-time products (Draft Kit, Playoff Analysis Pack)

---

## Subscription & Monetization Strategy

**Primary:** Premium subscriptions via Stripe (recurring monthly/annual).

**Secondary:**
- Display ads on free tier (minimal, clean UX)
- Sportsbook affiliate links (if/when betting features launch)

**Pricing rationale:** $9.99/mo sits below StatMuse+ ($20/mo) and BettingPros ($30/mo) but above Stathead ($8/mo). Competitive for an NBA-only single-sport product. Annual discount (~33%) encourages retention.

---

## Key Screens & Core UX

### Navigation
Top nav bar with links: Home, Players, Teams, Leaderboards, Compare, Q&A. User avatar / login button at right. "Upgrade" CTA button visible to free users.

### Pages

| Route | Description |
|-------|-------------|
| `/` | **Home** — Hero section, featured stats of the day, recent games, quick search |
| `/players` | **Player Directory** — Searchable/filterable list of all players with basic stats |
| `/players/[playerId]` | **Player Detail** — Stats table, game log, shot chart, advanced metrics (gated) |
| `/teams` | **Team Directory** — All 30 teams with season records and key metrics |
| `/teams/[teamId]` | **Team Detail** — Roster, team stats, game results, team-level shot chart |
| `/leaderboards` | **Leaderboards** — Sortable stat leaders; top 10 free, full list premium |
| `/compare` | **Compare** — Side-by-side player comparison with charts |
| `/qa` | **Q&A** — Chat-like AI assistant for natural-language stat queries |

### UX Patterns
- **Loading states:** Skeleton placeholders for all data sections
- **Empty states:** Friendly messages with suggested actions
- **Error states:** Retry button + fallback message
- **Upgrade prompts:** Inline banners when free users hit limits or try premium features
- **Limit reached:** Modal or inline message when Q&A daily quota exhausted, with upgrade CTA
