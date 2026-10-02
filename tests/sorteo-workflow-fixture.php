<?php
// Isolated integration fixture. Never modifies existing matches or players.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/repository.php';
require_once __DIR__ . '/../lib/schema.php';
ensure_control_schema();
$action = $argv[1] ?? '';
$pdo = db();
if ($action === 'list') { echo json_encode($pdo->query("SELECT id FROM matches WHERE title = 'Temporary UI workflow validation'")->fetchAll(PDO::FETCH_COLUMN)); exit; }
if ($action === 'create') {
    $players = repo_match_participants(204);
    if (count($players) < 10 || count($players) % 2) throw new RuntimeException('Source fixture must have an even roster.');
    $pdo->prepare("INSERT INTO matches (title, match_date, status, num_teams, players_per_team, draw_mode, allow_redraw, redraw_limit) VALUES ('Temporary UI workflow validation', DATE_ADD(NOW(), INTERVAL 7 DAY), 'programado', 2, ?, 'random', 1, 3)")->execute([intdiv(count($players), 2)]);
    $id = (int) $pdo->lastInsertId();
    $insert = $pdo->prepare('INSERT INTO match_players (match_id, player_id, availability_percent) VALUES (?, ?, ?)');
    foreach ($players as $player) $insert->execute([$id, $player['id'], $player['availability_percent']]);
    echo $id;
    exit;
}
$id = (int) ($argv[2] ?? 0);
$match = repo_match_by_id($id);
if (!$match || $match['title'] !== 'Temporary UI workflow validation') throw new RuntimeException('Refusing access to a non-fixture match.');
if ($action === 'inspect') {
    echo json_encode(['match' => $match, 'teams' => repo_match_teams($id), 'players' => repo_match_participants($id)]);
} elseif ($action === 'delete') {
    $pdo->beginTransaction();
    try {
        foreach (['match_players', 'match_teams', 'captain_picks', 'captain_drafts'] as $table) $pdo->prepare("DELETE FROM $table WHERE match_id = ?")->execute([$id]);
        $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
} else { throw new RuntimeException('Unknown fixture action.'); }
