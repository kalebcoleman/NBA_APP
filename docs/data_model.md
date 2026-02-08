# Data Model — High-Level Entities

_Codex owns the DB schema and queries. This document describes the **logical entities** the frontend consumes, mapped to known tables._

---

## Database Overview

SQLite database at `db/local/nba.sqlite` (~7 GB). Contains data from two sources:

| Source | Prefix | Description |
|--------|--------|-------------|
| ESPN | `espn_*` | Games, teams, player box scores, game events |
| NBA Stats | `nba_stats_*` | Games, box scores (traditional/advanced/usage/four factors), shots, play-by-play |

### Row Counts (approximate)

| Table | Rows |
|-------|------|
| `espn_teams` | 4,334 |
| `espn_games` | 15,452 |
| `nba_stats_games` | 14,898 |
| `nba_stats_player_box_traditional` | 384,182 |
| `nba_stats_player_box_advanced` | 384,152 |
| `nba_stats_shots` | 2,584,321 |

---

## Logical Entities

### Player
Derived from `nba_stats_player_box_traditional` and `nba_stats_player_box_advanced`.

| Field | Source Column(s) |
|-------|-----------------|
| playerId | `personId` / `player_id` |
| name | `firstName` + `familyName` or `nameI` |
| team | `teamTricode` |
| teamId | `teamId` / `team_id` |
| position | `position` |
| jerseyNum | `jerseyNum` |

Season averages are aggregated from box score rows grouped by `season`.

### Team
Derived from `espn_teams` and `nba_stats_team_box_traditional` / `nba_stats_team_box_advanced`.

| Field | Source Column(s) |
|-------|-----------------|
| teamId | `team_id` / `teamId` |
| name | `teamName` (or `team_name` in ESPN) |
| abbreviation | `teamTricode` / `team_abbrev` |
| city | `teamCity` |

### Game
Derived from `nba_stats_games` or `espn_games`.

| Field | Source Column(s) |
|-------|-----------------|
| gameId | `game_id` |
| date | `game_date` |
| homeTeam | `home_team` |
| awayTeam | `away_team` |
| homeScore | `home_score` |
| awayScore | `away_score` |
| season | `season` |

### Shot
Derived from `nba_stats_shots` (2.5M+ rows). Rich shot-level data.

| Field | Source Column(s) |
|-------|-----------------|
| gameId | `GAME_ID` |
| playerId | `PLAYER_ID` |
| playerName | `PLAYER_NAME` |
| locX | `LOC_X` (court X coordinate) |
| locY | `LOC_Y` (court Y coordinate) |
| shotDistance | `SHOT_DISTANCE` |
| shotType | `SHOT_TYPE` (2PT/3PT) |
| zoneBasic | `SHOT_ZONE_BASIC` |
| zoneArea | `SHOT_ZONE_AREA` |
| zoneRange | `SHOT_ZONE_RANGE` |
| actionType | `ACTION_TYPE` |
| made | `SHOT_MADE_FLAG` |
| period | `PERIOD` |

### Box Score (Traditional)
Per-game player stats from `nba_stats_player_box_traditional`.

Key columns: `points`, `assists`, `reboundsTotal`, `steals`, `blocks`, `turnovers`, `fieldGoalsMade`, `fieldGoalsAttempted`, `fieldGoalsPercentage`, `threePointersMade`, `threePointersAttempted`, `freeThrowsMade`, `freeThrowsAttempted`, `plusMinusPoints`, `minutes`.

### Box Score (Advanced)
Per-game advanced metrics from `nba_stats_player_box_advanced`.

Key columns: `offensiveRating`, `defensiveRating`, `netRating`, `trueShootingPercentage`, `effectiveFieldGoalPercentage`, `usagePercentage`, `assistPercentage`, `reboundPercentage`, `pace`, `PIE`.

### Views (Pre-built)

| View | Description |
|------|-------------|
| `v_shots_context` | Shots joined with game context (home/away, score, clutch flag) |
| `v_shots_with_context` | Similar; shots joined with PBP for score context |
| `shots_context_mat_modern` | Materialized version of shot context (faster queries) |
| `shots_model_modern` | Feature table for xFG modeling |

---

## Notes for Backend (Codex)

- Player IDs: use `personId` (numeric) from NBA Stats tables as canonical. ESPN uses `player_id` (string).
- Team IDs: use `teamId` (numeric) from NBA Stats. ESPN uses `team_id` (string).
- Seasons are stored as strings like `"2024-25"` in NBA Stats, integers like `2025` in ESPN.
- The `nba_stats_shots` table has LOC_X/LOC_Y in NBA court units (X: -250 to 250, Y: -50 to ~420). Frontend will need these raw coordinates for the shot chart SVG.
