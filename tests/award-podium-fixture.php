<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/directivos.php';
ensure_directivos_schema();
$pdo = db();
$action = $argv[1] ?? '';
$id = (int) ($argv[2] ?? 0);
$match = repo_match_by_id($id);
if (!$match || $match['title'] !== 'Temporary live matches validation') throw new RuntimeException('Non-fixture match');
function podium_check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function podium_reject(callable $call, string $message): void { try { $call(); } catch (RuntimeException $e) { return; } throw new RuntimeException($message); }
if ($action === 'setup') {
    $pdo->prepare("UPDATE matches SET status = 'finalizado', finalized_at = NOW(), result_saved_at = NOW(), valuation_mode = 'awards' WHERE id = ?")->execute([$id]);
    $outsiders = [];
    foreach ([1, 0] as $active) {
        $name = 'Temporary live player ' . $id . '-outside-' . $active;
        $pdo->prepare('INSERT INTO players (name, positions, active) VALUES (?, ?, ?)')->execute([$name, 'DEL', $active]);
        $outsiders[] = ['id' => (int) $pdo->lastInsertId(), 'name' => $name];
    }
    $members = [];
    for ($i = 0; $i < 3; $i++) {
        $pdo->prepare('INSERT INTO directive_members (name, password_hash) VALUES (?, ?)')->execute(['Temporary podium evaluator ' . $id . '-' . $i, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]);
        $members[] = (int) $pdo->lastInsertId();
    }
    ensure_auth_schema();
    $username = 'Temporary podium profile ' . $id;
    $pdo->prepare("INSERT INTO site_users (username, password_hash, role, player_id, active) VALUES (?, ?, 'jugador', ?, 1)")->execute([$username, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), $outsiders[1]['id']]);
    $userId = (int) $pdo->lastInsertId();
    session_write_close();
    session_id('podioprofile' . $id);
    session_start();
    $_SESSION = ['user_id' => $userId, 'user_role' => 'jugador', 'username' => $username, 'player_id' => $outsiders[1]['id']];
    $profileCookie = ['name' => session_name(), 'value' => session_id()];
    session_write_close();
    echo json_encode(['outsiders' => $outsiders, 'members' => $members, 'profileCookie' => $profileCookie]);
} elseif ($action === 'rules') {
    $pdo->prepare('DELETE FROM match_director_award_votes WHERE match_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM match_director_vote_submissions WHERE match_id = ?')->execute([$id]);
    $players = repo_match_participants($id);
    $ids = array_map('intval', array_column($players, 'id'));
    [$a, $b, $c] = $ids;
    $stmt = $pdo->prepare('SELECT id FROM directive_members WHERE name LIKE ? ORDER BY id');
    $stmt->execute(['Temporary podium evaluator ' . $id . '-%']);
    $members = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    $stmt = $pdo->prepare('SELECT id FROM players WHERE name LIKE ? ORDER BY id');
    $stmt->execute(['Temporary live player ' . $id . '-outside-%']);
    [$outActive, $outInactive] = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    $v = static fn(int $pid): string => 'Player (#' . $pid . ')';
    directive_save_vote($id, $members[0], [], ['masterful_pass' => [$v($a), $v($b), $v($c)], 'wall' => [$v($a)], 'goodfellas' => [$v($outActive), $v($outInactive)], 'player_of_match' => $v($a)], $ids, 'awards');
    directive_save_vote($id, $members[1], [], ['masterful_pass' => [$v($b), $v($c), $v($a)], 'wall' => [$v($a), $v($b)], 'goodfellas' => [$v($outInactive), $v($outActive)], 'player_of_match' => $v($a)], $ids, 'awards');
    $resolved = directive_resolve_awards($id, $ids);
    podium_check($resolved['masterful_pass'] === [$b, $a, $c], '3/2/1 weighted podium incorrect');
    podium_check($resolved['wall'] === [$a, $b], 'Two-place podium incorrect');
    podium_check($resolved['player_of_match'] === $a, 'Single recipient changed');
    podium_check(count($resolved['goodfellas']) === 2 && in_array($outInactive, $resolved['goodfellas'], true), 'Nonparticipant inactive Goodfellas excluded');
    $before = directive_member_award_votes($id, $members[0]);
    podium_reject(fn() => directive_save_vote($id, $members[0], [], ['wall' => [$v($a), $v($a)]], $ids, 'awards'), 'Duplicate podium accepted');
    podium_reject(fn() => directive_save_vote($id, $members[0], [], ['player_of_match' => [$v($a), $v($b)]], $ids, 'awards'), 'Multiple winners for single award accepted');
    podium_reject(fn() => directive_save_vote($id, $members[0], [], ['wall' => $v($outActive)], $ids, 'awards'), 'Nonparticipant in match-only award accepted');
    podium_reject(fn() => directive_save_vote($id, $members[0], [], ['wall' => [$v($a), '', $v($b)]], $ids, 'awards'), 'Gaps in podium accepted');
    podium_check(directive_member_award_votes($id, $members[0]) === $before, 'Rejected vote changed previous ballot');
    // Seven points beats six, even when the latter has more first-place votes.
    directive_save_vote($id, $members[0], [], ['wall' => [$v($a), $v($b)]], $ids, 'awards');
    directive_save_vote($id, $members[1], [], ['wall' => [$v($a), $v($b)]], $ids, 'awards');
    directive_save_vote($id, $members[2], [], ['wall' => [$v($b)]], $ids, 'awards');
    podium_check(directive_resolve_awards($id, $ids)['wall'] === [$b, $a], 'Weighted result incorrect: 7 beats 6');
    directive_save_vote($id, $members[2], [], ['wall' => [$v($b), $v($c), $v($a)]], $ids, 'awards');
    $pdo->prepare('UPDATE match_players SET goals = 10 WHERE match_id = ? AND player_id = ?')->execute([$id, $b]);
    podium_check(directive_resolve_awards($id, $ids)['wall'] === [$a, $b, $c], 'Tied points must prioritize first places before goals');
    // Restore a complete example and publish every position to the existing awards table.
    directive_save_vote($id, $members[0], [], ['masterful_pass' => [$v($a), $v($b), $v($c)], 'goodfellas' => [$v($outActive), $v($outInactive)], 'player_of_match' => $v($a)], $ids, 'awards');
    directive_save_vote($id, $members[1], [], ['masterful_pass' => [$v($b), $v($c), $v($a)], 'goodfellas' => [$v($outInactive)], 'player_of_match' => $v($a)], $ids, 'awards');
    directive_save_vote($id, $members[2], [], [], $ids, 'awards');
    podium_check(directive_publish_match_results(repo_match_by_id($id), $players, 'admin', true), 'Publication failed');
    $awards = repo_match_awards($id);
    podium_check(array_map('intval', array_column($awards['masterful_pass']['podium'], 'player_id')) === [$b, $a, $c], 'Published podium lost order');
    podium_check(count($awards['goodfellas']['podium']) === 2, 'Published Goodfellas lost nonparticipants');
    $pdo->beginTransaction();
    try {
        repo_save_match_awards($id, ['masterful_pass' => [$a], 'goodfellas' => [$outInactive]], $ids);
        podium_check(count(repo_match_awards($id)['masterful_pass']['podium']) === 1, 'Shrinking podium retained old positions');
        podium_reject(fn() => repo_save_match_awards($id, ['masterful_pass' => [$a, $a]], $ids), 'Invalid admin podium accepted');
    } finally { $pdo->rollBack(); }
    echo 'OK: weighted podiums, optional positions, single awards, Goodfellas outsiders, atomic rejection, publication and shrinking podium.';
} else throw new RuntimeException('Unknown action');
