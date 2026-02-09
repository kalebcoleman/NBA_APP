import { Prisma } from '@prisma/client';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';

const SYNC_KEY = 'upcoming_games';
const DEFAULT_WINDOW_DAYS = 14;
const LOOKBACK_HOURS = 24;

interface EspnUpcomingSourceRow {
  game_id: string;
  game_date: string;
  status: string | null;
  season: string | null;
  season_type: string | null;
  home_team_id: string | null;
  home_team: string | null;
  away_team_id: string | null;
  away_team: string | null;
  home_record_total: string | null;
  away_record_total: string | null;
  home_last_10_wins: number | null;
  home_last_10_losses: number | null;
  away_last_10_wins: number | null;
  away_last_10_losses: number | null;
  source: string | null;
}

interface SchedulerLogger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface UpcomingGamesQuery {
  from?: string;
  to?: string;
  teamId?: string;
  limit: number;
}

function buildSyncWindow(now = new Date()) {
  const from = new Date(now);
  from.setHours(from.getHours() - LOOKBACK_HOURS);

  const to = new Date(now);
  to.setDate(to.getDate() + DEFAULT_WINDOW_DAYS);

  return { from, to };
}

function formatLast10(wins: number | null, losses: number | null): string | null {
  if (wins === null || losses === null) {
    return null;
  }

  if (!Number.isFinite(wins) || !Number.isFinite(losses)) {
    return null;
  }

  return `${wins}-${losses}`;
}

