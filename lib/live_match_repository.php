<?php
declare(strict_types=1);
require_once __DIR__ . '/live_matches.php';
require_once __DIR__ . '/schema.php';

// Read-only discovery: preparing the first pairing does not start a tournament.
function live_follow_matches(): array
{
    static $matches = null;
    if ($matches !== null) return $matches;
    $matches = [];
    if (!schema_table_exists(db(), 'match_live_sessions')) return $matches;
    $rows = db()->query("SELECT m.id, m.title, m.num_teams, s.state_json
        FROM matches m JOIN match_live_sessions s ON s.match_id = m.id
        WHERE m.status = 'sorteado' AND m.dynamic_fixture = 1
          AND m.num_teams IN (3, 4) AND m.teams_published_at IS NOT NULL
        ORDER BY m.match_date DESC, m.id DESC")->fetchAll();
    foreach ($rows as $row) {
        $state = json_decode($row['state_json'], true);
        if (!is_array($state) || !empty($state['closed'])) continue;
        $started = array_filter($state['games'] ?? [], static fn(array $game): bool =>
            ($game['running_since'] ?? null) !== null || ($game['elapsed'] ?? 0) > 0 || ($game['status'] ?? '') === 'finished');
        if (!$started) continue;
        unset($row['state_json']);
        $matches[] = $row;
    }
    return $matches;
}

function ensure_live_match_schema(): void
{
    static $done = false;
    if ($done) return;
    $pdo = db();
    schema_add_column($pdo, 'matches', 'dynamic_fixture', 'dynamic_fixture TINYINT(1) NOT NULL DEFAULT 0');
    schema_add_column($pdo, 'matches', 'game_duration_minutes', 'game_duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 10');
    $pdo->exec("CREATE TABLE IF NOT EXISTS match_live_sessions (
        match_id INT UNSIGNED PRIMARY KEY,
        revision INT UNSIGNED NOT NULL DEFAULT 0,
        state_json MEDIUMTEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_live_session_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $done = true;
}

function live_initial_state(array $match): array
{
    return ['duration' => ((int) $match['num_teams'] === 2 ? 3600 : (int) $match['game_duration_minutes'] * 60), 'games' => [], 'closed' => false];
}

function live_load_session(array $match): array
{
    $stmt = db()->prepare('SELECT revision, state_json FROM match_live_sessions WHERE match_id = ?');
    $stmt->execute([(int) $match['id']]);
    $row = $stmt->fetch();
    $state = $row ? json_decode($row['state_json'], true, 512, JSON_THROW_ON_ERROR) : live_initial_state($match);
    if (($match['status'] ?? '') === 'finalizado') {
        $state['closed'] = true;
        if (!$row) {
            $results = db()->prepare('SELECT * FROM match_round_robin_results WHERE match_id = ? AND home_goals IS NOT NULL AND away_goals IS NOT NULL ORDER BY leg, id');
            $results->execute([(int) $match['id']]);
            foreach ($results->fetchAll() as $result) {
                $game = live_new_game([(int) $result['home_team_number'], (int) $result['away_team_number']], $state['duration'], 'Resultado guardado antes de usar el registro por partido.');
                $game['status'] = 'finished';
                $game['first_goal_known'] = false;
                foreach (['home', 'away'] as $side) {
                    $goals = (int) $result[$side . '_goals'];
                    if ($goals < 0 || $goals > 100) throw new RuntimeException('El resultado guardado supera el límite de 100 goles por equipo y partido.');
                    for ($i = 0; $i < $goals; $i++) $game['goals'][] = ['team' => (int) $result[$side . '_team_number'], 'player' => null, 'own' => false, 'at' => null];
                }
                $state['games'][] = $game;
            }
            $scorers = [];
            foreach (repo_match_participants((int) $match['id']) as $player) {
                if ($player['team_number'] !== null) $scorers[(int) $player['id']] = (int) ($player['goals'] ?? 0);
            }
            if ($state['games']) {
                // Preserve aggregate authors without inventing which game they scored in.
                $state['pending_scorers'] = $scorers;
            } elseif (!empty($match['result_saved_at']) || array_sum($scorers) > 0) {
                $totals = [];
                foreach (repo_match_teams((int) $match['id']) as $team) $totals[(int) $team['team_number']] = (int) ($team['goals'] ?? 0);
                $state['summary'] = ['team_goals' => $totals, 'player_goals' => $scorers];
            }
        }
    }
    return ['revision' => $row ? (int) $row['revision'] : 0, 'state' => $state];
}

function live_store_session(int $matchId, array $state, int $revision): void
{
    db()->prepare('INSERT INTO match_live_sessions (match_id, revision, state_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE revision = VALUES(revision), state_json = VALUES(state_json)')
        ->execute([$matchId, $revision, json_encode($state, JSON_THROW_ON_ERROR)]);
}

function live_sync_totals(int $matchId, array $state, array $teams, array $participants): void
{
    $pdo = db();
    $teamGoals = array_fill_keys($teams, 0);
    $playerGoals = array_fill_keys(array_column($participants, 'id'), 0);
    // Rebuild projections in the same transaction as the authoritative event log.
    $pdo->prepare('DELETE FROM match_round_robin_results WHERE match_id = ?')->execute([$matchId]);
    $insert = $pdo->prepare('INSERT INTO match_round_robin_results (match_id, home_team_number, away_team_number, leg, home_goals, away_goals) VALUES (?, ?, ?, ?, ?, ?)');
    $encounters = [];
    foreach ($state['games'] as $game) {
        if ($game['status'] !== 'finished') continue;
        $pair = $game['teams'];
        sort($pair, SORT_NUMERIC);
        $key = live_pair_key($pair);
        $leg = ($encounters[$key] ?? 0) + 1;
        $encounters[$key] = $leg;
        $score = live_score($game);
        $insert->execute([$matchId, $pair[0], $pair[1], $leg, $score[$pair[0]], $score[$pair[1]]]);
        foreach ($score as $t => $count) $teamGoals[$t] += $count;
        foreach ($game['goals'] as $goal) {
            if ($goal['player'] !== null && !$goal['own']) $playerGoals[$goal['player']]++;
        }
    }
    foreach ($state['pending_scorers'] ?? [] as $player => $goals) {
        if (array_key_exists($player, $playerGoals)) $playerGoals[$player] += (int) $goals;
    }
    // Aggregate entry owns date totals; recorded games still own the detailed fixture.
    if (isset($state['summary'])) {
        foreach ($teamGoals as $team => $_) $teamGoals[$team] = (int) ($state['summary']['team_goals'][$team] ?? 0);
        foreach ($playerGoals as $player => $_) $playerGoals[$player] = (int) ($state['summary']['player_goals'][$player] ?? 0);
    }
    $stmt = $pdo->prepare('UPDATE match_teams SET goals = ?, updated_at = NOW() WHERE match_id = ? AND team_number = ?');
    foreach ($teamGoals as $t => $count) $stmt->execute([$count, $matchId, $t]);
    $stmt = $pdo->prepare('UPDATE match_players SET goals = ? WHERE match_id = ? AND player_id = ?');
    foreach ($playerGoals as $p => $count) $stmt->execute([$count, $matchId, $p]);
}

// Serialize automatic expiry with director actions using the same parent lock.
function live_refresh_session(array $match, array $teams, array $participants): array
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT * FROM matches WHERE id = ? FOR UPDATE');
        $lock->execute([(int) $match['id']]);
        $match = $lock->fetch();
        $session = live_load_session($match);
        $state = live_expire($session['state']);
        if ($state !== $session['state']) {
            $session = ['state' => $state, 'revision' => $session['revision'] + 1];
            live_store_session((int) $match['id'], $state, $session['revision']);
            live_sync_totals((int) $match['id'], $state, $teams, $participants);
            $pdo->prepare('UPDATE matches SET result_saved_at = NOW() WHERE id = ?')->execute([(int) $match['id']]);
        }
        $pdo->commit();
        return $session;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
