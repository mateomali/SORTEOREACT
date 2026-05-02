-- Script para phpMyAdmin / MySQL
-- Base: u552541920_futbol
-- Usuario: u552541920_goodfellas
-- Clave: Goodfellas2026

CREATE DATABASE IF NOT EXISTS `u552541920_futbol`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `u552541920_futbol`;

CREATE TABLE IF NOT EXISTS players (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  positions VARCHAR(20) NOT NULL,
  pace ENUM('rapido', 'lento') NOT NULL DEFAULT 'rapido',
  skill DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_players_name (name),
  INDEX idx_players_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NULL,
  match_date DATETIME NOT NULL,
  num_teams TINYINT UNSIGNED NOT NULL DEFAULT 2,
  players_per_team TINYINT UNSIGNED NOT NULL DEFAULT 9,
  max_diff DECIMAL(4,1) NOT NULL DEFAULT 0.5,
  status ENUM('programado', 'sorteado', 'finalizado') NOT NULL DEFAULT 'programado',
  draw_mode ENUM('none', 'random', 'captains') NOT NULL DEFAULT 'none',
  draw_started_at DATETIME NULL,
  draw_completed_at DATETIME NULL,
  finalized_at DATETIME NULL,
  formation_edit_deadline DATETIME NULL,
  public_token VARCHAR(64) NULL,
  notes TEXT NULL,
  result_notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_matches_date (match_date),
  INDEX idx_matches_status (status),
  INDEX idx_matches_draw_mode (draw_mode),
  UNIQUE KEY idx_matches_public_token (public_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_players (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  team_number TINYINT UNSIGNED NULL,
  assigned_position ENUM('ARQ', 'DEF', 'MED', 'DEL') NULL,
  is_goalkeeper TINYINT(1) NOT NULL DEFAULT 0,
  lineup_order SMALLINT UNSIGNED NULL,
  formation_line_order TINYINT UNSIGNED NULL,
  availability_status ENUM('convocado', 'confirmado', 'baja') NOT NULL DEFAULT 'convocado',
  goals SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  rating DECIMAL(3,1) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_match_player (match_id, player_id),
  INDEX idx_match_team (match_id, team_number),
  INDEX idx_match_lineup (match_id, team_number, assigned_position, lineup_order),
  INDEX idx_match_availability (match_id, availability_status),
  INDEX idx_player_stats (player_id, goals, rating),
  CONSTRAINT fk_match_players_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_match_players_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_teams (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_id INT UNSIGNED NOT NULL,
  team_number TINYINT UNSIGNED NOT NULL,
  team_name VARCHAR(80) NULL,
  captain_player_id INT UNSIGNED NULL,
  total_skill DECIMAL(5,1) NOT NULL DEFAULT 0.0,
  formation_name VARCHAR(80) NULL,
  formation_data TEXT NULL,
  color_name VARCHAR(40) NULL,
  goals SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_match_team (match_id, team_number),
  INDEX idx_match_teams_captain (captain_player_id),
  CONSTRAINT fk_match_teams_match
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  captain1_token VARCHAR(64) NOT NULL,
  captain2_token VARCHAR(64) NOT NULL,
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

-- Si tu hosting permite privilegios, puedes ejecutar tambien:
-- CREATE USER IF NOT EXISTS 'u552541920_goodfellas'@'localhost' IDENTIFIED BY 'Goodfellas2026';
-- GRANT ALL PRIVILEGES ON `u552541920_futbol`.* TO 'u552541920_goodfellas'@'localhost';
-- FLUSH PRIVILEGES;
