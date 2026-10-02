<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/repository.php';
require_once __DIR__ . '/../lib/schema.php';
require_once __DIR__ . '/../lib/formation_view.php';
ensure_control_schema();

// Load the real persistence functions without executing the page controller.
$wanted = ['finish_shirt_options', 'finish_default_team_shirt', 'finish_normalize_shirt', 'finish_player_position', 'finish_formation_name_from_counts', 'finish_save_match_formations'];
$tokens = token_get_all(file_get_contents(__DIR__ . '/../finalizar_partido.php'));
foreach ($tokens as $i => $token) {
    if (!is_array($token) || $token[0] !== T_FUNCTION) continue;
    $j = $i + 1;
    while (isset($tokens[$j]) && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
    if (!is_array($tokens[$j]) || !in_array($tokens[$j][1], $wanted, true)) continue;
    $code = ''; $depth = 0; $started = false;
    for ($k = $i; isset($tokens[$k]); $k++) {
        $t = $tokens[$k];
        $code .= is_array($t) ? $t[1] : $t;
        if ($t === '{') { $depth++; $started = true; }
        if ($t === '}') $depth--;
        if ($started && $depth === 0) break;
    }
    eval($code);
}
function check(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
}
$pdo = db();
$players = $pdo->query('SELECT * FROM players ORDER BY id LIMIT 12')->fetchAll();
check(count($players) === 12, 'Fixture requires twelve existing players');
$pdo->exec("INSERT INTO matches (title, match_date, status, num_teams, players_per_team) VALUES ('Temporary bench persistence test', NOW(), 'sorteado', 2, 6)");
$mid = (int) $pdo->lastInsertId();
try {
    $insert = $pdo->prepare('INSERT INTO match_players (match_id, player_id, team_number, assigned_position) VALUES (?, ?, ?, ?)');
    $positions = ['ARQ', 'DEF', 'DEF', 'MED', 'DEL', 'DEL'];
    foreach ($players as $index => $player) $insert->execute([$mid, $player['id'], intdiv($index, 6) + 1, $positions[$index % 6]]);
    $insertTeam = $pdo->prepare('INSERT INTO match_teams (match_id, team_number, team_name, total_skill) VALUES (?, ?, ?, 0)');
    foreach ([1, 2] as $number) $insertTeam->execute([$mid, $number, 'Equipo ' . $number]);
    $participants = repo_match_participants($mid);
    $teams = repo_match_teams($mid);
    $reserveId = (int) $players[5]['id'];
    finish_save_match_formations($mid, $participants, $teams, [1 => 'ROSA', 2 => 'AZUL'], [], [], [$reserveId => 1]);
    $saved = repo_match_participants($mid);
    $reserve = array_values(array_filter($saved, fn($p) => (int) $p['id'] === $reserveId))[0];
    check((int) $reserve['is_substitute'] === 1 && (int) $reserve['team_number'] === 1, 'Reserve must persist with its team');
    $grouped = repo_grouped_team_players($mid);
    check(count($grouped[1]['SUP']) === 1 && count($grouped[1]['DEL']) === 1, 'Reserve must not appear on pitch');
    check(repo_team_totals($mid)[1]['players'] === 5, 'Reserve excluded from starter totals');
    $html = formation_view_render_pitch([['team_name' => 'Equipo 1', 'players' => array_filter($saved, fn($p) => (int) $p['team_number'] === 1)]]);
    check(str_contains($html, 'Banco de suplentes') && str_contains($html, htmlspecialchars($reserve['name'], ENT_QUOTES, 'UTF-8')), 'Public formation includes bench');
    finish_save_match_formations($mid, $saved, $teams, [], [], [], [$reserveId => 0]);
    check(empty(repo_grouped_team_players($mid)[1]['SUP']), 'Returning reserve persists');
    try {
        finish_save_match_formations($mid, repo_match_participants($mid), $teams, [], [], [], array_fill_keys(array_column($players, 'id'), 1));
        throw new RuntimeException('Empty pitch was accepted');
    } catch (RuntimeException $e) {
        check(str_contains($e->getMessage(), 'arquero'), 'Unexpected empty-pitch error');
    }
    echo "PASS: bench save/reload, starter totals, public display, return and empty-pitch validation\n";
} finally {
    $pdo->prepare('DELETE FROM match_players WHERE match_id = ?')->execute([$mid]);
    $pdo->prepare('DELETE FROM match_teams WHERE match_id = ?')->execute([$mid]);
    $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$mid]);
}
