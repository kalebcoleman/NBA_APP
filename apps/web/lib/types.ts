export interface UserProfile {
  id: string;
  email: string;
  plan: "free" | "premium";
  isAuthenticated: boolean;
  limits: {
    qaQueriesPerDay: number;
    compareMaxPlayers: number;
    leaderboardMaxRows: number;
  };
  usageRemaining: {
    qa: number;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface PlayerSummary {
  playerId: string;
  name: string;
  team: string;
  teamId: string;
  position: string;
  ppg: number;
  rpg: number;
  apg: number;
}

export interface PlayerDetail extends PlayerSummary {
  jerseyNum: string;
  seasonAverages: {
    season: string;
    gp: number;
    ppg: number;
    rpg: number;
    apg: number;
    fgPct: number;
    threePct: number;
    ftPct: number;
  };
  advancedMetrics: {
    offensiveRating: number;
    defensiveRating: number;
    netRating: number;
    trueShootingPct: number;
    usagePct: number;
    effectiveFgPct: number;
    assistPct: number;
    reboundPct: number;
    pie: number;
  };
}

export interface GameLogEntry {
  gameId: string;
  date: string;
  opponent: string;
  result: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  fgm: number;
  fga: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  steals: number;
  blocks: number;
  turnovers: number;
  plusMinus: number;
}

export interface ShotData {
  gameId: string;
  locX: number;
  locY: number;
  shotDistance: number;
  shotType: string;
  shotZoneBasic: string;
  actionType: string;
  made: boolean;
  period: number;
}

export interface TeamSummary {
  teamId: string;
  name: string;
  abbreviation: string;
  city: string;
  wins: number;
  losses: number;
  offRating: number;
  defRating: number;
  netRating: number;
}

export interface TeamDetail extends TeamSummary {
  season: string;
  record: { wins: number; losses: number };
  stats: {
    ppg: number;
    oppPpg: number;
    offRating: number;
    defRating: number;
    pace: number;
    fgPct: number;
    threePct: number;
    ftPct: number;
  };
  roster: { playerId: string; name: string; position: string; jerseyNum: string }[];
  recentGames: {
    gameId: string;
    date: string;
    opponent: string;
    result: string;
    score: string;
  }[];
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  team: string;
  value: number;
  gamesPlayed: number;
}

export interface ComparisonPlayer {
  playerId: string;
  name: string;
  team: string;
  stats: Record<string, number>;
}

export interface QAResponse {
  answer: string;
  table?: {
    columns: string[];
    rows: (string | number)[][];
  };
  chartSpec?: unknown;
  meta: {
    queriesUsed: number;
    queriesRemaining: number;
    plan: string;
  };
}

export interface UpcomingGame {
  gameId: string;
  startTime: string;
  status: string;
  homeTeam: {
    teamId: string;
    name: string;
    abbreviation: string;
    record: string;
    last10: string;
  };
  awayTeam: {
    teamId: string;
    name: string;
    abbreviation: string;
    record: string;
    last10: string;
  };
  lastSyncedAt: string;
  isStale: boolean;
}

export interface UpcomingGamesResponse {
  data: UpcomingGame[];
  meta: {
    from: string;
    to: string;
    total: number;
  };
}

export interface QAErrorResponse {
  error: string;
  message: string;
  meta: {
    queriesUsed: number;
    queriesRemaining: number;
    plan: string;
  };
}
