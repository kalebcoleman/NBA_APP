-- Played-only canonical game logs.
-- A game counts as "played" if minutes > 0 OR any core activity stat > 0.

DROP VIEW IF EXISTS v_player_game_logs_played;
CREATE VIEW v_player_game_logs_played AS
SELECT *
FROM v_player_game_logs
WHERE (
  CASE
    WHEN TRIM(COALESCE(minutes, '')) = '' THEN 0
    WHEN INSTR(minutes, ':') > 0 THEN
      COALESCE(CAST(SUBSTR(minutes, 1, INSTR(minutes, ':') - 1) AS INTEGER), 0) * 60
      + COALESCE(CAST(SUBSTR(minutes, INSTR(minutes, ':') + 1) AS INTEGER), 0)
    ELSE
      CAST(COALESCE(minutes, '0') AS REAL) * 60
  END
) > 0
OR COALESCE(fg_attempted, 0) > 0
OR COALESCE(ft_attempted, 0) > 0
OR COALESCE(points, 0) > 0
OR COALESCE(rebounds_total, 0) > 0
OR COALESCE(assists, 0) > 0
OR COALESCE(steals, 0) > 0
OR COALESCE(blocks, 0) > 0
OR COALESCE(turnovers, 0) > 0;
