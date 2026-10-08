<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/director_proposals.php';
ensure_director_proposals_schema();
$pdo = db();
if (($argv[1] ?? '') === 'link') {
    $data = json_decode((string) ($argv[2] ?? ''), true, 512, JSON_THROW_ON_ERROR);
    $index = (int) ($argv[3] ?? 2);
    $match = repo_match_by_id((int) $data['matchId']);
    if (!$match || $match['title'] !== $data['prefix']) throw new RuntimeException('Fixture invalido.');
    $playerId = (int) $data['teams'][0]['players'][$index === 0 ? 1 : 0]['id'];
    $pdo->prepare('UPDATE site_users SET player_id = ? WHERE id = ?')->execute([$playerId, $data['users'][$index]]);
    session_write_close();
    session_id($data['sessions'][$index]); session_start();
    $_SESSION['player_id'] = $playerId;
    session_write_close();
    exit;
}
if (in_array($argv[1] ?? '', ['partial', 'complete'], true)) {
    $data = json_decode((string) ($argv[2] ?? ''), true, 512, JSON_THROW_ON_ERROR);
    $match = repo_match_by_id((int) $data['matchId']);
    if (!$match || $match['title'] !== $data['prefix']) throw new RuntimeException('Fixture invalido.');
    if ($argv[1] === 'partial') {
        $last = end($data['teams']); $player = end($last['players']);
        $pdo->prepare('DELETE FROM match_players WHERE match_id = ? AND player_id = ?')->execute([$match['id'], $player['id']]);
    } else {
        foreach ($data['teams'] as $team) foreach ($team['players'] as $player) $pdo->prepare('INSERT IGNORE INTO match_players (match_id, player_id) VALUES (?, ?)')->execute([$match['id'], $player['id']]);
    }
    exit;
}
if (($argv[1] ?? '') === 'activate') {
    $data = json_decode((string) ($argv[2] ?? ''), true, 512, JSON_THROW_ON_ERROR);
    $match = repo_match_by_id((int) $data['matchId']);
    if (!$match || $match['title'] !== $data['prefix']) throw new RuntimeException('Fixture invalido.');
    $minutes = intdiv((int) $match['director_vote_start_minutes'] + (int) $match['multi_draw_lock_minutes'], 2);
    $pdo->prepare('UPDATE matches SET match_date = ? WHERE id = ?')->execute([date('Y-m-d H:i:s', time() + $minutes * 60), $match['id']]);
    exit;
}
if (($argv[1] ?? '') === 'cleanup') {
    $data = json_decode((string) ($argv[2] ?? ''), true, 512, JSON_THROW_ON_ERROR);
    $match = repo_match_by_id((int) $data['matchId']);
    if (!$match || $match['title'] !== $data['prefix']) throw new RuntimeException('Fixture invalido.');
    $pdo->prepare('DELETE FROM match_teams WHERE match_id = ?')->execute([$data['matchId']]);
    $pdo->prepare('DELETE FROM match_players WHERE match_id = ?')->execute([$data['matchId']]);
    $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$data['matchId']]);
    foreach ($data['users'] as $uid) $pdo->prepare('DELETE FROM site_users WHERE id = ? AND username LIKE ?')->execute([$uid, $data['prefix'] . '%']);
    session_write_close();
    foreach ($data['sessions'] as $sid) { session_id($sid); session_start(); session_destroy(); }
    exit;
}
$prefix = 'browser_proposal_' . bin2hex(random_bytes(6));
$players = array_slice(repo_all_players(true), 0, 12);
if (count($players) !== 12) throw new RuntimeException('Se necesitan 12 jugadores.');
$users = []; $sessions = [];
session_write_close();
foreach (['directivo', 'directivo', 'usuario', 'admin'] as $index => $role) {
    $pdo->prepare('INSERT INTO site_users (username, password_hash, role) VALUES (?, ?, ?)')->execute([$prefix . '_' . $index, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), $role]);
    $uid = (int) $pdo->lastInsertId(); $users[] = $uid;
    $sid = bin2hex(random_bytes(16)); $sessions[] = $sid;
    session_id($sid); session_start();
    $_SESSION = ['user_id' => $uid, 'user_role' => $role, 'is_admin' => $role === 'admin', 'username' => $prefix . '_' . $index];
    session_write_close();
}
$pdo->prepare('INSERT INTO matches (title, match_date, num_teams, players_per_team, status, draw_mode) VALUES (?, ?, 2, 6, "programado", "none")')->execute([$prefix, date('Y-m-d H:i:s', time() + 10 * 86400)]);
$mid = (int) $pdo->lastInsertId();
foreach ($players as $player) $pdo->prepare('INSERT INTO match_players (match_id, player_id) VALUES (?, ?)')->execute([$mid, $player['id']]);
$teams = [];
foreach (array_chunk($players, 6) as $index => $roster) {
    $rows = [];
    foreach ($roster as $order => $player) $rows[] = ['id' => (int) $player['id'], 'assigned_position' => ['ARQ', 'DEF', 'DEF', 'MED', 'DEL', 'DEL'][$order], 'is_substitute' => $order === 5, 'availability_percent' => 100];
    $teams[] = ['color_name' => $index ? 'AZUL' : 'ROSA', 'players' => $rows];
}
echo json_encode(['prefix' => $prefix, 'matchId' => $mid, 'users' => $users, 'sessions' => $sessions, 'teams' => $teams], JSON_THROW_ON_ERROR);
