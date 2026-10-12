<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/repository.php';
require_once __DIR__ . '/../lib/admin_config.php';
ensure_admin_config_schema();
ensure_control_schema();
$pdo = db();
$action = $argv[1] ?? '';
if ($action === 'list') {
    echo json_encode($pdo->query("SELECT id FROM matches WHERE title = 'Temporary pots validation'")->fetchAll(PDO::FETCH_COLUMN));
} elseif ($action === 'snapshot') {
    $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
    $stmt->execute(['draw_pots_template']);
    $value = $stmt->fetchColumn();
    echo json_encode(['value' => $value === false ? null : $value]);
} elseif ($action === 'restore') {
    $snapshot = json_decode(base64_decode($argv[2] ?? '', true) ?: '', true);
    if (!is_array($snapshot) || !array_key_exists('value', $snapshot)) throw new RuntimeException('Invalid snapshot');
    if ($snapshot['value'] === null) {
        $pdo->prepare('DELETE FROM app_settings WHERE setting_key = ?')->execute(['draw_pots_template']);
    } else {
        admin_config_set_default('draw_pots_template', (string) $snapshot['value']);
    }
} elseif ($action === 'create') {
    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO matches (title, match_date, status, num_teams, players_per_team, draw_mode, allow_redraw, redraw_limit) VALUES ('Temporary pots validation', DATE_ADD(NOW(), INTERVAL 7 DAY), 'programado', 2, 5, 'random', 1, 3)")->execute();
        $id = (int) $pdo->lastInsertId();
        $insert = $pdo->prepare('INSERT INTO players (name, positions, skill, technique, pass_vision, rhythm, stamina, defense_physical, attack, teamwork, mentality, regularity, goalkeeper_skill) VALUES (?, ?, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4)');
        $join = $pdo->prepare('INSERT INTO match_players (match_id, player_id, availability_percent) VALUES (?, ?, 100)');
        foreach (['ARQ','ARQ','DEF','DEF','DEF','DEF','MED','MED','DEL','DEL'] as $index => $position) {
            $insert->execute(['Temporary pot player ' . $id . '-' . ($index + 1), $position]);
            $join->execute([$id, (int) $pdo->lastInsertId()]);
        }
        $pdo->commit();
        echo $id;
    } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
} elseif ($action === 'inspect' || $action === 'delete') {
    $id = (int) ($argv[2] ?? 0);
    $match = repo_match_by_id($id);
    if (!$match || $match['title'] !== 'Temporary pots validation') throw new RuntimeException('Refusing access to non-fixture match');
    if ($action === 'inspect') {
        echo json_encode(['match' => $match, 'teams' => repo_match_teams($id), 'players' => repo_match_participants($id)]);
    } else {
        $players = repo_match_participants($id);
        foreach ($players as $player) {
            if (!str_starts_with($player['name'], 'Temporary pot player ' . $id . '-')) throw new RuntimeException('Refusing to delete non-fixture player');
        }
        $pdo->beginTransaction();
        try {
            foreach (['match_players','match_teams','captain_picks','captain_drafts'] as $table) $pdo->prepare("DELETE FROM $table WHERE match_id = ?")->execute([$id]);
            $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$id]);
            foreach ($players as $player) $pdo->prepare('DELETE FROM players WHERE id = ?')->execute([$player['id']]);
            $pdo->commit();
        } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
    }
} else { throw new RuntimeException('Unknown action'); }
