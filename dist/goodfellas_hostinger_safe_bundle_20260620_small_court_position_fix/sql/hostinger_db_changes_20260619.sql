-- Goodfellas - cambios de base de datos Hostinger
-- Bundle: goodfellas_hostinger_safe_bundle_20260619_021723
-- Commit base: c1a9660
--
-- Nota: los cambios visuales mas recientes de editar_partidos/capitanes NO requieren cambios nuevos de base de datos.
-- Este script consolida los deltas seguros incluidos en el bundle para dejar una base vieja al dia.
-- Ejecutar en phpMyAdmin sobre la base de Hostinger, despues de hacer backup.

SET NAMES utf8mb4;


-- ============================================================
-- BEGIN sql\hostinger_safe_update_20260507.sql
-- ============================================================

-- Goodfellas Futbol - actualizacion segura Hostinger
-- Fecha: 2026-05-07
-- Ejecutar en phpMyAdmin sobre la base u552541920_futbol.
-- No borra datos. Agrega columnas/tablas faltantes y hace backfill de valores.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS match_awards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  award_code VARCHAR(40) NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_match_award (match_id, award_code),
  INDEX idx_awards_player (player_id, award_code),
  CONSTRAINT fk_match_awards_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_awards_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS captain_drafts (
  match_id INT UNSIGNED PRIMARY KEY,
  captain1_player_id INT UNSIGNED NOT NULL,
  captain2_player_id INT UNSIGNED NOT NULL,
  captain3_player_id INT UNSIGNED NULL,
  captain4_player_id INT UNSIGNED NULL,
  captain1_token VARCHAR(64) NOT NULL,
  captain2_token VARCHAR(64) NOT NULL,
  captain3_token VARCHAR(64) NULL,
  captain4_token VARCHAR(64) NULL,
  current_team TINYINT UNSIGNED NULL DEFAULT 1,
  status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  turn_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_captain_drafts_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain1
    FOREIGN KEY (captain1_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain2
    FOREIGN KEY (captain2_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain3
    FOREIGN KEY (captain3_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain4
    FOREIGN KEY (captain4_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS captain_picks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  team_number TINYINT UNSIGNED NOT NULL,
  picked_by_player_id INT UNSIGNED NOT NULL,
  pick_order SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_captain_pick_player (match_id, player_id),
  UNIQUE KEY uniq_captain_pick_order (match_id, pick_order),
  INDEX idx_captain_pick_match_team (match_id, team_number),
  CONSTRAINT fk_captain_picks_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_captain_picks_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_picks_picker
    FOREIGN KEY (picked_by_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_round_robin_results (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  home_team_number TINYINT UNSIGNED NOT NULL,
  away_team_number TINYINT UNSIGNED NOT NULL,
  leg TINYINT UNSIGNED NOT NULL,
  home_goals SMALLINT UNSIGNED NULL,
  away_goals SMALLINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_round_robin_fixture (match_id, home_team_number, away_team_number, leg),
  INDEX idx_round_robin_match (match_id),
  CONSTRAINT fk_round_robin_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS title VARCHAR(120) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS num_teams TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER match_date,
  ADD COLUMN IF NOT EXISTS players_per_team TINYINT UNSIGNED NOT NULL DEFAULT 9 AFTER num_teams,
  ADD COLUMN IF NOT EXISTS max_diff DECIMAL(4,1) NOT NULL DEFAULT 0.7 AFTER players_per_team,
  ADD COLUMN IF NOT EXISTS allow_redraw TINYINT(1) NOT NULL DEFAULT 1 AFTER max_diff,
  ADD COLUMN IF NOT EXISTS redraw_limit TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER allow_redraw,
  ADD COLUMN IF NOT EXISTS redraw_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER redraw_limit,
  ADD COLUMN IF NOT EXISTS multi_draw_count TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER redraw_count,
  ADD COLUMN IF NOT EXISTS multi_draw_lock_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER multi_draw_count,
  ADD COLUMN IF NOT EXISTS multi_draw_winner_option_id INT UNSIGNED NULL AFTER multi_draw_lock_minutes,
  ADD COLUMN IF NOT EXISTS draw_mode ENUM('none', 'random', 'captains', 'manual') NOT NULL DEFAULT 'none' AFTER status,
  ADD COLUMN IF NOT EXISTS draw_started_at DATETIME NULL AFTER draw_mode,
  ADD COLUMN IF NOT EXISTS draw_completed_at DATETIME NULL AFTER draw_started_at,
  ADD COLUMN IF NOT EXISTS draw_audit_snapshot JSON NULL AFTER draw_completed_at,
  ADD COLUMN IF NOT EXISTS finalized_at DATETIME NULL AFTER draw_audit_snapshot,
  ADD COLUMN IF NOT EXISTS formation_edit_deadline DATETIME NULL AFTER finalized_at,
  ADD COLUMN IF NOT EXISTS public_token VARCHAR(64) NULL AFTER formation_edit_deadline,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER public_token,
  ADD COLUMN IF NOT EXISTS result_notes TEXT NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS round_robin_legs TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER result_notes,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE matches
  MODIFY max_diff DECIMAL(4,1) NOT NULL DEFAULT 0.7,
  MODIFY draw_mode ENUM('none', 'random', 'captains', 'manual') NOT NULL DEFAULT 'none';

ALTER TABLE match_teams
  ADD COLUMN IF NOT EXISTS captain_player_id INT UNSIGNED NULL AFTER team_name,
  ADD COLUMN IF NOT EXISTS formation_name VARCHAR(80) NULL AFTER total_skill,
  ADD COLUMN IF NOT EXISTS formation_data TEXT NULL AFTER formation_name,
  ADD COLUMN IF NOT EXISTS color_name VARCHAR(40) NULL AFTER formation_data,
  ADD COLUMN IF NOT EXISTS goals SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER color_name;

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS lineup_order SMALLINT UNSIGNED NULL AFTER is_goalkeeper,
  ADD COLUMN IF NOT EXISTS formation_line_order TINYINT UNSIGNED NULL AFTER lineup_order,
  ADD COLUMN IF NOT EXISTS availability_status ENUM('convocado', 'confirmado', 'baja') NOT NULL DEFAULT 'convocado' AFTER formation_line_order;

ALTER TABLE captain_drafts
  ADD COLUMN IF NOT EXISTS started_at DATETIME NULL AFTER status,
  ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL AFTER started_at,
  ADD COLUMN IF NOT EXISTS turn_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER completed_at,
  ADD COLUMN IF NOT EXISTS captain3_player_id INT UNSIGNED NULL AFTER captain2_player_id,
  ADD COLUMN IF NOT EXISTS captain4_player_id INT UNSIGNED NULL AFTER captain3_player_id,
  ADD COLUMN IF NOT EXISTS captain3_token VARCHAR(64) NULL AFTER captain2_token,
  ADD COLUMN IF NOT EXISTS captain4_token VARCHAR(64) NULL AFTER captain3_token;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS technique DECIMAL(3,1) NULL AFTER skill,
  ADD COLUMN IF NOT EXISTS rhythm DECIMAL(3,1) NULL AFTER technique,
  ADD COLUMN IF NOT EXISTS defense_physical DECIMAL(3,1) NULL AFTER rhythm,
  ADD COLUMN IF NOT EXISTS attack DECIMAL(3,1) NULL AFTER defense_physical,
  ADD COLUMN IF NOT EXISTS teamwork DECIMAL(3,1) NOT NULL DEFAULT 3.0 AFTER attack,
  ADD COLUMN IF NOT EXISTS mentality DECIMAL(3,1) NOT NULL DEFAULT 3.0 AFTER teamwork,
  ADD COLUMN IF NOT EXISTS regularity DECIMAL(3,1) NULL AFTER mentality,
  ADD COLUMN IF NOT EXISTS goalkeeper_skill DECIMAL(3,1) NULL AFTER regularity;

CREATE INDEX IF NOT EXISTS idx_matches_draw_mode ON matches (draw_mode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_public_token ON matches (public_token);
CREATE INDEX IF NOT EXISTS idx_match_teams_captain ON match_teams (captain_player_id);
CREATE INDEX IF NOT EXISTS idx_match_lineup ON match_players (match_id, team_number, assigned_position, lineup_order);
CREATE INDEX IF NOT EXISTS idx_match_availability ON match_players (match_id, availability_status);

CREATE TABLE IF NOT EXISTS match_draw_options (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  option_number TINYINT UNSIGNED NOT NULL,
  teams_json MEDIUMTEXT NOT NULL,
  total_diff DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  selected_at DATETIME NULL,
  UNIQUE KEY uniq_match_draw_option (match_id, option_number),
  INDEX idx_match_draw_option_match (match_id),
  CONSTRAINT fk_match_draw_options_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE matches m
LEFT JOIN captain_drafts d ON d.match_id = m.id
SET m.draw_mode = CASE
    WHEN d.match_id IS NOT NULL THEN 'captains'
    WHEN m.status IN ('sorteado', 'finalizado') THEN 'random'
    ELSE 'none'
  END
WHERE m.draw_mode = 'none';

UPDATE matches
SET draw_completed_at = updated_at
WHERE draw_completed_at IS NULL
  AND status IN ('sorteado', 'finalizado');

UPDATE matches
SET finalized_at = updated_at
WHERE finalized_at IS NULL
  AND status = 'finalizado';

UPDATE matches
SET formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
WHERE formation_edit_deadline IS NULL;

UPDATE match_teams mt
INNER JOIN captain_drafts d ON d.match_id = mt.match_id
SET mt.captain_player_id = CASE
    WHEN mt.team_number = 1 THEN d.captain1_player_id
    WHEN mt.team_number = 2 THEN d.captain2_player_id
    ELSE mt.captain_player_id
  END
WHERE mt.captain_player_id IS NULL;

UPDATE match_teams mt
LEFT JOIN (
  SELECT match_id, team_number, COALESCE(SUM(goals), 0) AS goals
  FROM match_players
  WHERE team_number IS NOT NULL
  GROUP BY match_id, team_number
) g ON g.match_id = mt.match_id AND g.team_number = mt.team_number
SET mt.goals = COALESCE(g.goals, 0);

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
SET mt.formation_name = COALESCE(mt.formation_name, f.formation_name);

UPDATE players
SET
  technique = COALESCE(technique, skill),
  rhythm = COALESCE(rhythm, CASE WHEN pace = 'lento' THEN 2.0 ELSE 4.0 END),
  defense_physical = COALESCE(defense_physical, 3.0),
  attack = COALESCE(attack, skill),
  teamwork = COALESCE(teamwork, skill),
  mentality = COALESCE(mentality, 3.0),
  regularity = COALESCE(regularity, 3.5),
  goalkeeper_skill = COALESCE(goalkeeper_skill, CASE WHEN positions = 'ARQ' OR positions LIKE 'ARQ/%' OR positions LIKE '%/ARQ%' THEN skill ELSE NULL END);

UPDATE players
SET
  skill = ROUND(LEAST(6.0, GREATEST(1.0,
    CASE
      WHEN positions = 'ARQ' OR positions LIKE 'ARQ/%' THEN
       (
         (COALESCE(goalkeeper_skill, skill) * 0.42)
         + (defense_physical * 0.14)
         + (rhythm * 0.10)
         + (technique * 0.10)
         + (teamwork * 0.14)
         + (mentality * 0.10)
        ) * (1 + ((regularity - 3.5) / 50.0))
      WHEN positions = 'DEF' OR positions LIKE 'DEF/%' THEN
       (
         (defense_physical * 0.28)
         + (rhythm * 0.20)
         + (technique * 0.18)
         + (teamwork * 0.13)
         + (mentality * 0.13)
         + (attack * 0.08)
        ) * (1 + ((regularity - 3.5) / 50.0))
      WHEN positions = 'LAT' OR positions LIKE 'LAT/%' THEN
       (
         (rhythm * 0.24)
         + (defense_physical * 0.22)
         + (technique * 0.17)
         + (teamwork * 0.15)
         + (attack * 0.12)
         + (mentality * 0.10)
        ) * (1 + ((regularity - 3.5) / 50.0))
      WHEN positions = 'DEL' OR positions LIKE 'DEL/%' THEN
       (
         (attack * 0.31)
         + (rhythm * 0.20)
         + (technique * 0.17)
         + (teamwork * 0.14)
         + (mentality * 0.10)
         + (defense_physical * 0.08)
        ) * (1 + ((regularity - 3.5) / 50.0))
      ELSE
        (
         (technique * 0.24)
         + (rhythm * 0.23)
         + (teamwork * 0.19)
         + (mentality * 0.13)
         + (defense_physical * 0.12)
         + (attack * 0.09)
        ) * (1 + ((regularity - 3.5) / 50.0))
    END
  )), 1),
  pace = CASE WHEN rhythm <= 3.0 THEN 'lento' ELSE 'rapido' END
WHERE technique IS NOT NULL
  AND rhythm IS NOT NULL
  AND defense_physical IS NOT NULL
  AND attack IS NOT NULL
  AND teamwork IS NOT NULL
  AND mentality IS NOT NULL
  AND regularity IS NOT NULL;

CREATE TABLE IF NOT EXISTS site_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_needs_reset TINYINT(1) NOT NULL DEFAULT 0,
  role ENUM('usuario', 'jugador', 'directivo', 'admin') NOT NULL DEFAULT 'usuario',
  player_id INT UNSIGNED NULL,
  can_vote TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_site_users_username (username),
  UNIQUE KEY uniq_site_users_player (player_id),
  INDEX idx_site_users_role (role),
  CONSTRAINT fk_site_users_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE site_users
  MODIFY role ENUM('usuario', 'jugador', 'directivo', 'admin') NOT NULL DEFAULT 'usuario',
  ADD COLUMN IF NOT EXISTS password_needs_reset TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash,
  ADD COLUMN IF NOT EXISTS can_vote TINYINT(1) NOT NULL DEFAULT 0 AFTER player_id;

CREATE TABLE IF NOT EXISTS directive_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_user_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_needs_setup TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_directive_member_site_user (site_user_id),
  UNIQUE KEY uniq_directive_member_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE directive_members
  ADD COLUMN IF NOT EXISTS site_user_id INT UNSIGNED NULL AFTER id,
  ADD COLUMN IF NOT EXISTS password_needs_setup TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_directive_member_site_user ON directive_members (site_user_id);

CREATE TABLE IF NOT EXISTS match_draw_option_votes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  option_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_match_draw_vote_user (match_id, user_id),
  INDEX idx_match_draw_vote_option (option_id),
  CONSTRAINT fk_match_draw_votes_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_draw_votes_option
    FOREIGN KEY (option_id) REFERENCES match_draw_options(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_draw_votes_user
    FOREIGN KEY (user_id) REFERENCES site_users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_draw_votes_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_director_rating_votes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  voter_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  rating DECIMAL(3,1) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_director_rating_vote (match_id, voter_id, player_id),
  INDEX idx_director_rating_match_player (match_id, player_id),
  CONSTRAINT fk_director_rating_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_director_rating_voter FOREIGN KEY (voter_id) REFERENCES directive_members(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_director_rating_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_director_award_votes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  voter_id INT UNSIGNED NOT NULL,
  award_code VARCHAR(40) NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_director_award_vote (match_id, voter_id, award_code),
  INDEX idx_director_award_match_code (match_id, award_code),
  CONSTRAINT fk_director_award_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_director_award_voter FOREIGN KEY (voter_id) REFERENCES directive_members(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_director_award_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_director_publications (
  match_id INT UNSIGNED PRIMARY KEY,
  published_at DATETIME NOT NULL,
  reason ENUM('all_voted', 'deadline', 'admin') NOT NULL,
  eligible_voters SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  submitted_voters SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_director_publication_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE match_director_publications
  MODIFY reason ENUM('all_voted', 'deadline', 'admin') NOT NULL;

CREATE TABLE IF NOT EXISTS match_director_vote_invites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  voter_member_id INT UNSIGNED NOT NULL,
  token VARCHAR(5) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_director_vote_invite_match_player (match_id, player_id),
  UNIQUE KEY uniq_director_vote_invite_token (token),
  INDEX idx_director_vote_invite_match (match_id),
  CONSTRAINT fk_director_vote_invite_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_director_vote_invite_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_director_vote_invite_voter FOREIGN KEY (voter_member_id) REFERENCES directive_members(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- END sql\hostinger_safe_update_20260507.sql
-- ============================================================


-- ============================================================
-- BEGIN sql\hostinger_schema_update_20260525_no_player_stats.sql
-- ============================================================

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

-- ============================================================
-- END sql\hostinger_schema_update_20260525_no_player_stats.sql
-- ============================================================


-- ============================================================
-- BEGIN sql\hostinger_round_robin_update.sql
-- ============================================================

-- Goodfellas - actualizacion para modalidad todos contra todos
-- Ejecutar en phpMyAdmin sobre la base u552541920_futbol.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS round_robin_legs TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER result_notes;

CREATE TABLE IF NOT EXISTS match_round_robin_results (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  home_team_number TINYINT UNSIGNED NOT NULL,
  away_team_number TINYINT UNSIGNED NOT NULL,
  leg TINYINT UNSIGNED NOT NULL,
  home_goals SMALLINT UNSIGNED NULL,
  away_goals SMALLINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_round_robin_fixture (match_id, home_team_number, away_team_number, leg),
  INDEX idx_round_robin_match (match_id),
  CONSTRAINT fk_round_robin_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- END sql\hostinger_round_robin_update.sql
-- ============================================================


-- ============================================================
-- BEGIN sql\hostinger_update_20260601_schema_and_player_photos.sql
-- ============================================================

-- Goodfellas - actualizacion segura Hostinger
-- Fecha: 2026-06-01
-- Objetivo: dejar el esquema listo para la version actual y vincular fotos de jugadores.
-- Ejecutar en phpMyAdmin sobre la base del hosting.
-- No borra partidos, jugadores, estadisticas ni resultados.

SET NAMES utf8mb4;

START TRANSACTION;

-- Esquema requerido por sorteos, formaciones, capitanes y fotos.
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE app_settings
  MODIFY setting_value TEXT NOT NULL;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS title VARCHAR(120) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS num_teams TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER match_date,
  ADD COLUMN IF NOT EXISTS players_per_team TINYINT UNSIGNED NOT NULL DEFAULT 9 AFTER num_teams,
  ADD COLUMN IF NOT EXISTS max_diff DECIMAL(4,1) NOT NULL DEFAULT 0.7 AFTER players_per_team,
  ADD COLUMN IF NOT EXISTS allow_redraw TINYINT(1) NOT NULL DEFAULT 1 AFTER max_diff,
  ADD COLUMN IF NOT EXISTS redraw_limit TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER allow_redraw,
  ADD COLUMN IF NOT EXISTS redraw_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER redraw_limit,
  ADD COLUMN IF NOT EXISTS multi_draw_count TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER redraw_count,
  ADD COLUMN IF NOT EXISTS multi_draw_lock_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER multi_draw_count,
  ADD COLUMN IF NOT EXISTS multi_draw_winner_option_id INT UNSIGNED NULL AFTER multi_draw_lock_minutes,
  ADD COLUMN IF NOT EXISTS draw_mode ENUM('none', 'random', 'captains', 'manual') NOT NULL DEFAULT 'none' AFTER status,
  ADD COLUMN IF NOT EXISTS draw_started_at DATETIME NULL AFTER draw_mode,
  ADD COLUMN IF NOT EXISTS draw_completed_at DATETIME NULL AFTER draw_started_at,
  ADD COLUMN IF NOT EXISTS draw_audit_snapshot JSON NULL AFTER draw_completed_at,
  ADD COLUMN IF NOT EXISTS finalized_at DATETIME NULL AFTER draw_audit_snapshot,
  ADD COLUMN IF NOT EXISTS formation_edit_deadline DATETIME NULL AFTER finalized_at,
  ADD COLUMN IF NOT EXISTS public_token VARCHAR(64) NULL AFTER formation_edit_deadline,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER public_token,
  ADD COLUMN IF NOT EXISTS result_notes TEXT NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS round_robin_legs TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER result_notes,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE matches
  MODIFY max_diff DECIMAL(4,1) NOT NULL DEFAULT 0.7,
  MODIFY draw_mode ENUM('none', 'random', 'captains', 'manual') NOT NULL DEFAULT 'none';

ALTER TABLE match_teams
  ADD COLUMN IF NOT EXISTS captain_player_id INT UNSIGNED NULL AFTER team_name,
  ADD COLUMN IF NOT EXISTS formation_name VARCHAR(80) NULL AFTER total_skill,
  ADD COLUMN IF NOT EXISTS formation_data TEXT NULL AFTER formation_name,
  ADD COLUMN IF NOT EXISTS color_name VARCHAR(40) NULL AFTER formation_data,
  ADD COLUMN IF NOT EXISTS goals SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER color_name;

ALTER TABLE match_players
  MODIFY assigned_position ENUM('ARQ','DEF','LAT','MED','DEL') DEFAULT NULL;

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS lineup_order SMALLINT UNSIGNED NULL AFTER is_goalkeeper,
  ADD COLUMN IF NOT EXISTS formation_line_order TINYINT UNSIGNED NULL AFTER lineup_order,
  ADD COLUMN IF NOT EXISTS availability_status ENUM('convocado', 'confirmado', 'baja') NOT NULL DEFAULT 'convocado' AFTER formation_line_order;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS technique DECIMAL(3,1) NULL AFTER skill,
  ADD COLUMN IF NOT EXISTS rhythm DECIMAL(3,1) NULL AFTER technique,
  ADD COLUMN IF NOT EXISTS defense_physical DECIMAL(3,1) NULL AFTER rhythm,
  ADD COLUMN IF NOT EXISTS attack DECIMAL(3,1) NULL AFTER defense_physical,
  ADD COLUMN IF NOT EXISTS teamwork DECIMAL(3,1) NOT NULL DEFAULT 3.0 AFTER attack,
  ADD COLUMN IF NOT EXISTS mentality DECIMAL(3,1) NOT NULL DEFAULT 3.0 AFTER teamwork,
  ADD COLUMN IF NOT EXISTS regularity DECIMAL(3,1) NULL AFTER mentality,
  ADD COLUMN IF NOT EXISTS goalkeeper_skill DECIMAL(3,1) NULL AFTER regularity,
  ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255) NULL AFTER goalkeeper_skill;

CREATE TABLE IF NOT EXISTS match_awards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  award_code VARCHAR(40) NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_match_award (match_id, award_code),
  INDEX idx_awards_player (player_id, award_code),
  CONSTRAINT fk_match_awards_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_awards_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS captain_drafts (
  match_id INT UNSIGNED PRIMARY KEY,
  captain1_player_id INT UNSIGNED NOT NULL,
  captain2_player_id INT UNSIGNED NOT NULL,
  captain3_player_id INT UNSIGNED NULL,
  captain4_player_id INT UNSIGNED NULL,
  captain1_token VARCHAR(64) NOT NULL,
  captain2_token VARCHAR(64) NOT NULL,
  captain3_token VARCHAR(64) NULL,
  captain4_token VARCHAR(64) NULL,
  current_team TINYINT UNSIGNED NULL DEFAULT 1,
  status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  turn_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_captain_drafts_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain1
    FOREIGN KEY (captain1_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain2
    FOREIGN KEY (captain2_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain3
    FOREIGN KEY (captain3_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_drafts_captain4
    FOREIGN KEY (captain4_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE captain_drafts
  ADD COLUMN IF NOT EXISTS started_at DATETIME NULL AFTER status,
  ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL AFTER started_at,
  ADD COLUMN IF NOT EXISTS turn_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER completed_at,
  ADD COLUMN IF NOT EXISTS captain3_player_id INT UNSIGNED NULL AFTER captain2_player_id,
  ADD COLUMN IF NOT EXISTS captain4_player_id INT UNSIGNED NULL AFTER captain3_player_id,
  ADD COLUMN IF NOT EXISTS captain3_token VARCHAR(64) NULL AFTER captain2_token,
  ADD COLUMN IF NOT EXISTS captain4_token VARCHAR(64) NULL AFTER captain3_token;

CREATE TABLE IF NOT EXISTS captain_picks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  team_number TINYINT UNSIGNED NOT NULL,
  picked_by_player_id INT UNSIGNED NOT NULL,
  pick_order SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_captain_pick_player (match_id, player_id),
  UNIQUE KEY uniq_captain_pick_order (match_id, pick_order),
  INDEX idx_captain_pick_match_team (match_id, team_number),
  CONSTRAINT fk_captain_picks_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_captain_picks_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_captain_picks_picker
    FOREIGN KEY (picked_by_player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_draw_options (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  option_number TINYINT UNSIGNED NOT NULL,
  teams_json MEDIUMTEXT NOT NULL,
  total_diff DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  selected_at DATETIME NULL,
  UNIQUE KEY uniq_match_draw_option (match_id, option_number),
  INDEX idx_match_draw_option_match (match_id),
  CONSTRAINT fk_match_draw_options_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_round_robin_results (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  home_team_number TINYINT UNSIGNED NOT NULL,
  away_team_number TINYINT UNSIGNED NOT NULL,
  leg TINYINT UNSIGNED NOT NULL,
  home_goals SMALLINT UNSIGNED NULL,
  away_goals SMALLINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_round_robin_fixture (match_id, home_team_number, away_team_number, leg),
  INDEX idx_round_robin_match (match_id),
  CONSTRAINT fk_round_robin_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_matches_draw_mode ON matches (draw_mode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_public_token ON matches (public_token);
CREATE INDEX IF NOT EXISTS idx_match_teams_captain ON match_teams (captain_player_id);
CREATE INDEX IF NOT EXISTS idx_match_lineup ON match_players (match_id, team_number, assigned_position, lineup_order);
CREATE INDEX IF NOT EXISTS idx_match_availability ON match_players (match_id, availability_status);

-- Backfill seguro de valores derivados.
UPDATE matches m
LEFT JOIN captain_drafts d ON d.match_id = m.id
SET m.draw_mode = CASE
    WHEN d.match_id IS NOT NULL THEN 'captains'
    WHEN m.status IN ('sorteado', 'finalizado') THEN 'random'
    ELSE 'none'
  END
WHERE m.draw_mode = 'none';

UPDATE matches
SET draw_completed_at = updated_at
WHERE draw_completed_at IS NULL
  AND status IN ('sorteado', 'finalizado');

UPDATE matches
SET finalized_at = updated_at
WHERE finalized_at IS NULL
  AND status = 'finalizado';

UPDATE matches
SET formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
WHERE formation_edit_deadline IS NULL;

UPDATE match_teams mt
INNER JOIN captain_drafts d ON d.match_id = mt.match_id
SET mt.captain_player_id = CASE
    WHEN mt.team_number = 1 THEN d.captain1_player_id
    WHEN mt.team_number = 2 THEN d.captain2_player_id
    WHEN mt.team_number = 3 THEN d.captain3_player_id
    WHEN mt.team_number = 4 THEN d.captain4_player_id
    ELSE mt.captain_player_id
  END
WHERE mt.captain_player_id IS NULL;

UPDATE match_teams mt
LEFT JOIN (
  SELECT match_id, team_number, COALESCE(SUM(goals), 0) AS goals
  FROM match_players
  WHERE team_number IS NOT NULL
  GROUP BY match_id, team_number
) g ON g.match_id = mt.match_id AND g.team_number = mt.team_number
SET mt.goals = COALESCE(g.goals, 0);

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

INSERT IGNORE INTO app_settings (setting_key, setting_value)
VALUES
  ('position_stat_weights', '{"ARQ":{"goalkeeper_skill":0.42,"defense_physical":0.14,"rhythm":0.1,"technique":0.1,"teamwork":0.14,"mentality":0.1},"DEF":{"defense_physical":0.28,"rhythm":0.2,"technique":0.18,"teamwork":0.13,"mentality":0.13,"attack":0.08},"LAT":{"rhythm":0.24,"defense_physical":0.22,"technique":0.17,"teamwork":0.15,"attack":0.12,"mentality":0.1},"MED":{"technique":0.24,"rhythm":0.23,"teamwork":0.19,"mentality":0.13,"defense_physical":0.12,"attack":0.09},"DEL":{"attack":0.31,"rhythm":0.2,"technique":0.17,"teamwork":0.14,"mentality":0.1,"defense_physical":0.08}}');

-- Vinculacion de fotos incluidas en public_html/uploads/players/.
-- Si algun id no existe en hosting, ese UPDATE no afecta filas.
UPDATE players SET photo_path = 'uploads/players/player-1-a52c24b60792adf3.png' WHERE id = 1;
UPDATE players SET photo_path = 'uploads/players/player-2-a2cc26482d5bb135.png' WHERE id = 2;
UPDATE players SET photo_path = 'uploads/players/player-5-7d59a02f5882a75e.png' WHERE id = 5;
UPDATE players SET photo_path = 'uploads/players/player-6-c0c87cb9971098ec.png' WHERE id = 6;
UPDATE players SET photo_path = 'uploads/players/player-7-5819744c55597d91.png' WHERE id = 7;
UPDATE players SET photo_path = 'uploads/players/player-8-c063b231f729e90b.png' WHERE id = 8;
UPDATE players SET photo_path = 'uploads/players/player-10-86836ff1a55a64d3.png' WHERE id = 10;
UPDATE players SET photo_path = 'uploads/players/player-11-cb5aad66658062ca.png' WHERE id = 11;
UPDATE players SET photo_path = 'uploads/players/player-12-d779f7d12a9f25b2.png' WHERE id = 12;
UPDATE players SET photo_path = 'uploads/players/player-13-5e2bb8a8aecf1c3e.png' WHERE id = 13;
UPDATE players SET photo_path = 'uploads/players/player-14-7ced868a71da3574.png' WHERE id = 14;
UPDATE players SET photo_path = 'uploads/players/player-15-be2d5275c69ea87a.png' WHERE id = 15;
UPDATE players SET photo_path = 'uploads/players/player-17-d28fe883e00d9e28.png' WHERE id = 17;
UPDATE players SET photo_path = 'uploads/players/player-18-72f0eac4516654bc.png' WHERE id = 18;
UPDATE players SET photo_path = 'uploads/players/player-19-25006ca57e0eca8c.png' WHERE id = 19;
UPDATE players SET photo_path = 'uploads/players/player-22-c852e339dc842ab5.png' WHERE id = 22;
UPDATE players SET photo_path = 'uploads/players/player-24-aa991162398df52b.png' WHERE id = 24;
UPDATE players SET photo_path = 'uploads/players/player-30-234798d02cd7a738.png' WHERE id = 30;
UPDATE players SET photo_path = 'uploads/players/player-32-f633ec407a872c13.png' WHERE id = 32;
UPDATE players SET photo_path = 'uploads/players/player-38-6246664d7fa5f51a.png' WHERE id = 38;
UPDATE players SET photo_path = 'uploads/players/player-43-a08f689f7de72dd3.png' WHERE id = 43;
UPDATE players SET photo_path = 'uploads/players/player-44-9a0e4813e8797a13.png' WHERE id = 44;

COMMIT;

-- ============================================================
-- END sql\hostinger_update_20260601_schema_and_player_photos.sql
-- ============================================================


-- ============================================================
-- BEGIN sql\20260614_add_director_vote_manually_modified.sql
-- ============================================================

-- Migration: director player stat votes manual modification flag
-- Purpose: persist which player rows were explicitly saved by a director.
-- Existing rows stay as 0 by design, so players are not marked as modified until saved again.

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'director_player_stat_votes'
    AND COLUMN_NAME = 'manually_modified'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `director_player_stat_votes` ADD COLUMN `manually_modified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `comments`',
  'SELECT ''director_player_stat_votes.manually_modified already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- END sql\20260614_add_director_vote_manually_modified.sql
-- ============================================================