function normalizeUpcomingRows(rows: EspnUpcomingSourceRow[], syncedAt: Date) {
  return rows
    .map((row) => {
      if (!row.game_id || !row.game_date || !row.home_team_id || !row.away_team_id) {
        return null;
      }

      const startTime = new Date(row.game_date);
      if (Number.isNaN(startTime.getTime())) {
        return null;
      }

      return {
        gameId: row.game_id,
        startTime,
        status: row.status,
        season: row.season,
        seasonType: row.season_type,
        homeTeamId: row.home_team_id,
        homeTeamName: row.home_team ?? row.home_team_id,
        awayTeamId: row.away_team_id,
        awayTeamName: row.away_team ?? row.away_team_id,
        homeRecord: row.home_record_total,
        awayRecord: row.away_record_total,
        homeLast10: formatLast10(row.home_last_10_wins, row.home_last_10_losses),
        awayLast10: formatLast10(row.away_last_10_wins, row.away_last_10_losses),
        source: row.source,
        lastSyncedAt: syncedAt
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function parseQueryDate(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

async function upsertSyncState(input: {
  now: Date;
  success: boolean;
  errorMessage?: string;
}) {
  await prisma.espnSyncState.upsert({
    where: { syncKey: SYNC_KEY },
    create: {
      syncKey: SYNC_KEY,
      lastAttemptAt: input.now,
      lastSuccessAt: input.success ? input.now : null,
      lastError: input.success ? null : input.errorMessage ?? 'Unknown sync failure'
    },
    update: {
      lastAttemptAt: input.now,
      lastSuccessAt: input.success ? input.now : undefined,
      lastError: input.success ? null : input.errorMessage ?? 'Unknown sync failure'
    }
  });
}

async function queryEspnUpcomingRows(windowStart: Date, windowEnd: Date): Promise<EspnUpcomingSourceRow[]> {
  const startIso = windowStart.toISOString();
  const endIso = windowEnd.toISOString();

  const rows = await prisma.$queryRaw<EspnUpcomingSourceRow[]>`
    SELECT
      g.game_id,
      g.game_date,
      g.status,
      CAST(g.season AS TEXT) AS season,
      g.season_type,
      g.home_team_id,
      g.home_team,
      g.away_team_id,
      g.away_team,
      g.home_record_total,
      g.away_record_total,
      CAST(home_box."Last Ten GamesMade" AS INTEGER) AS home_last_10_wins,
      CAST(home_box."Last Ten GamesAttempted" AS INTEGER) AS home_last_10_losses,
      CAST(away_box."Last Ten GamesMade" AS INTEGER) AS away_last_10_wins,
      CAST(away_box."Last Ten GamesAttempted" AS INTEGER) AS away_last_10_losses,
      g.source
    FROM espn_games g
    LEFT JOIN espn_team_box home_box
      ON home_box.game_id = g.game_id
      AND LOWER(COALESCE(home_box.home_away, '')) = 'home'
    LEFT JOIN espn_team_box away_box
      ON away_box.game_id = g.game_id
      AND LOWER(COALESCE(away_box.home_away, '')) = 'away'
    WHERE g.game_date IS NOT NULL
      AND g.game_date >= ${startIso}
      AND g.game_date <= ${endIso}
    ORDER BY g.game_date ASC, g.game_id ASC
  `;

  return rows;
}

export async function syncUpcomingGamesSnapshot(now = new Date()) {
  const { from, to } = buildSyncWindow(now);
  const rows = await queryEspnUpcomingRows(from, to);
  const normalized = normalizeUpcomingRows(rows, now);
  const ids = normalized.map((row) => row.gameId);

  await upsertSyncState({ now, success: false, errorMessage: 'Sync in progress' });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.espnUpcomingGameSnapshot.deleteMany({
        where: {
          startTime: {
            gte: from,
            lte: to
          },
          ...(ids.length > 0 ? { gameId: { notIn: ids } } : {})
        }
      });

      for (const row of normalized) {
        await tx.espnUpcomingGameSnapshot.upsert({
          where: { gameId: row.gameId },
          create: row,
          update: row
        });
      }
    });

    await upsertSyncState({ now, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync failure';
    await upsertSyncState({ now, success: false, errorMessage: message });
    throw error;
  }

  return {
    syncedAt: now,
    upserted: normalized.length
  };
}

export async function getUpcomingGamesSnapshot(query: UpcomingGamesQuery) {
  const now = new Date();
  const defaultFrom = now;
  const defaultTo = new Date(now);
  defaultTo.setDate(defaultTo.getDate() + DEFAULT_WINDOW_DAYS);

  const from = parseQueryDate(query.from, defaultFrom);
  const to = parseQueryDate(query.to, defaultTo);
  const teamId = query.teamId?.trim() || undefined;

  const where: Prisma.EspnUpcomingGameSnapshotWhereInput = {
    startTime: {
      gte: from,
      lte: to
    }
  };

  if (teamId) {
    let resolvedName = teamId;
    // If it looks like an NBA ID (long string), try to resolve to team name for better matching with ESPN data
    if (teamId.length > 5) {
      const teamRows = await prisma.$queryRaw<any[]>`SELECT name FROM v_teams WHERE team_id = ${teamId}`;
      if (teamRows.length > 0 && teamRows[0].name) {
        resolvedName = teamRows[0].name;
      }
    }

    where.OR = [
      { homeTeamId: teamId },
      { awayTeamId: teamId },
      { homeTeamName: { contains: resolvedName, mode: 'insensitive' } },
      { awayTeamName: { contains: resolvedName, mode: 'insensitive' } }
    ];
  }

  let state = await prisma.espnSyncState.findUnique({ where: { syncKey: SYNC_KEY } });
  if (!state?.lastSuccessAt) {
    try {
      await syncUpcomingGamesSnapshot(now);
      state = await prisma.espnSyncState.findUnique({ where: { syncKey: SYNC_KEY } });
    } catch {
      // Fall through and return whatever data is already cached.
    }
  }

  const rows = await prisma.espnUpcomingGameSnapshot.findMany({
    where,
    orderBy: {
      startTime: 'asc'
    },
    take: query.limit
  });

  const lastSyncedAt = state?.lastSuccessAt ?? null;
  const staleMs = env.espnSyncIntervalMinutes * 60_000 * 2;
  const isStale = !lastSyncedAt || (Date.now() - lastSyncedAt.getTime()) > staleMs;

  return {
    data: rows.map((row) => ({
      gameId: row.gameId,
      startTime: row.startTime.toISOString(),
      status: row.status,
      homeTeam: {
        teamId: row.homeTeamId,
        name: row.homeTeamName
      },
      awayTeam: {
        teamId: row.awayTeamId,
        name: row.awayTeamName
      },
      homeRecord: row.homeRecord,
      awayRecord: row.awayRecord,
      homeLast10: row.homeLast10,
      awayLast10: row.awayLast10,
      lastSyncedAt: row.lastSyncedAt.toISOString(),
      isStale
    })),
    meta: {
      from: from.toISOString(),
      to: to.toISOString(),
      limit: query.limit,
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      isStale
    }
  };
}

export function startUpcomingGamesSyncScheduler(logger: SchedulerLogger): () => void {
  if (!env.espnSyncEnabled) {
    return () => { };
  }

  let running = false;
  const intervalMs = Math.max(1, env.espnSyncIntervalMinutes) * 60_000;

  const run = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await syncUpcomingGamesSnapshot();
      logger.info(
        {
          upserted: result.upserted,
          syncedAt: result.syncedAt.toISOString()
        },
        'espn_upcoming_sync_success'
      );
    } catch (error) {
      logger.error(
        {
          err: error instanceof Error ? error.message : String(error)
        },
        'espn_upcoming_sync_failed'
      );
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => {
    void run();
  }, intervalMs);

  return () => clearInterval(timer);
}
