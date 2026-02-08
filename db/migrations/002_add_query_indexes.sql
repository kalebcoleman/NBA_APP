-- Indexes for high-volume API filters and joins.

CREATE INDEX IF NOT EXISTS idx_player_box_trad_player_season_game
  ON nba_stats_player_box_traditional(player_id, season, gameId);

CREATE INDEX IF NOT EXISTS idx_player_box_trad_person_season_game
  ON nba_stats_player_box_traditional(personId, season, gameId);

CREATE INDEX IF NOT EXISTS idx_player_box_trad_team_season_game
  ON nba_stats_player_box_traditional(team_id, season, gameId);

CREATE INDEX IF NOT EXISTS idx_player_box_adv_player_season_game
  ON nba_stats_player_box_advanced(player_id, season, gameId);

CREATE INDEX IF NOT EXISTS idx_player_box_adv_person_season_game
  ON nba_stats_player_box_advanced(personId, season, gameId);

CREATE INDEX IF NOT EXISTS idx_team_box_trad_team_season_game
  ON nba_stats_team_box_traditional(team_id, season, gameId);

CREATE INDEX IF NOT EXISTS idx_team_box_adv_team_season_game
  ON nba_stats_team_box_advanced(team_id, season, gameId);

CREATE INDEX IF NOT EXISTS idx_team_box_adv_tricode_season_game
  ON nba_stats_team_box_advanced(teamTricode, season, gameId);

CREATE INDEX IF NOT EXISTS idx_shots_player_season_game
  ON nba_stats_shots(PLAYER_ID, season, GAME_ID);

CREATE INDEX IF NOT EXISTS idx_shots_player_game
  ON nba_stats_shots(PLAYER_ID, GAME_ID);

CREATE INDEX IF NOT EXISTS idx_shots_game_date
  ON nba_stats_shots(GAME_DATE);

CREATE INDEX IF NOT EXISTS idx_games_game_id
  ON nba_stats_games(game_id);

CREATE INDEX IF NOT EXISTS idx_games_season_type_date
  ON nba_stats_games(season, season_type, game_date);

CREATE INDEX IF NOT EXISTS idx_games_home_team
  ON nba_stats_games(home_team_id, season, game_date);

CREATE INDEX IF NOT EXISTS idx_games_away_team
  ON nba_stats_games(away_team_id, season, game_date);
