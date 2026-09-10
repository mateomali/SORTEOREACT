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
