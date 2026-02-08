/**
 * API client layer.
 *
 * - In live mode (default): calls the real backend at NEXT_PUBLIC_API_BASE_URL.
 *   Errors propagate to callers so pages can show <ErrorState>.
 * - In mock mode (NEXT_PUBLIC_USE_MOCKS=true): returns static mock data.
 *
 * The normalisation layer below maps backend field names to the types the
 * frontend components already expect, so pages don't need to change.
 */

import type {
  UserProfile,
  PaginatedResponse,
  PlayerSummary,
  PlayerDetail,
  GameLogEntry,
  ShotData,
  TeamSummary,
  TeamDetail,
  LeaderboardEntry,
  ComparisonPlayer,
  QAResponse,
} from "./types";

import {
  mockPlayers,
  mockPlayerDetail,
  mockGameLog,
  mockShots,
  mockTeams,
  mockTeamDetail,
  mockLeaderboard,
  mockComparison,
} from "./mock-data";

import { getToken } from "./auth";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(body.message ? String(body.message) : `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res.json();
}

/** Safe number accessor – returns 0 when value is missing/null. */
function num(v: unknown): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

function str(v: unknown, fallback = ""): string {
  return v != null ? String(v) : fallback;
}

// ---------------------------------------------------------------------------
// Metric mapping: frontend stat keys → backend metric names
// ---------------------------------------------------------------------------

const STAT_TO_METRIC: Record<string, string> = {
  ppg: "points",
  rpg: "rebounds",
  apg: "assists",
  fgPct: "fgPct",
  threePct: "threePointPct",
  trueShootingPct: "trueShooting",
  usagePct: "usagePct",
  pie: "pie",
};

// ---------------------------------------------------------------------------
// Auth / User
// ---------------------------------------------------------------------------

export async function getMe(): Promise<UserProfile> {
  if (USE_MOCKS) {
    return {
      id: "dev_user",
      email: "dev@example.com",
      plan: "free",
      limits: { qaQueriesPerDay: 5, compareMaxPlayers: 2, leaderboardMaxRows: 10 },
      usageRemaining: { qa: 5 },
    };
  }

  // Backend shape: { user: { id, plan: "FREE"|"PREMIUM", ... }, limits: { qaDailyLimit, ... }, usage: { qaRemaining, ... } }
  const raw: any = await fetchApi("/me");

  const backendPlan = str(raw.user?.plan, "FREE").toLowerCase();

  return {
    id: str(raw.user?.id, "anon"),
    email: str(raw.user?.email, ""),
    plan: backendPlan === "premium" ? "premium" : "free",
    limits: {
      qaQueriesPerDay: num(raw.limits?.qaDailyLimit) || 5,
      compareMaxPlayers: 2,    // not exposed by backend; default
      leaderboardMaxRows: 10,  // not exposed by backend; default
    },
    usageRemaining: {
      qa: num(raw.usage?.qaRemaining),
    },
  };
}

export interface AuthResult {
  ok: true;
  token: string;
}

export interface AuthError {
  ok: false;
  message: string;
}

export async function register(
  email: string,
  password: string,
): Promise<AuthResult | AuthError> {
  if (USE_MOCKS) return { ok: true, token: "mock_jwt_token" };
  try {
    const raw: any = await fetchApi("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return { ok: true, token: str(raw.token) };
  } catch (e) {
    if (e instanceof ApiError) {
      return { ok: false, message: String(e.body.message ?? e.message) };
    }
    return { ok: false, message: "Network error. Please try again." };
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult | AuthError> {
  if (USE_MOCKS) return { ok: true, token: "mock_jwt_token" };
  try {
    const raw: any = await fetchApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return { ok: true, token: str(raw.token) };
  } catch (e) {
    if (e instanceof ApiError) {
      return { ok: false, message: String(e.body.message ?? e.message) };
    }
    return { ok: false, message: "Network error. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function getPlayers(params?: {
  search?: string;
  season?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<PlayerSummary>> {
  if (USE_MOCKS) {
    const filtered = params?.search
      ? mockPlayers.filter((p) =>
          p.name.toLowerCase().includes(params.search!.toLowerCase()),
        )
      : mockPlayers;
    return {
      data: filtered,
      pagination: { page: 1, limit: 25, total: filtered.length },
    };
  }

  // Backend uses offset-based, not page-based pagination
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.page && params.page > 1) {
    query.set("offset", String(((params.page ?? 1) - 1) * (params.limit ?? 25)));
  }

  const raw: any = await fetchApi(`/players?${query}`);

  const data: PlayerSummary[] = (raw.data ?? []).map((r: any) => ({
    playerId: str(r.player_id ?? r.playerId),
    name: str(r.full_name ?? r.name),
    team: str(r.team_abbrev ?? r.team),
    teamId: str(r.team_id ?? r.teamId ?? ""),
    position: str(r.position),
    ppg: num(r.ppg),
    rpg: num(r.rpg),
    apg: num(r.apg),
  }));

  const meta = raw.meta ?? raw.pagination ?? {};
  return {
    data,
    pagination: {
      page: params?.page ?? 1,
      limit: num(meta.limit) || 25,
      total: num(meta.total),
    },
  };
}

export async function getPlayer(id: string): Promise<PlayerDetail> {
  if (USE_MOCKS) {
    const found = mockPlayers.find((p) => p.playerId === id);
    if (found) {
      return {
        ...mockPlayerDetail,
        ...found,
        jerseyNum: "15",
        seasonAverages: {
          ...mockPlayerDetail.seasonAverages,
          ppg: found.ppg,
          rpg: found.rpg,
          apg: found.apg,
        },
        advancedMetrics: mockPlayerDetail.advancedMetrics,
      };
    }
    return mockPlayerDetail;
  }

  const raw: any = await fetchApi(`/players/${id}`);

  // Normalise – backend may return flat or nested shapes
  const sa = raw.seasonAverages ?? raw.season_averages ?? {};
  const adv = raw.advancedMetrics ?? raw.advanced_metrics ?? {};

  return {
    playerId: str(raw.player_id ?? raw.playerId ?? id),
    name: str(raw.full_name ?? raw.name ?? "Unknown"),
    team: str(raw.team_abbrev ?? raw.team ?? ""),
    teamId: str(raw.team_id ?? raw.teamId ?? ""),
    position: str(raw.position),
    ppg: num(sa.ppg ?? raw.ppg),
    rpg: num(sa.rpg ?? raw.rpg),
    apg: num(sa.apg ?? raw.apg),
    jerseyNum: str(raw.jersey_num ?? raw.jerseyNum, "N/A"),
    seasonAverages: {
      season: str(sa.season ?? raw.last_season ?? ""),
      gp: num(sa.gp ?? sa.games_played ?? raw.gp),
      ppg: num(sa.ppg ?? raw.ppg),
      rpg: num(sa.rpg ?? raw.rpg),
      apg: num(sa.apg ?? raw.apg),
      fgPct: num(sa.fgPct ?? sa.fg_pct ?? sa.field_goals_percentage),
      threePct: num(sa.threePct ?? sa.three_pct ?? sa.three_pointers_percentage),
      ftPct: num(sa.ftPct ?? sa.ft_pct ?? sa.free_throws_percentage),
    },
    advancedMetrics: {
      offensiveRating: num(adv.offensiveRating ?? adv.offensive_rating),
      defensiveRating: num(adv.defensiveRating ?? adv.defensive_rating),
      netRating: num(adv.netRating ?? adv.net_rating),
      trueShootingPct: num(adv.trueShootingPct ?? adv.true_shooting_pct),
      usagePct: num(adv.usagePct ?? adv.usage_pct),
      effectiveFgPct: num(adv.effectiveFgPct ?? adv.effective_fg_pct),
      assistPct: num(adv.assistPct ?? adv.assist_pct),
      reboundPct: num(adv.reboundPct ?? adv.rebound_pct),
      pie: num(adv.pie ?? adv.PIE),
    },
  };
}

export async function getPlayerGameLog(
  id: string,
  params?: { season?: string; limit?: number; offset?: number },
): Promise<GameLogEntry[]> {
  if (USE_MOCKS) return mockGameLog;

  const query = new URLSearchParams();
  if (params?.season) query.set("season", params.season);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  // Backend uses /players/:id/games (NOT /gamelog)
  // Codex will also add a /gamelog alias — try /gamelog first, fall back to /games.
  let raw: any;
  try {
    raw = await fetchApi(`/players/${id}/gamelog?${query}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      raw = await fetchApi(`/players/${id}/games?${query}`);
    } else {
      throw e;
    }
  }

  const rows: any[] = raw.data ?? raw ?? [];
  return rows.map((r: any) => ({
    gameId: str(r.game_id ?? r.gameId),
    date: str(r.date ?? r.game_date),
    opponent: str(r.opponent ?? r.opp ?? r.opponent_abbrev),
    result: str(r.result),
    minutes: str(r.minutes),
    points: num(r.points ?? r.pts),
    rebounds: num(r.rebounds ?? r.reb),
    assists: num(r.assists ?? r.ast),
    fgm: num(r.fgm ?? r.field_goals_made),
    fga: num(r.fga ?? r.field_goals_attempted),
    threePm: num(r.threePm ?? r.three_pm ?? r.three_pointers_made),
    threePa: num(r.threePa ?? r.three_pa ?? r.three_pointers_attempted),
    ftm: num(r.ftm ?? r.free_throws_made),
    fta: num(r.fta ?? r.free_throws_attempted),
    steals: num(r.steals ?? r.stl),
    blocks: num(r.blocks ?? r.blk),
    turnovers: num(r.turnovers ?? r.tov),
    plusMinus: num(r.plusMinus ?? r.plus_minus),
  }));
}

