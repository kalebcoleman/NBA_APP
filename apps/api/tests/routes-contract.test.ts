import type { FastifyInstance } from 'fastify';
import { Plan } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bootstrapSqlite, sqlite } from '../src/db/sqlite.js';
import { prisma } from '../src/db/prisma.js';
import { buildServer } from '../src/server.js';

function pickTwoActivePlayers(): string[] {
  const rows = sqlite
    .prepare(
      `SELECT player_id
       FROM v_player_game_logs
       WHERE season = (SELECT season FROM v_games ORDER BY season DESC LIMIT 1)
         AND season_type = 'regular'
       GROUP BY player_id
       HAVING COUNT(*) >= 5
       LIMIT 2`
    )
    .all() as Array<{ player_id: string }>;

  return rows.map((row) => row.player_id);
}

function pickPlayerWithDnpRows(): string {
  const row = sqlite
    .prepare(
      `SELECT gl.player_id
       FROM v_player_game_logs gl
       LEFT JOIN v_player_game_logs_played gp
         ON gp.player_id = gl.player_id
         AND gp.game_id = gl.game_id
       WHERE gl.season = (SELECT season FROM v_games ORDER BY season DESC LIMIT 1)
         AND gl.season_type = 'regular'
       GROUP BY gl.player_id
       HAVING COUNT(*) > COUNT(gp.game_id)
          AND COUNT(gp.game_id) >= 5
       ORDER BY (COUNT(*) - COUNT(gp.game_id)) DESC, COUNT(*) DESC
       LIMIT 1`
    )
    .pluck()
    .get() as string | undefined;

  if (!row) {
    throw new Error('No player with DNP rows available for test assertions.');
  }

  return row;
}

function pickPlayerWithRecentShots(): string {
  const row = sqlite
    .prepare(
      `WITH ranked_games AS (
         SELECT
           player_id,
           game_id,
           ROW_NUMBER() OVER (
             PARTITION BY player_id
             ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
           ) AS rn
         FROM v_player_game_logs_played
         WHERE season = (SELECT season FROM v_games ORDER BY season DESC LIMIT 1)
           AND season_type = 'regular'
       )
       SELECT rg.player_id
       FROM ranked_games rg
       JOIN v_shots s
         ON s.player_id = rg.player_id
         AND s.game_id = rg.game_id
       WHERE rg.rn <= 5
       GROUP BY rg.player_id
       HAVING COUNT(DISTINCT rg.game_id) >= 5
          AND COUNT(*) >= 50
       ORDER BY COUNT(*) DESC
       LIMIT 1`
    )
    .pluck()
    .get() as string | undefined;

  if (!row) {
    throw new Error('No player with recent shots available for test assertions.');
  }

  return row;
}

function getLatestSeason(): string {
  const season = sqlite
    .prepare('SELECT season FROM v_games ORDER BY season DESC LIMIT 1')
    .pluck()
    .get() as string | undefined;

  if (!season) {
    throw new Error('No season data available for route contract tests.');
  }

  return season;
}

function getPlayedSeasonAverages(playerId: string, season: string) {
  return sqlite
    .prepare(
      `SELECT
         COUNT(*) AS gp,
         ROUND(COALESCE(SUM(points) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS ppg,
         ROUND(COALESCE(SUM(rebounds_total) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS rpg,
         ROUND(COALESCE(SUM(assists) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS apg,
         ROUND(COALESCE(SUM(fg_made) * 1.0 / NULLIF(SUM(fg_attempted), 0), 0), 4) AS fg_pct,
         ROUND(COALESCE(SUM(fg3_made) * 1.0 / NULLIF(SUM(fg3_attempted), 0), 0), 4) AS three_pct,
         ROUND(COALESCE(SUM(ft_made) * 1.0 / NULLIF(SUM(ft_attempted), 0), 0), 4) AS ft_pct
       FROM v_player_game_logs_played
       WHERE player_id = ?
         AND season = ?
         AND season_type = 'regular'`
    )
    .get(playerId, season) as {
    gp: number;
    ppg: number;
    rpg: number;
    apg: number;
    fg_pct: number;
    three_pct: number;
    ft_pct: number;
  };
}

