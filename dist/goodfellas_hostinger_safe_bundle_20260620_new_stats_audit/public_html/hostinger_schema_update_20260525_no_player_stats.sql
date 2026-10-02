-- Goodfellas - delta seguro Hostinger
-- Fecha: 2026-05-25
-- Objetivo: esquema y formaciones necesarias para la version actual.
-- Importante: este script NO actualiza ni recalcula stats de jugadores.
-- No toca players.skill, technique, rhythm, defense_physical, attack,
-- teamwork, mentality, regularity ni goalkeeper_skill.

START TRANSACTION;

ALTER TABLE match_players
  MODIFY assigned_position ENUM('ARQ','DEF','LAT','MED','DEL') DEFAULT NULL;

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS lineup_order SMALLINT UNSIGNED NULL AFTER is_goalkeeper,
  ADD COLUMN IF NOT EXISTS formation_line_order TINYINT UNSIGNED NULL AFTER lineup_order;

ALTER TABLE match_teams
  ADD COLUMN IF NOT EXISTS formation_name VARCHAR(80) NULL AFTER total_skill,
  ADD COLUMN IF NOT EXISTS formation_data TEXT NULL AFTER formation_name,
  ADD COLUMN IF NOT EXISTS color_name VARCHAR(40) NULL AFTER formation_data;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255) NULL AFTER goalkeeper_skill;

CREATE INDEX IF NOT EXISTS idx_match_lineup
  ON match_players (match_id, team_number, assigned_position, lineup_order);

UPDATE match_teams mt
LEFT JOIN (
  SELECT
    match_id,
    team_number,
    CONCAT(
      SUM(CASE WHEN assigned_position = 'ARQ' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'DEF' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'LAT' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'MED' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'DEL' THEN 1 ELSE 0 END)
    ) AS formation_name
  FROM match_players
  WHERE team_number IS NOT NULL
  GROUP BY match_id, team_number
) f ON f.match_id = mt.match_id AND f.team_number = mt.team_number
SET mt.formation_name = COALESCE(mt.formation_name, f.formation_name)
WHERE f.formation_name IS NOT NULL;

COMMIT;
