SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'match_players'
    AND COLUMN_NAME = 'availability_percent'
);

SET @migration_sql := IF(
  @column_exists = 0,
  'ALTER TABLE match_players ADD COLUMN availability_percent TINYINT UNSIGNED NOT NULL DEFAULT 100 AFTER availability_status',
  'SELECT ''match_players.availability_percent already exists'' AS status'
);

PREPARE stmt FROM @migration_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