function pickQualifiedPlayerWithDnpRows(): string {
  const season = getLatestSeason();
  const seasonRow = sqlite
    .prepare(
      `SELECT MAX(games) AS max_games
       FROM app_player_season_stats
       WHERE season = ?`
    )
    .get(season) as { max_games: number | null };
  const maxGames = Math.max(seasonRow.max_games ?? 0, 1);
  const minGames = Math.max(12, Math.floor(maxGames * 0.45));

  const row = sqlite
    .prepare(
      `WITH by_player AS (
         SELECT
           gl.player_id,
           COUNT(*) AS games_all,
           COUNT(gp.game_id) AS games_played,
           ROUND(COALESCE(SUM(gp.points) * 1.0 / NULLIF(COUNT(gp.game_id), 0), 0), 1) AS ppg_played
         FROM v_player_game_logs gl
         LEFT JOIN v_player_game_logs_played gp
           ON gp.player_id = gl.player_id
           AND gp.game_id = gl.game_id
         WHERE gl.season = ?
           AND gl.season_type = 'regular'
         GROUP BY gl.player_id
       )
       SELECT player_id
       FROM by_player
       WHERE games_all > games_played
         AND games_played >= ?
       ORDER BY ppg_played DESC, games_played DESC
       LIMIT 1`
    )
    .pluck()
    .get(season, minGames) as string | undefined;

  if (!row) {
    throw new Error('No qualified player with DNP rows available for leaderboard assertions.');
  }

  return row;
}

