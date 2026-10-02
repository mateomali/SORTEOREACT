-- Migration: registro de votos enviados por la junta directiva
-- Purpose: saber quien ya voto una fecha, incluso en fechas donde solo se votan premios
--          (sin votos de puntaje no se podia detectar el voto enviado).
-- Existing rows stay untouched; matches already voted keep counting by their rating votes.

CREATE TABLE IF NOT EXISTS `match_director_vote_submissions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `match_id` INT UNSIGNED NOT NULL,
  `voter_id` INT UNSIGNED NOT NULL,
  `valuation_mode` ENUM('both', 'ratings', 'awards') NOT NULL DEFAULT 'both',
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_director_vote_submission` (`match_id`, `voter_id`),
  INDEX `idx_director_vote_submission_match` (`match_id`),
  CONSTRAINT `fk_director_vote_submission_match` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_director_vote_submission_voter` FOREIGN KEY (`voter_id`) REFERENCES `directive_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