export async function getPlayerShots(
  id: string,
  params?: { season?: string; gameId?: string },
): Promise<ShotData[]> {
  if (USE_MOCKS) return mockShots;

  const query = new URLSearchParams();
  if (params?.season) query.set("season", params.season);
  if (params?.gameId) query.set("gameId", params.gameId);

  const raw: any = await fetchApi(`/players/${id}/shots?${query}`);

  const rows: any[] = raw.data ?? raw ?? [];
  return rows.map((r: any) => ({
    gameId: str(r.GAME_ID ?? r.game_id ?? r.gameId),
    locX: num(r.LOC_X ?? r.loc_x ?? r.locX),
    locY: num(r.LOC_Y ?? r.loc_y ?? r.locY),
    shotDistance: num(r.SHOT_DISTANCE ?? r.shot_distance ?? r.shotDistance),
    shotType: str(r.SHOT_TYPE ?? r.shot_type ?? r.shotType),
    shotZoneBasic: str(r.SHOT_ZONE_BASIC ?? r.shot_zone_basic ?? r.shotZoneBasic),
    actionType: str(r.ACTION_TYPE ?? r.action_type ?? r.actionType),
    made: r.SHOT_MADE_FLAG === 1 || r.shot_made_flag === 1 || r.made === true || r.made === 1,
    period: num(r.PERIOD ?? r.period),
  }));
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function getTeams(): Promise<TeamSummary[]> {
  if (USE_MOCKS) return mockTeams;

  const raw: any = await fetchApi("/teams");
  const rows: any[] = raw.data ?? raw ?? [];

  return rows.map((r: any) => ({
    teamId: str(r.team_id ?? r.teamId),
    name: str(r.team_name ?? r.name),
    abbreviation: str(r.team_abbrev ?? r.abbreviation),
    city: str(r.team_city ?? r.city ?? ""),
    wins: num(r.wins),
    losses: num(r.losses),
    offRating: num(r.off_rating ?? r.offRating),
    defRating: num(r.def_rating ?? r.defRating),
    netRating: num(r.net_rating ?? r.netRating),
  }));
}

export async function getTeam(id: string): Promise<TeamDetail> {
  if (USE_MOCKS) {
    const found = mockTeams.find((t) => t.teamId === id);
    if (found) {
      return {
        ...mockTeamDetail,
        ...found,
        season: "2024-25",
        record: { wins: found.wins, losses: found.losses },
        stats: mockTeamDetail.stats,
        roster: mockTeamDetail.roster,
        recentGames: mockTeamDetail.recentGames,
      };
    }
    return mockTeamDetail;
  }

  const raw: any = await fetchApi(`/teams/${id}`);

  const stats = raw.stats ?? {};
  const roster: any[] = raw.roster ?? [];
  const recentGames: any[] = raw.recentGames ?? raw.recent_games ?? [];

  return {
    teamId: str(raw.team_id ?? raw.teamId ?? id),
    name: str(raw.team_name ?? raw.name ?? ""),
    abbreviation: str(raw.team_abbrev ?? raw.abbreviation ?? ""),
    city: str(raw.team_city ?? raw.city ?? ""),
    wins: num(raw.wins ?? stats.wins),
    losses: num(raw.losses ?? stats.losses),
    offRating: num(stats.off_rating ?? stats.offRating),
    defRating: num(stats.def_rating ?? stats.defRating),
    netRating: num(stats.net_rating ?? stats.netRating),
    season: str(raw.season ?? ""),
    record: {
      wins: num(raw.wins ?? stats.wins),
      losses: num(raw.losses ?? stats.losses),
    },
    stats: {
      ppg: num(stats.ppg),
      oppPpg: num(stats.opp_ppg ?? stats.oppPpg),
      offRating: num(stats.off_rating ?? stats.offRating),
      defRating: num(stats.def_rating ?? stats.defRating),
      pace: num(stats.pace),
      fgPct: num(stats.fg_pct ?? stats.fgPct),
      threePct: num(stats.three_pct ?? stats.threePct),
      ftPct: num(stats.ft_pct ?? stats.ftPct),
    },
    roster: roster.map((r: any) => ({
      playerId: str(r.player_id ?? r.playerId),
      name: str(r.full_name ?? r.name),
      position: str(r.position),
      jerseyNum: str(r.jersey_num ?? r.jerseyNum ?? ""),
    })),
    recentGames: recentGames.map((g: any) => ({
      gameId: str(g.game_id ?? g.gameId),
      date: str(g.date ?? g.game_date),
      opponent: str(g.opponent ?? g.opp),
      result: str(g.result),
      score: str(g.score),
    })),
  };
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export async function getLeaderboard(
  stat: string,
  params?: { season?: string; limit?: number },
): Promise<LeaderboardEntry[]> {
  if (USE_MOCKS) return mockLeaderboard.slice(0, params?.limit ?? 25);

  // Map frontend stat name → backend metric name
  const metric = STAT_TO_METRIC[stat] ?? stat;

  const query = new URLSearchParams({ metric });
  if (params?.season) query.set("season", params.season);
  if (params?.limit) query.set("limit", String(params.limit));

  const raw: any = await fetchApi(`/leaderboards?${query}`);

  const rows: any[] = raw.data ?? [];
  return rows.map((r: any, i: number) => ({
    rank: num(r.rank) || i + 1,
    playerId: str(r.player_id ?? r.playerId),
    name: str(r.player_name ?? r.name),
    team: str(r.team_abbrev ?? r.team),
    value: num(r.value),
    gamesPlayed: num(r.games ?? r.gamesPlayed ?? r.games_played),
  }));
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

export async function comparePlayers(
  playerIds: string[],
): Promise<ComparisonPlayer[]> {
  if (USE_MOCKS)
    return mockComparison.filter((p) => playerIds.includes(p.playerId));

  // Backend supports ?playerA=&playerB= (exactly 2)
  // Also try the multi-ID format in case Codex adds the alias.
  let raw: any;
  try {
    raw = await fetchApi(
      `/compare?playerIds=${playerIds.join(",")}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404 && playerIds.length >= 2) {
      raw = await fetchApi(
        `/compare?playerA=${playerIds[0]}&playerB=${playerIds[1]}`,
      );
    } else {
      throw e;
    }
  }

  const players: any[] = raw.players ?? raw.data ?? [raw];
  return players.map((p: any) => ({
    playerId: str(p.player_id ?? p.playerId),
    name: str(p.player_name ?? p.full_name ?? p.name),
    team: str(p.team_abbrev ?? p.team),
    stats: p.stats ?? {},
  }));
}

// ---------------------------------------------------------------------------
// Q&A
// ---------------------------------------------------------------------------

export async function askQuestion(question: string): Promise<QAResponse> {
  if (USE_MOCKS) {
    return {
      answer: `[Mock] Here is an answer to: "${question}". Backend Q&A not connected.`,
      table: {
        columns: ["Player", "Team", "Value"],
        rows: [
          ["Shai Gilgeous-Alexander", "OKC", 31.2],
          ["Giannis Antetokounmpo", "MIL", 30.4],
          ["Luka Doncic", "DAL", 28.1],
        ],
      },
      meta: { queriesUsed: 1, queriesRemaining: 4, plan: "free" },
    };
  }

  const raw: any = await fetchApi("/qa/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });

  // Backend meta: { limited, usageRemaining, intent }
  const meta = raw.meta ?? {};

  return {
    answer: str(raw.answer),
    table: raw.table ?? undefined,
    chartSpec: raw.chartSpec ?? undefined,
    meta: {
      queriesUsed: 0, // backend doesn't return this directly
      queriesRemaining: num(meta.usageRemaining ?? meta.queriesRemaining),
      plan: str(meta.plan ?? "free"),
    },
  };
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  planOrInterval: string,
): Promise<{ url: string }> {
  if (USE_MOCKS) return { url: "#upgrade-not-available" };

  // Map frontend plan names → backend interval
  let interval = "monthly";
  if (planOrInterval === "premium_annual" || planOrInterval === "annual") {
    interval = "annual";
  }

  // Build absolute redirect URLs for Stripe
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const successUrl = `${origin}/billing/success`;
  const cancelUrl = `${origin}/billing/cancel`;

  const payload = { interval, successUrl, cancelUrl };

  // Backend path is /billing/create-checkout-session
  // Also try /billing/checkout in case Codex adds alias.
  let raw: any;
  try {
    raw = await fetchApi("/billing/create-checkout-session", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      raw = await fetchApi("/billing/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } else {
      throw e;
    }
  }

  return { url: str(raw.url) };
}