function parseMinutesToSeconds(minutes: unknown): number {
  if (typeof minutes !== 'string') {
    return 0;
  }

  const value = minutes.trim();
  if (value.length === 0) {
    return 0;
  }

  if (value.includes(':')) {
    const [minPart, secPart] = value.split(':');
    const min = Number.parseInt(minPart ?? '0', 10);
    const sec = Number.parseInt(secPart ?? '0', 10);
    return (Number.isFinite(min) ? min : 0) * 60 + (Number.isFinite(sec) ? sec : 0);
  }

  const asFloat = Number.parseFloat(value);
  if (!Number.isFinite(asFloat)) {
    return 0;
  }

  return Math.round(asFloat * 60);
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isPlayedGameRow(row: Record<string, unknown>): boolean {
  return parseMinutesToSeconds(row.minutes) > 0
    || asNumber(row.fga) > 0
    || asNumber(row.fg_attempted) > 0
    || asNumber(row.fta) > 0
    || asNumber(row.ft_attempted) > 0
    || asNumber(row.points) > 0
    || asNumber(row.rebounds) > 0
    || asNumber(row.rebounds_total) > 0
    || asNumber(row.assists) > 0
    || asNumber(row.steals) > 0
    || asNumber(row.blocks) > 0
    || asNumber(row.turnovers) > 0;
}

async function createPremiumAuthHeaders(app: FastifyInstance): Promise<Record<string, string>> {
  const email = `gating-premium-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
  const password = 'TestPass123!';
  const register = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password }
  });
  if (register.statusCode !== 200) {
    throw new Error(`Failed to register premium test user: ${register.statusCode}`);
  }

  const registerBody = register.json() as { token: string; user: { id: string } };
  const token = registerBody.token;
  const userId = registerBody.user.id;
  const headers = {
    authorization: `Bearer ${token}`,
    origin: 'http://localhost:3000'
  };

  const stripeSubscriptionId = `sub_test_${userId}`;
  await prisma.subscription.upsert({
    where: {
      stripeSubscriptionId
    },
    create: {
      userId,
      stripeCustomerId: `cus_test_${userId}`,
      stripeSubscriptionId,
      status: 'active',
      plan: Plan.PREMIUM
    },
    update: {
      status: 'active',
      plan: Plan.PREMIUM,
      cancelAtPeriodEnd: false
    }
  });

  return headers;
}

describe.sequential('route contract compatibility', () => {
  let app: FastifyInstance;
  let samplePlayerId: string;
  let sampleTeamId: string;

  beforeAll(async () => {
    bootstrapSqlite();

    samplePlayerId = sqlite
      .prepare('SELECT player_id FROM v_players ORDER BY full_name ASC LIMIT 1')
      .pluck()
      .get() as string;
    sampleTeamId = sqlite
      .prepare('SELECT team_id FROM v_teams ORDER BY abbreviation ASC LIMIT 1')
      .pluck()
      .get() as string;

    app = await buildServer();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('returns the same payload for /players/:playerId/games and /players/:playerId/gamelog', async () => {
    const gamesRes = await app.inject({
      method: 'GET',
      url: `/players/${samplePlayerId}/games?limit=5&offset=0`
    });

    const gameLogRes = await app.inject({
      method: 'GET',
      url: `/players/${samplePlayerId}/gamelog?limit=5&offset=0`
    });

    expect(gameLogRes.statusCode).toBe(gamesRes.statusCode);
    expect(gameLogRes.json()).toEqual(gamesRes.json());
  });

  it('filters DNP rows by default and returns expanded rows when includeDNP=true for premium users', async () => {
    const playerId = pickPlayerWithDnpRows();
    const headers = await createPremiumAuthHeaders(app);

    const defaultRes = await app.inject({
      method: 'GET',
      url: `/players/${playerId}/games?limit=200`,
      headers
    });
    const includeDnpRes = await app.inject({
      method: 'GET',
      url: `/players/${playerId}/games?limit=200&includeDNP=true`,
      headers
    });

    expect(defaultRes.statusCode).toBe(200);
    expect(includeDnpRes.statusCode).toBe(200);

    const defaultBody = defaultRes.json() as {
      data: Array<Record<string, unknown>>;
      meta: { includeDNP?: boolean; total: number };
    };
    const includeDnpBody = includeDnpRes.json() as {
      data: Array<Record<string, unknown>>;
      meta: { includeDNP?: boolean; total: number };
    };

    expect(defaultBody.meta.includeDNP).toBe(false);
    expect(includeDnpBody.meta.includeDNP).toBe(true);
    expect(includeDnpBody.meta.total).toBeGreaterThan(defaultBody.meta.total);
    expect(defaultBody.data.length).toBeGreaterThan(0);

    for (const row of defaultBody.data) {
      expect(isPlayedGameRow(row)).toBe(true);
    }

    const hasDnpRow = includeDnpBody.data.some((row) => !isPlayedGameRow(row));
    expect(hasDnpRow).toBe(true);
  });

  it('computes /players/:playerId season averages with played games only', async () => {
    const playerId = pickPlayerWithDnpRows();
    const season = getLatestSeason();
    const expected = getPlayedSeasonAverages(playerId, season);

    const allGamesRow = sqlite
      .prepare(
        `SELECT COUNT(*) AS games_all
         FROM v_player_game_logs
         WHERE player_id = ?
           AND season = ?
           AND season_type = 'regular'`
      )
      .get(playerId, season) as { games_all: number };

    expect(allGamesRow.games_all).toBeGreaterThan(expected.gp);

    const response = await app.inject({
      method: 'GET',
      url: `/players/${playerId}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      seasonAverages: {
        gp: number;
        ppg: number;
        rpg: number;
        apg: number;
        fgPct: number;
        threePct: number;
        ftPct: number;
      };
      summary: { games: number };
    };

    expect(body.seasonAverages.gp).toBe(expected.gp);
    expect(body.summary.games).toBe(expected.gp);
    expect(body.seasonAverages.ppg).toBeCloseTo(expected.ppg, 4);
    expect(body.seasonAverages.rpg).toBeCloseTo(expected.rpg, 4);
    expect(body.seasonAverages.apg).toBeCloseTo(expected.apg, 4);
    expect(body.seasonAverages.fgPct).toBeCloseTo(expected.fg_pct, 4);
    expect(body.seasonAverages.threePct).toBeCloseTo(expected.three_pct, 4);
    expect(body.seasonAverages.ftPct).toBeCloseTo(expected.ft_pct, 4);
  });

  it('keeps /players/:playerId season averages stable when includeDNP=true is passed', async () => {
    const playerId = pickPlayerWithDnpRows();

    const defaultResponse = await app.inject({
      method: 'GET',
      url: `/players/${playerId}`
    });
    const includeDnpResponse = await app.inject({
      method: 'GET',
      url: `/players/${playerId}?includeDNP=true`
    });

    expect(defaultResponse.statusCode).toBe(200);
    expect(includeDnpResponse.statusCode).toBe(200);

    const defaultBody = defaultResponse.json() as {
      seasonAverages: Record<string, unknown>;
      summary: Record<string, unknown>;
    };
    const includeDnpBody = includeDnpResponse.json() as {
      seasonAverages: Record<string, unknown>;
      summary: Record<string, unknown>;
    };

    expect(includeDnpBody.seasonAverages).toEqual(defaultBody.seasonAverages);
    expect(includeDnpBody.summary).toEqual(defaultBody.summary);
  });

  it('caps FREE game logs to 5 rows and resets offset while PREMIUM can request larger windows', async () => {
    const headers = await createPremiumAuthHeaders(app);

    const freeRes = await app.inject({
      method: 'GET',
      url: `/players/${samplePlayerId}/games?limit=50&offset=10`
    });
    const premiumRes = await app.inject({
      method: 'GET',
      url: `/players/${samplePlayerId}/games?limit=50&offset=10`,
      headers
    });

    expect(freeRes.statusCode).toBe(200);
    expect(premiumRes.statusCode).toBe(200);

    const freeBody = freeRes.json() as {
      data: Array<Record<string, unknown>>;
      meta: { limit: number; offset: number };
    };
    const premiumBody = premiumRes.json() as {
      data: Array<Record<string, unknown>>;
      meta: { limit: number; offset: number };
    };

    expect(freeBody.meta.limit).toBe(5);
    expect(freeBody.meta.offset).toBe(0);
    expect(freeBody.data.length).toBeLessThanOrEqual(5);

    expect(premiumBody.meta.limit).toBe(50);
    expect(premiumBody.meta.offset).toBe(10);

    for (const row of freeBody.data) {
      expect(isPlayedGameRow(row)).toBe(true);
    }
  });

  it('restricts FREE shots to the recent played-game scope even when scope=all is requested', async () => {
    const playerId = pickPlayerWithRecentShots();
    const recentGameRows = sqlite
      .prepare(
        `SELECT game_id
         FROM v_player_game_logs_played
         WHERE player_id = ?
         ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
         LIMIT 5`
      )
      .all(playerId) as Array<{ game_id: string }>;
    const recentGameIds = new Set(recentGameRows.map((row) => row.game_id));

    expect(recentGameIds.size).toBeGreaterThan(0);

    const response = await app.inject({
      method: 'GET',
      url: `/players/${playerId}/shots?scope=all&limit=5000`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ game_id?: string; gameId?: string }>;
      meta: { limit: number; scope: string };
    };

    expect(body.meta.limit).toBe(1500);
    expect(body.meta.scope).toBe('recent');
    expect(body.data.length).toBeGreaterThan(0);

    for (const row of body.data) {
      const gameId = row.game_id ?? row.gameId;
      expect(typeof gameId).toBe('string');
      expect(recentGameIds.has(gameId as string)).toBe(true);
    }
  });

  it('returns player detail fields at top-level and under data for frontend compatibility', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/players/${samplePlayerId}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      full_name?: string;
      data?: { full_name?: string; player_id?: string };
      player_id?: string;
    };

    expect(typeof body.full_name).toBe('string');
    expect(typeof body.player_id).toBe('string');
    expect(body.data).toBeDefined();
    expect(body.data?.full_name).toBe(body.full_name);
    expect(body.data?.player_id).toBe(body.player_id);
  });

  it('returns team detail fields at top-level and under data for frontend compatibility', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/teams/${sampleTeamId}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      team_name?: string;
      data?: { team_name?: string; team_id?: string };
      team_id?: string;
      record?: { wins?: number; losses?: number };
    };

    expect(typeof body.team_name).toBe('string');
    expect(typeof body.team_id).toBe('string');
    expect(body.data).toBeDefined();
    expect(body.data?.team_name).toBe(body.team_name);
    expect(body.data?.team_id).toBe(body.team_id);
    expect(typeof body.record?.wins).toBe('number');
    expect(typeof body.record?.losses).toBe('number');
  });

  it('returns the same schema for /billing/create-checkout-session and /billing/checkout aliases', async () => {
    const payload = {
      interval: 'monthly'
    };

    const canonical = await app.inject({
      method: 'POST',
      url: '/billing/create-checkout-session',
      payload
    });

    const alias = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      payload
    });

    expect(alias.statusCode).toBe(canonical.statusCode);

    const canonicalBody = canonical.json() as Record<string, unknown>;
    const aliasBody = alias.json() as Record<string, unknown>;

    expect(Object.keys(aliasBody).sort()).toEqual(Object.keys(canonicalBody).sort());
  });

  it('registers and logs in with email/password', async () => {
    const email = `auth-success-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password
      }
    });
    expect(register.statusCode).toBe(200);

    const registerBody = register.json() as {
      token: string;
      user: { id: string; email: string; plan: string };
    };
    expect(typeof registerBody.token).toBe('string');
    expect(typeof registerBody.user.id).toBe('string');
    expect(registerBody.user.email).toBe(email.toLowerCase());

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email,
        password
      }
    });
    expect(login.statusCode).toBe(200);

    const loginBody = login.json() as {
      token: string;
      user: { id: string; email: string };
    };
    expect(typeof loginBody.token).toBe('string');
    expect(loginBody.user.email).toBe(email.toLowerCase());
  });

  it('rejects login with wrong password', async () => {
    const email = `auth-wrong-pass-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password
      }
    });
    expect(register.statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email,
        password: 'WrongPassword123!'
      }
    });

    expect(login.statusCode).toBe(401);
    const body = login.json() as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('supports compare endpoint with playerIds query parameter', async () => {
    const ids = pickTwoActivePlayers();
    expect(ids.length).toBeGreaterThanOrEqual(2);

    const response = await app.inject({
      method: 'GET',
      url: `/compare?playerIds=${ids.join(',')}`
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      data: unknown[];
      players: unknown[];
      meta: Record<string, unknown>;
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(Array.isArray(body.players)).toBe(true);
    expect(body.meta).toHaveProperty('season');
  });

  it('returns /me response shape required by docs/api.md', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/me'
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      user: Record<string, unknown>;
      limits: Record<string, unknown>;
      usage: Record<string, unknown>;
    };

    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('limits');
    expect(body).toHaveProperty('usage');

    expect(typeof body.user.id).toBe('string');
    expect(typeof body.user.actorKey).toBe('string');
    expect(typeof body.user.plan).toBe('string');
    expect(typeof body.user.isAuthenticated).toBe('boolean');

    expect(typeof body.limits.qaDailyLimit).toBe('number');
    expect(typeof body.limits.qaRowLimit).toBe('number');
    expect(typeof body.limits.gamesMax === 'number' || body.limits.gamesMax === null).toBe(true);
    expect(typeof body.limits.shotsScope).toBe('string');
    expect(typeof body.limits.trendWindow === 'number' || body.limits.trendWindow === null).toBe(true);

    expect(typeof body.usage.date).toBe('string');
    expect(typeof body.usage.qaQueries).toBe('number');
    expect(typeof body.usage.apiRequests).toBe('number');
    expect(typeof body.usage.qaRemaining).toBe('number');
  });

  it('keeps anonymous identity on free plan', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/me'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { user: { isAuthenticated: boolean; plan: string; actorKey: string } };

    expect(body.user.isAuthenticated).toBe(false);
    expect(body.user.actorKey.startsWith('anon:')).toBe(true);
    expect(body.user.plan).toBe('FREE');
  });

  it('returns authenticated /me context for a valid token', async () => {
    const email = `auth-me-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password
      }
    });
    expect(register.statusCode).toBe(200);

    const token = (register.json() as { token: string }).token;
    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { user: { isAuthenticated: boolean; actorKey: string; id: string; plan: string } };
    expect(body.user.isAuthenticated).toBe(true);
    expect(body.user.actorKey.startsWith('user:')).toBe(true);
    expect(body.user.id.length).toBeGreaterThan(0);
    expect(body.user.plan).toBe('FREE');
  });

  it('returns /auth/me profile for authenticated user', async () => {
    const email = `auth-profile-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password
      }
    });
    expect(register.statusCode).toBe(200);

    const token = (register.json() as { token: string }).token;
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { user: { email: string; isAuthenticated: boolean; actorKey: string } };
    expect(body.user.email).toBe(email.toLowerCase());
    expect(body.user.isAuthenticated).toBe(true);
    expect(body.user.actorKey.startsWith('user:')).toBe(true);
  });

  it('requires authentication for billing checkout', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      payload: {
        interval: 'monthly'
      }
    });

    expect(response.statusCode).toBe(401);
    const body = response.json() as {
      error: {
        code: string;
      };
    };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('does not upgrade to premium when Stripe is not configured', async () => {
    const email = `upgrade-test-user-${Date.now()}@example.com`;
    const password = 'TestPass123!';
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password }
    });
    expect(register.statusCode).toBe(200);
    const token = (register.json() as { token: string }).token;

    const headers = {
      authorization: `Bearer ${token}`,
      origin: 'http://localhost:3000'
    };

    const before = await app.inject({
      method: 'GET',
      url: '/me',
      headers
    });
    expect(before.statusCode).toBe(200);
    expect((before.json() as { user: { plan: string } }).user.plan).toBe('FREE');

    const checkout = await app.inject({
      method: 'POST',
      url: '/billing/checkout',
      headers,
      payload: {
        interval: 'monthly'
      }
    });
    expect(checkout.statusCode).toBe(503);
    const checkoutBody = checkout.json() as { error: { code: string } };
    expect(checkoutBody.error.code).toBe('STRIPE_NOT_CONFIGURED');

    const after = await app.inject({
      method: 'GET',
      url: '/me',
      headers
    });
    expect(after.statusCode).toBe(200);
    expect((after.json() as { user: { plan: string } }).user.plan).toBe('FREE');
  });

  it('returns scorer-like ordering for /players?limit=5 used by home chart', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/players?limit=5&offset=0'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ ppg: number }> };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]!.ppg).toBeGreaterThanOrEqual(body.data[body.data.length - 1]!.ppg);
    expect(body.data[0]!.ppg).toBeGreaterThan(15);
  });

  it('uses played-game cache values for /players list summary stats', async () => {
    const playerId = pickPlayerWithDnpRows();
    const season = getLatestSeason();
    const expected = getPlayedSeasonAverages(playerId, season);

    const playerName = sqlite
      .prepare(
        `SELECT player_name
         FROM app_player_season_stats
         WHERE season = ?
           AND player_id = ?`
      )
      .pluck()
      .get(season, playerId) as string;

    const response = await app.inject({
      method: 'GET',
      url: `/players?season=${encodeURIComponent(season)}&search=${encodeURIComponent(playerName)}&limit=100`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ player_id?: string; playerId?: string; ppg: number; rpg: number; apg: number }>;
    };
    const row = body.data.find((entry) => (entry.player_id ?? entry.playerId) === playerId);

    expect(row).toBeDefined();
    expect(row?.ppg ?? 0).toBeCloseTo(expected.ppg, 4);
    expect(row?.rpg ?? 0).toBeCloseTo(expected.rpg, 4);
    expect(row?.apg ?? 0).toBeCloseTo(expected.apg, 4);
  });

  it('applies qualification filters to percentage leaderboards', async () => {
    const seasonRow = sqlite
      .prepare(
        `SELECT season, MAX(games) AS max_games
         FROM app_player_season_stats
         GROUP BY season
         ORDER BY season DESC
         LIMIT 1`
      )
      .get() as { season: string; max_games: number };

    const minGames = Math.max(12, Math.floor((seasonRow.max_games ?? 0) * 0.45));
    const minThreeMade = Math.max(35, Math.floor((seasonRow.max_games ?? 0) * 1.0));

    const response = await app.inject({
      method: 'GET',
      url: '/leaderboards?metric=threePointPct&limit=25'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ player_id?: string; playerId?: string; games?: number; gamesPlayed?: number }>;
      meta: { season: string };
    };

    expect(body.meta.season).toBe(seasonRow.season);
    expect(body.data.length).toBeGreaterThan(0);

    for (const row of body.data) {
      const games = row.games ?? row.gamesPlayed ?? 0;
      expect(games).toBeGreaterThanOrEqual(minGames);

      const playerId = row.player_id ?? row.playerId;
      expect(typeof playerId).toBe('string');

      const stats = sqlite
        .prepare(
          `SELECT fg3_made_total
           FROM app_player_season_stats
           WHERE season = ?
             AND player_id = ?`
        )
        .get(seasonRow.season, playerId) as { fg3_made_total: number } | undefined;

      expect(stats).toBeDefined();
      expect((stats?.fg3_made_total ?? 0)).toBeGreaterThanOrEqual(minThreeMade);
    }
  });

  it('uses played-game denominators for points leaderboard entries', async () => {
    const playerId = pickQualifiedPlayerWithDnpRows();
    const season = getLatestSeason();
    const expected = getPlayedSeasonAverages(playerId, season);

    const response = await app.inject({
      method: 'GET',
      url: `/leaderboards?metric=points&season=${encodeURIComponent(season)}&limit=100`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ player_id?: string; playerId?: string; games?: number; gamesPlayed?: number; value: number }>;
    };
    const row = body.data.find((entry) => (entry.player_id ?? entry.playerId) === playerId);

    expect(row).toBeDefined();
    expect(row?.games ?? row?.gamesPlayed ?? 0).toBe(expected.gp);
    expect(row?.value ?? 0).toBeCloseTo(expected.ppg, 4);
  });
});
