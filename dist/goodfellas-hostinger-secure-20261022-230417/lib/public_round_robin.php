<?php
declare(strict_types=1);
require_once __DIR__ . '/round_robin_standings.php';

function public_round_robin_summary(array $match, array $teams, array $results): array
{
    // Live dates can close with a dynamic number of games and canonical home/away
    // order. Their saved results, rather than a generated fixture, are authoritative.
    $fixtures = [];
    $validTeams = array_fill_keys(array_map('intval', array_column($teams, 'team_number')), true);
    $scores = [];
    foreach ($results as $result) {
        $home = (int) $result['home_team_number'];
        $away = (int) $result['away_team_number'];
        $leg = (int) $result['leg'];
        if ($home === $away || !isset($validTeams[$home], $validTeams[$away])) {
            continue;
        }
        $key = round_robin_result_key($home, $away, $leg);
        $fixtures[$key] = ['home' => $home, 'away' => $away, 'leg' => $leg];
        $scores[$key] = ['home' => $result['home_goals'], 'away' => $result['away_goals']];
    }
    $played = 0;
    foreach ($fixtures as $fixture) {
        $score = $scores[round_robin_result_key($fixture['home'], $fixture['away'], $fixture['leg'])] ?? null;
        if ($score && $score['home'] !== null && $score['away'] !== null) {
            $played++;
        }
    }
    $table = calculate_round_robin_table($teams, $fixtures, $scores);
    $complete = count($teams) > 2 && $played > 0 && ($match['status'] ?? '') === 'finalizado';
    return ['table' => $table, 'played' => $played, 'complete' => $complete,
        'winner' => $complete && ($match['status'] ?? '') === 'finalizado' ? (array_values($table)[0] ?? null) : null];
}
