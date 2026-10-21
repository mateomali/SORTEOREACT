<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/repository.php';
require_once __DIR__ . '/../lib/live_match_repository.php';
require_once __DIR__ . '/../lib/directivos.php';
ensure_control_schema();
ensure_live_match_schema();
ensure_directivos_schema();
$pdo = db();
$action = $argv[1] ?? '';
if ($action === 'create') {
    $count = (int) ($argv[2] ?? 3);
    if (!in_array($count, [3, 4], true)) throw new RuntimeException('Invalid team count');
    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO matches (title, match_date, status, num_teams, players_per_team, draw_mode, dynamic_fixture, teams_published_at, valuation_mode) VALUES ('Temporary live matches validation', NOW(), 'sorteado', ?, 2, 'manual', 1, NOW(), 'both')")->execute([$count]);
        $id = (int) $pdo->lastInsertId();
        $insertPlayer = $pdo->prepare('INSERT INTO players (name, positions, skill) VALUES (?, ?, 4)');
        $join = $pdo->prepare('INSERT INTO match_players (match_id, player_id, team_number, is_goalkeeper) VALUES (?, ?, ?, ?)');
        $insertTeam = $pdo->prepare('INSERT INTO match_teams (match_id, team_number, team_name, color_name) VALUES (?, ?, ?, ?)');
        foreach (['Verde', 'Blanco', 'Rojo', 'Negro'] as $i => $name) {
            if ($i >= $count) break;
            $team = $i + 1;
            $insertTeam->execute([$id, $team, 'Equipo ' . $name, ['VERDE', 'BLANCO', 'ROJO', 'NEGRO'][$i]]);
            foreach (['ARQ', 'DEL'] as $j => $position) {
                $insertPlayer->execute(['Temporary live player ' . $id . '-' . $team . '-' . $j, $position]);
                $join->execute([$id, $pdo->lastInsertId(), $team, $j === 0 ? 1 : 0]);
            }
        }
        $pdo->commit();
        echo json_encode(['id' => $id, 'teams' => repo_match_teams($id), 'players' => repo_match_participants($id)]);
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    exit;
}
$id = (int) ($argv[2] ?? 0);
$match = repo_match_by_id($id);
if (!$match || $match['title'] !== 'Temporary live matches validation') throw new RuntimeException('Refusing access to non-fixture match');
if ($action === 'legacy') {
    $pdo->prepare('UPDATE matches SET dynamic_fixture = 0 WHERE id = ?')->execute([$id]);
} elseif ($action === 'director-session') {
    $memberName = 'Temporary live director ' . $id;
    $pdo->prepare('INSERT INTO directive_members (name, password_hash) VALUES (?, ?)')->execute([$memberName, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]);
    $memberId = (int) $pdo->lastInsertId();
    $player = repo_match_participants($id)[0];
    session_write_close();
    session_id('livevalidation' . $id);
    session_start();
    $_SESSION = ['directivo_id' => $memberId, 'directivo_name' => $memberName, 'player_id' => (int) $player['id'], 'user_role' => 'directivo'];
    echo json_encode(['name' => session_name(), 'value' => session_id()]);
    session_write_close();
} elseif ($action === 'inspect') {
    echo json_encode(['match' => $match, 'session' => live_load_session($match), 'teams' => repo_match_teams($id), 'players' => repo_match_participants($id), 'awards' => repo_match_awards($id)]);
} elseif ($action === 'overtime') {
    $session = live_load_session($match);
    $index = count($session['state']['games']) - 1;
    $session['state']['games'][$index]['running_since'] = microtime(true) - 605;
    $pdo->prepare('UPDATE match_live_sessions SET revision = revision + 1, state_json = ? WHERE match_id = ?')->execute([json_encode($session['state']), $id]);
} elseif ($action === 'award-test') {
    $participant = repo_match_participants($id)[0];
    $allowed = array_map('intval', array_column(repo_match_participants($id), 'id'));
    $memberName = 'Temporary live evaluator ' . $id;
    $pdo->prepare('INSERT INTO directive_members (name, password_hash) VALUES (?, ?)')->execute([$memberName, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]);
    $voterId = (int) $pdo->lastInsertId();
    try {
        $value = $participant['name'] . ' (#' . $participant['id'] . ')';
        directive_save_vote($id, $voterId, [], ['player_of_match' => $value, 'lyrical' => $value], $allowed, 'awards');
        $votes = directive_member_award_votes($id, $voterId);
        if (count($votes) !== 2) throw new RuntimeException('Repeated player awards were lost');
        $resolved = directive_resolve_awards($id, $allowed);
        if ($resolved['player_of_match'] !== (int) $participant['id'] || $resolved['lyrical'] !== (int) $participant['id']) throw new RuntimeException('Award publication lost repeated player');
        repo_save_match_awards($id, ['player_of_match' => (int) $participant['id'], 'lyrical' => (int) $participant['id']], $allowed);
        if (count(repo_match_awards($id)) !== 2) throw new RuntimeException('Final awards lost repeated player');
        echo 'Repeated award votes and published awards OK';
    } finally {
        $pdo->prepare('DELETE FROM directive_members WHERE id = ? AND name = ?')->execute([$voterId, $memberName]);
    }
} elseif ($action === 'delete-date-only') {
    // Creation test shares the original fixture's roster; remove only its own date.
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM match_teams WHERE match_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM match_players WHERE match_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
} elseif ($action === 'delete') {
    $players = repo_match_participants($id);
    foreach ($players as $p) if (!str_starts_with($p['name'], 'Temporary live player ' . $id . '-')) throw new RuntimeException('Non-fixture player');
    $ownedPlayers = $pdo->prepare('SELECT id, name FROM players WHERE name LIKE ?');
    $ownedPlayers->execute(['Temporary live player ' . $id . '-%']);
    $players = $ownedPlayers->fetchAll();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM match_teams WHERE match_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM match_players WHERE match_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM directive_members WHERE name = ?')->execute(['Temporary live director ' . $id]);
        $pdo->prepare('DELETE FROM directive_members WHERE name LIKE ?')->execute(['Temporary podium evaluator ' . $id . '-%']);
        $pdo->prepare('DELETE FROM site_users WHERE username = ?')->execute(['Temporary podium profile ' . $id]);
        foreach ($players as $p) $pdo->prepare('DELETE FROM players WHERE id = ?')->execute([$p['id']]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
} else throw new RuntimeException('Unknown action');
