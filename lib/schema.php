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

function ensure_control_schema(): array
{
    $pdo = db();
    $changes = [];

    $columns = [
        ['matches', 'draw_mode', "draw_mode ENUM('none', 'random', 'captains') NOT NULL DEFAULT 'none' AFTER status"],
        ['matches', 'draw_started_at', 'draw_started_at DATETIME NULL AFTER draw_mode'],
        ['matches', 'draw_completed_at', 'draw_completed_at DATETIME NULL AFTER draw_started_at'],
        ['matches', 'finalized_at', 'finalized_at DATETIME NULL AFTER draw_completed_at'],
        ['matches', 'formation_edit_deadline', 'formation_edit_deadline DATETIME NULL AFTER finalized_at'],
        ['matches', 'public_token', 'public_token VARCHAR(64) NULL AFTER formation_edit_deadline'],
        ['matches', 'result_notes', 'result_notes TEXT NULL AFTER notes'],
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
        ['match_awards', 'notes', 'notes VARCHAR(255) NULL AFTER player_id'],
    ];

    foreach ($columns as [$table, $column, $definition]) {
        if (schema_add_column($pdo, $table, $column, $definition)) {
            $changes[] = "column {$table}.{$column}";
        }
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
         LEFT JOIN (
           SELECT match_id, team_number, COALESCE(SUM(goals), 0) AS goals
           FROM match_players
           WHERE team_number IS NOT NULL
           GROUP BY match_id, team_number
         ) g ON g.match_id = mt.match_id AND g.team_number = mt.team_number
         SET mt.goals = COALESCE(g.goals, 0)"
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
               SUM(CASE WHEN assigned_position = 'MED' THEN 1 ELSE 0 END), '-',
               SUM(CASE WHEN assigned_position = 'DEL' THEN 1 ELSE 0 END)
             ) AS formation_name
           FROM match_players
           WHERE team_number IS NOT NULL
           GROUP BY match_id, team_number
         ) f ON f.match_id = mt.match_id AND f.team_number = mt.team_number
         SET mt.formation_name = COALESCE(mt.formation_name, f.formation_name)"
    );
}
