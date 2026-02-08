import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { env } from '../config/env.js';
import { workspaceRoot } from '../utils/paths.js';

export const sqlite = new Database(env.databasePath, {
  fileMustExist: true
});

sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 3000');

function applySqlFile(absolutePath: string): void {
  const sql = fs.readFileSync(absolutePath, 'utf8');
  sqlite.exec(sql);
}

function applyPrismaMigrations(): void {
  const migrationsDir = path.join(workspaceRoot, 'apps', 'api', 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS app_prisma_migrations (
       migration_name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );

  const isApplied = sqlite.prepare(
    `SELECT migration_name
     FROM app_prisma_migrations
     WHERE migration_name = ?
     LIMIT 1`
  );
  const markApplied = sqlite.prepare(
    `INSERT INTO app_prisma_migrations (migration_name)
     VALUES (?)`
  );

  const migrationFolders = fs
    .readdirSync(migrationsDir)
    .filter((entry) => !entry.endsWith('.toml'))
    .sort();

  for (const folder of migrationFolders) {
    const alreadyApplied = isApplied.get(folder) as { migration_name: string } | undefined;
    if (alreadyApplied) {
      continue;
    }

    const migrationPath = path.join(migrationsDir, folder, 'migration.sql');
    if (fs.existsSync(migrationPath)) {
      applySqlFile(migrationPath);
      markApplied.run(folder);
    }
  }
}

function applyCanonicalViews(): void {
  const migrationsDir = path.join(workspaceRoot, 'db', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  for (const fileName of migrationFiles) {
    applySqlFile(path.join(migrationsDir, fileName));
  }
}

function ensurePlayerSeasonCacheColumns(): void {
  const tableInfo = sqlite
    .prepare("PRAGMA table_info('app_player_season_stats')")
    .all() as Array<{ name: string }>;
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  const requiredColumns: Array<{ name: string; definition: string }> = [
    { name: 'fg_made_total', definition: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'fg_attempts_total', definition: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'fg3_made_total', definition: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'fg3_attempts_total', definition: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'ft_attempts_total', definition: 'INTEGER NOT NULL DEFAULT 0' }
  ];

  for (const column of requiredColumns) {
    if (!existingColumns.has(column.name)) {
      sqlite.exec(`ALTER TABLE app_player_season_stats ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS idx_app_player_season_stats_season_games
     ON app_player_season_stats(season, games DESC)`
  );
}

function ensureUserAuthColumns(): void {
  const tableInfo = sqlite
    .prepare("PRAGMA table_info('users')")
    .all() as Array<{ name: string }>;
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  if (!existingColumns.has('password_hash')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  }

  sqlite.exec(
    `UPDATE users
     SET email = LOWER(TRIM(email))
     WHERE email IS NOT NULL`
  );
  sqlite.exec(
    `WITH normalized AS (
       SELECT
         id,
         ROW_NUMBER() OVER (
           PARTITION BY email
           ORDER BY created_at ASC, id ASC
         ) AS rn
       FROM users
       WHERE email IS NOT NULL
     )
     UPDATE users
     SET email = NULL
     WHERE id IN (
       SELECT id
       FROM normalized
       WHERE rn > 1
     )`
  );
  sqlite.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
     ON users(email)`
  );
}

function refreshPlayerSeasonCacheForSeason(season: string): void {
  sqlite
    .prepare('DELETE FROM app_player_season_stats WHERE season = ?')
    .run(season);

  sqlite
    .prepare(
      `INSERT INTO app_player_season_stats (
         season,
         player_id,
         player_name,
         position,
         team_id,
         team_abbrev,
         games,
         ppg,
         rpg,
         apg,
         fg_made_total,
         fg_attempts_total,
         fg3_made_total,
         fg3_attempts_total,
         ft_attempts_total,
         fg_pct,
         three_pct,
         ft_pct,
         ts_pct,
         usage_pct,
         pie,
         net_rating,
         offensive_rating,
         defensive_rating,
         updated_at
       )
      WITH base AS (
         SELECT
           gl.season AS season,
           gl.player_id,
           gl.player_name,
           gl.position,
           gl.team_id,
           gl.team_abbrev,
           gl.game_id,
           gl.points,
           gl.rebounds_total,
           gl.assists,
           gl.fg_made,
           gl.fg_attempted,
           gl.fg3_made,
           gl.fg3_attempted,
           gl.ft_made,
           gl.ft_attempted,
           gl.true_shooting_pct AS ts_pct,
           gl.usage_pct,
           gl.pie,
           gl.net_rating,
           gl.offensive_rating,
           gl.defensive_rating
         FROM v_player_game_logs_played gl
         WHERE gl.season = ?
           AND gl.season_type = 'regular'
       ),
       latest_identity AS (
         SELECT
           player_id,
           player_name,
           position,
           team_id,
           team_abbrev,
           ROW_NUMBER() OVER (
             PARTITION BY player_id
             ORDER BY game_id DESC
           ) AS rn
         FROM base
       )
       SELECT
         b.season,
         b.player_id,
         li.player_name,
         li.position,
         li.team_id,
         li.team_abbrev,
         COUNT(*) AS games,
         ROUND(COALESCE(SUM(b.points) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS ppg,
         ROUND(COALESCE(SUM(b.rebounds_total) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS rpg,
         ROUND(COALESCE(SUM(b.assists) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS apg,
         COALESCE(SUM(b.fg_made), 0) AS fg_made_total,
         COALESCE(SUM(b.fg_attempted), 0) AS fg_attempts_total,
         COALESCE(SUM(b.fg3_made), 0) AS fg3_made_total,
         COALESCE(SUM(b.fg3_attempted), 0) AS fg3_attempts_total,
         COALESCE(SUM(b.ft_attempted), 0) AS ft_attempts_total,
         ROUND(COALESCE(SUM(b.fg_made) * 100.0 / NULLIF(SUM(b.fg_attempted), 0), 0), 3) AS fg_pct,
         ROUND(COALESCE(SUM(b.fg3_made) * 100.0 / NULLIF(SUM(b.fg3_attempted), 0), 0), 3) AS three_pct,
         ROUND(COALESCE(SUM(b.ft_made) * 100.0 / NULLIF(SUM(b.ft_attempted), 0), 0), 3) AS ft_pct,
         ROUND(COALESCE(AVG(b.ts_pct) * 100.0, 0), 3) AS ts_pct,
         ROUND(COALESCE(AVG(b.usage_pct) * 100.0, 0), 3) AS usage_pct,
         ROUND(COALESCE(AVG(b.pie) * 100.0, 0), 3) AS pie,
         ROUND(COALESCE(AVG(b.net_rating), 0), 3) AS net_rating,
         ROUND(COALESCE(AVG(b.offensive_rating), 0), 3) AS offensive_rating,
         ROUND(COALESCE(AVG(b.defensive_rating), 0), 3) AS defensive_rating,
         CURRENT_TIMESTAMP AS updated_at
       FROM base b
       JOIN latest_identity li
         ON li.player_id = b.player_id
         AND li.rn = 1
       GROUP BY b.season, b.player_id`
    )
    .run(season);
}

function refreshPlayerSeasonCache(): void {
  const availableSeasons = sqlite
    .prepare(
      `SELECT DISTINCT season
       FROM nba_stats_games
       WHERE season IS NOT NULL
         AND season_type = 'regular'
       ORDER BY season DESC`
    )
    .all() as Array<{ season: string }>;

  if (availableSeasons.length === 0) {
    return;
  }

  for (const { season } of availableSeasons) {
    refreshPlayerSeasonCacheForSeason(season);
  }
}

function normalizePlayerSeasonCachePercentages(): void {
  sqlite.exec(
    `UPDATE app_player_season_stats
     SET
       fg_pct = CASE
         WHEN fg_pct IS NOT NULL AND fg_pct > 0 AND fg_pct <= 1 THEN ROUND(fg_pct * 100.0, 3)
         ELSE fg_pct
       END,
       three_pct = CASE
         WHEN three_pct IS NOT NULL AND three_pct > 0 AND three_pct <= 1 THEN ROUND(three_pct * 100.0, 3)
         ELSE three_pct
       END,
       ft_pct = CASE
         WHEN ft_pct IS NOT NULL AND ft_pct > 0 AND ft_pct <= 1 THEN ROUND(ft_pct * 100.0, 3)
         ELSE ft_pct
       END,
       ts_pct = CASE
         WHEN ts_pct IS NOT NULL AND ts_pct > 0 AND ts_pct <= 1 THEN ROUND(ts_pct * 100.0, 3)
         ELSE ts_pct
       END,
       usage_pct = CASE
         WHEN usage_pct IS NOT NULL AND usage_pct > 0 AND usage_pct <= 1 THEN ROUND(usage_pct * 100.0, 3)
         ELSE usage_pct
       END,
       pie = CASE
         WHEN pie IS NOT NULL AND ABS(pie) <= 1 THEN ROUND(pie * 100.0, 3)
         ELSE pie
       END`
  );
}

let bootstrapped = false;

export function bootstrapSqlite(): void {
  if (bootstrapped) {
    return;
  }

  applyPrismaMigrations();
  applyCanonicalViews();
  ensureUserAuthColumns();
  ensurePlayerSeasonCacheColumns();
  refreshPlayerSeasonCache();
  normalizePlayerSeasonCachePercentages();
  bootstrapped = true;
}
