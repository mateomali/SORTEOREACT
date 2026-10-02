-- Migration: modo de valoraciones por fecha (puntajes, premios o ambos)
-- Purpose: permitir configurar en cada fecha si se cargan puntajes, solo premios o ambos.
-- Existing rows stay as 'both' on purpose, so previous fechas keep behaving exactly as before.

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'matches'
    AND COLUMN_NAME = 'valuation_mode'
);

SET @migration_sql := IF(
  @column_exists = 0,
  'ALTER TABLE `matches` ADD COLUMN `valuation_mode` ENUM(''both'', ''ratings'', ''awards'') NOT NULL DEFAULT ''both'' AFTER `round_robin_legs`',
  'SELECT ''matches.valuation_mode already exists'' AS status'
);

PREPARE stmt FROM @migration_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
