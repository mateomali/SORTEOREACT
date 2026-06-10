<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function schema_column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name'
    );
    $stmt->execute(['table_name' => $table, 'column_name' => $column]);
    return (int) $stmt->fetchColumn() > 0;
}

function schema_index_exists(PDO $pdo, string $table, string $index): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND INDEX_NAME = :index_name'
    );
    $stmt->execute(['table_name' => $table, 'index_name' => $index]);
    return (int) $stmt->fetchColumn() > 0;
}

function schema_column_type(PDO $pdo, string $table, string $column): string
{
    $stmt = $pdo->prepare(
        'SELECT COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name
         LIMIT 1'
    );
    $stmt->execute(['table_name' => $table, 'column_name' => $column]);
    return (string) ($stmt->fetchColumn() ?: '');
}

function schema_column_default(PDO $pdo, string $table, string $column): ?string
{
    $stmt = $pdo->prepare(
        'SELECT COLUMN_DEFAULT
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name
         LIMIT 1'
    );
    $stmt->execute(['table_name' => $table, 'column_name' => $column]);
    $value = $stmt->fetchColumn();
    return $value === false || $value === null ? null : (string) $value;
}

function schema_table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name'
    );
    $stmt->execute(['table_name' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function ensure_control_tables(PDO $pdo): array
{
    $changes = [];

    if (!schema_table_exists($pdo, 'match_awards')) {
        $pdo->exec(
            "CREATE TABLE match_awards (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $changes[] = 'table match_awards';
    }

    if (!schema_table_exists($pdo, 'captain_drafts')) {
        $pdo->exec(
            "CREATE TABLE captain_drafts (
                match_id INT UNSIGNED PRIMARY KEY,
                captain1_player_id INT UNSIGNED NOT NULL,
                captain2_player_id INT UNSIGNED NOT NULL,
                captain3_player_id INT UNSIGNED NULL,
                captain4_player_id INT UNSIGNED NULL,
                captain1_token VARCHAR(64) NOT NULL,
                captain2_token VARCHAR(64) NOT NULL,
                captain3_token VARCHAR(64) NULL,
                captain4_token VARCHAR(64) NULL,
                captain1_color_name VARCHAR(40) NULL,
                captain2_color_name VARCHAR(40) NULL,
                captain3_color_name VARCHAR(40) NULL,
                captain4_color_name VARCHAR(40) NULL,
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $changes[] = 'table captain_drafts';
    }

    if (!schema_table_exists($pdo, 'captain_picks')) {
        $pdo->exec(
            "CREATE TABLE captain_picks (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $changes[] = 'table captain_picks';
    }

    if (!schema_table_exists($pdo, 'match_round_robin_results')) {
        $pdo->exec(
            "CREATE TABLE match_round_robin_results (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $changes[] = 'table match_round_robin_results';
    }

    return $changes;
}

function schema_add_column(PDO $pdo, string $table, string $column, string $definition): bool
{
    if (schema_column_exists($pdo, $table, $column)) {
        return false;
    }
    $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN {$definition}");
    return true;
}

function schema_add_index(PDO $pdo, string $table, string $index, string $definition): bool
{
    if (schema_index_exists($pdo, $table, $index)) {
        return false;
    }
    $pdo->exec("ALTER TABLE `{$table}` ADD {$definition}");
    return true;
}

function schema_ensure_draw_mode_manual(PDO $pdo): bool
{
    if (!schema_column_exists($pdo, 'matches', 'draw_mode')) {
        return false;
    }
    $type = schema_column_type($pdo, 'matches', 'draw_mode');
    if (str_contains($type, "'manual'")) {
        return false;
    }
    $pdo->exec("ALTER TABLE matches MODIFY draw_mode ENUM('none', 'random', 'captains', 'manual') NOT NULL DEFAULT 'none'");
    return true;
}

function schema_ensure_player_photo_position_defaults(PDO $pdo): bool
{
    if (!schema_column_exists($pdo, 'players', 'photo_position_y')) {
        return false;
    }

    if (schema_column_default($pdo, 'players', 'photo_position_y') === '50') {
        return false;
    }

    $pdo->exec('ALTER TABLE players MODIFY photo_position_y TINYINT UNSIGNED NOT NULL DEFAULT 50');
    return true;
}

function ensure_control_schema(): array
{
    $pdo = db();
    $changes = ensure_control_tables($pdo);

    $columns = [
        ['matches', 'title', 'title VARCHAR(120) NULL AFTER id'],
        ['matches', 'num_teams', 'num_teams TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER match_date'],
        ['matches', 'players_per_team', 'players_per_team TINYINT UNSIGNED NOT NULL DEFAULT 9 AFTER num_teams'],
        ['matches', 'max_diff', 'max_diff DECIMAL(4,1) NOT NULL DEFAULT 0.7 AFTER players_per_team'],
        ['matches', 'allow_redraw', 'allow_redraw TINYINT(1) NOT NULL DEFAULT 1 AFTER max_diff'],
        ['matches', 'redraw_limit', 'redraw_limit TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER allow_redraw'],
        ['matches', 'redraw_count', 'redraw_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER redraw_limit'],
        ['matches', 'multi_draw_count', 'multi_draw_count TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER redraw_count'],
        ['matches', 'multi_draw_lock_minutes', 'multi_draw_lock_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER multi_draw_count'],
        ['matches', 'multi_draw_winner_option_id', 'multi_draw_winner_option_id INT UNSIGNED NULL AFTER multi_draw_lock_minutes'],
        ['matches', 'notes', 'notes TEXT NULL AFTER public_token'],
        ['matches', 'created_at', 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'],
        ['matches', 'updated_at', 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
        ['matches', 'draw_mode', "draw_mode ENUM('none', 'random', 'captains', 'manual') NOT NULL DEFAULT 'none' AFTER status"],
        ['matches', 'draw_started_at', 'draw_started_at DATETIME NULL AFTER draw_mode'],
        ['matches', 'draw_completed_at', 'draw_completed_at DATETIME NULL AFTER draw_started_at'],
        ['matches', 'draw_audit_snapshot', 'draw_audit_snapshot JSON NULL AFTER draw_completed_at'],
        ['matches', 'finalized_at', 'finalized_at DATETIME NULL AFTER draw_audit_snapshot'],
        ['matches', 'result_saved_at', 'result_saved_at DATETIME NULL AFTER finalized_at'],
        ['matches', 'formation_edit_deadline', 'formation_edit_deadline DATETIME NULL AFTER finalized_at'],
        ['matches', 'public_token', 'public_token VARCHAR(64) NULL AFTER formation_edit_deadline'],
        ['matches', 'result_notes', 'result_notes TEXT NULL AFTER notes'],
        ['matches', 'round_robin_legs', 'round_robin_legs TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER result_notes'],
        ['match_teams', 'captain_player_id', 'captain_player_id INT UNSIGNED NULL AFTER team_name'],
        ['match_teams', 'formation_name', 'formation_name VARCHAR(80) NULL AFTER total_skill'],
        ['match_teams', 'formation_data', 'formation_data TEXT NULL AFTER formation_name'],
        ['match_teams', 'color_name', 'color_name VARCHAR(40) NULL AFTER formation_data'],
        ['match_teams', 'goals', 'goals SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER color_name'],
        ['match_players', 'lineup_order', 'lineup_order SMALLINT UNSIGNED NULL AFTER is_goalkeeper'],
        ['match_players', 'formation_line_order', 'formation_line_order TINYINT UNSIGNED NULL AFTER lineup_order'],
        ['match_players', 'availability_status', "availability_status ENUM('convocado', 'confirmado', 'baja') NOT NULL DEFAULT 'convocado' AFTER formation_line_order"],
        ['captain_drafts', 'started_at', 'started_at DATETIME NULL AFTER status'],
        ['captain_drafts', 'completed_at', 'completed_at DATETIME NULL AFTER started_at'],
        ['captain_drafts', 'turn_version', 'turn_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER completed_at'],
        ['captain_drafts', 'captain3_player_id', 'captain3_player_id INT UNSIGNED NULL AFTER captain2_player_id'],
        ['captain_drafts', 'captain4_player_id', 'captain4_player_id INT UNSIGNED NULL AFTER captain3_player_id'],
        ['captain_drafts', 'captain3_token', 'captain3_token VARCHAR(64) NULL AFTER captain2_token'],
        ['captain_drafts', 'captain4_token', 'captain4_token VARCHAR(64) NULL AFTER captain3_token'],
        ['captain_drafts', 'captain1_color_name', 'captain1_color_name VARCHAR(40) NULL AFTER captain4_token'],
        ['captain_drafts', 'captain2_color_name', 'captain2_color_name VARCHAR(40) NULL AFTER captain1_color_name'],
        ['captain_drafts', 'captain3_color_name', 'captain3_color_name VARCHAR(40) NULL AFTER captain2_color_name'],
        ['captain_drafts', 'captain4_color_name', 'captain4_color_name VARCHAR(40) NULL AFTER captain3_color_name'],
        ['match_awards', 'notes', 'notes VARCHAR(255) NULL AFTER player_id'],
        ['players', 'technique', 'technique DECIMAL(3,1) NULL AFTER skill'],
        ['players', 'rhythm', 'rhythm DECIMAL(3,1) NULL AFTER technique'],
        ['players', 'defense_physical', 'defense_physical DECIMAL(3,1) NULL AFTER rhythm'],
        ['players', 'attack', 'attack DECIMAL(3,1) NULL AFTER defense_physical'],
        ['players', 'teamwork', 'teamwork DECIMAL(3,1) NOT NULL DEFAULT 3.0 AFTER attack'],
        ['players', 'mentality', 'mentality DECIMAL(3,1) NOT NULL DEFAULT 3.0 AFTER teamwork'],
        ['players', 'regularity', 'regularity DECIMAL(3,1) NULL AFTER mentality'],
        ['players', 'goalkeeper_skill', 'goalkeeper_skill DECIMAL(3,1) NULL AFTER regularity'],
        ['players', 'photo_path', 'photo_path VARCHAR(255) NULL AFTER goalkeeper_skill'],
        ['players', 'photo_position_x', 'photo_position_x TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER photo_path'],
        ['players', 'photo_position_y', 'photo_position_y TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER photo_position_x'],
        ['players', 'photo_zoom', 'photo_zoom TINYINT UNSIGNED NOT NULL DEFAULT 100 AFTER photo_position_y'],
    ];

    foreach ($columns as [$table, $column, $definition]) {
        if (schema_add_column($pdo, $table, $column, $definition)) {
            $changes[] = "column {$table}.{$column}";
        }
    }

    if (schema_ensure_draw_mode_manual($pdo)) {
        $changes[] = 'enum matches.draw_mode manual';
    }

    if (schema_ensure_player_photo_position_defaults($pdo)) {
        $changes[] = 'default players.photo_position_y';
    }

    $indexes = [
        ['matches', 'idx_matches_draw_mode', 'INDEX idx_matches_draw_mode (draw_mode)'],
        ['matches', 'idx_matches_public_token', 'UNIQUE KEY idx_matches_public_token (public_token)'],
        ['match_teams', 'idx_match_teams_captain', 'INDEX idx_match_teams_captain (captain_player_id)'],
        ['match_players', 'idx_match_lineup', 'INDEX idx_match_lineup (match_id, team_number, assigned_position, lineup_order)'],
        ['match_players', 'idx_match_availability', 'INDEX idx_match_availability (match_id, availability_status)'],
    ];

    foreach ($indexes as [$table, $index, $definition]) {
        if (schema_add_index($pdo, $table, $index, $definition)) {
            $changes[] = "index {$table}.{$index}";
        }
    }

    backfill_control_schema($pdo);
    return $changes;
}

function backfill_control_schema(PDO $pdo): void
{
    $pdo->exec(
        "UPDATE matches m
         LEFT JOIN captain_drafts d ON d.match_id = m.id
         SET m.draw_mode = CASE
             WHEN d.match_id IS NOT NULL THEN 'captains'
             WHEN m.status IN ('sorteado', 'finalizado') THEN 'random'
             ELSE 'none'
           END
         WHERE m.draw_mode = 'none'"
    );

    $pdo->exec(
        "UPDATE matches
         SET draw_completed_at = updated_at
         WHERE draw_completed_at IS NULL
           AND status IN ('sorteado', 'finalizado')"
    );

    $pdo->exec(
        "UPDATE matches
         SET finalized_at = updated_at
         WHERE finalized_at IS NULL
           AND status = 'finalizado'"
    );

    if (schema_column_exists($pdo, 'matches', 'result_saved_at')) {
        $pdo->exec(
            "UPDATE matches m
             INNER JOIN (
               SELECT match_id, COALESCE(SUM(goals), 0) AS total_goals
               FROM match_teams
               GROUP BY match_id
             ) mt ON mt.match_id = m.id
             SET m.result_saved_at = COALESCE(m.finalized_at, m.updated_at)
             WHERE m.result_saved_at IS NULL
               AND m.status = 'finalizado'
               AND mt.total_goals > 0"
        );
    }

    $pdo->exec(
        "UPDATE matches
         SET formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
         WHERE formation_edit_deadline IS NULL"
    );

    $pdo->exec(
        "UPDATE match_teams mt
         INNER JOIN captain_drafts d ON d.match_id = mt.match_id
         SET mt.captain_player_id = CASE
             WHEN mt.team_number = 1 THEN d.captain1_player_id
             WHEN mt.team_number = 2 THEN d.captain2_player_id
             ELSE mt.captain_player_id
           END
         WHERE mt.captain_player_id IS NULL"
    );

    $pdo->exec(
        "UPDATE match_teams mt
         INNER JOIN matches m ON m.id = mt.match_id
         LEFT JOIN (
           SELECT match_id, team_number, COALESCE(SUM(goals), 0) AS goals
           FROM match_players
           WHERE team_number IS NOT NULL
           GROUP BY match_id, team_number
         ) g ON g.match_id = mt.match_id AND g.team_number = mt.team_number
         SET mt.goals = COALESCE(g.goals, 0)"
         . (schema_column_exists($pdo, 'matches', 'result_saved_at') ? " WHERE m.result_saved_at IS NULL" : '')
    );

    $pdo->exec(
        "UPDATE match_teams mt
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
         SET mt.formation_name = COALESCE(mt.formation_name, f.formation_name)"
    );

    if (schema_column_exists($pdo, 'players', 'technique')) {
        $pdo->exec(
            "UPDATE players
             SET
               technique = COALESCE(technique, skill),
               rhythm = COALESCE(rhythm, CASE WHEN pace = 'lento' THEN 2.0 ELSE 4.0 END),
               defense_physical = COALESCE(defense_physical, 3.0),
               attack = COALESCE(attack, skill),
               teamwork = COALESCE(teamwork, skill),
               mentality = COALESCE(mentality, 3.0),
               regularity = COALESCE(regularity, 3.5),
               goalkeeper_skill = COALESCE(goalkeeper_skill, CASE WHEN positions = 'ARQ' OR positions LIKE 'ARQ/%' OR positions LIKE '%/ARQ%' THEN skill ELSE NULL END)"
        );

        $pdo->exec(
            "UPDATE players
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
               )),
                 1
               ),
               pace = CASE WHEN rhythm <= 3.0 THEN 'lento' ELSE 'rapido' END
             WHERE technique IS NOT NULL
               AND rhythm IS NOT NULL
               AND defense_physical IS NOT NULL
               AND attack IS NOT NULL
               AND teamwork IS NOT NULL
               AND mentality IS NOT NULL
               AND regularity IS NOT NULL"
        );
    }
}
