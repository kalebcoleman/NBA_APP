CREATE TABLE IF NOT EXISTS "espn_upcoming_game_snapshots" (
    "game_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "season" TEXT,
    "season_type" TEXT,
    "home_team_id" TEXT NOT NULL,
    "home_team_name" TEXT NOT NULL,
    "away_team_id" TEXT NOT NULL,
    "away_team_name" TEXT NOT NULL,
    "home_record" TEXT,
    "away_record" TEXT,
    "home_last_10" TEXT,
    "away_last_10" TEXT,
    "source" TEXT,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espn_upcoming_game_snapshots_pkey" PRIMARY KEY ("game_id")
);

CREATE INDEX IF NOT EXISTS "espn_upcoming_game_snapshots_start_time_idx"
  ON "espn_upcoming_game_snapshots"("start_time");

CREATE INDEX IF NOT EXISTS "espn_upcoming_game_snapshots_home_team_id_start_time_idx"
  ON "espn_upcoming_game_snapshots"("home_team_id", "start_time");

CREATE INDEX IF NOT EXISTS "espn_upcoming_game_snapshots_away_team_id_start_time_idx"
  ON "espn_upcoming_game_snapshots"("away_team_id", "start_time");

CREATE TABLE IF NOT EXISTS "espn_sync_state" (
    "sync_key" TEXT NOT NULL,
    "last_attempt_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espn_sync_state_pkey" PRIMARY KEY ("sync_key")
);
