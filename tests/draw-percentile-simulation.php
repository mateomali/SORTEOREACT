<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/repository.php';
require_once __DIR__ . '/../lib/sorteo.php';

function simulation_plain_teams(array $decoratedTeams): array
{
    return array_map(static fn(array $team): array => $team['players'], $decoratedTeams);
}

function simulation_player_names(array $team, array $bandIds): array
{
    $names = [];
    foreach ($team as $player) {
        if (isset($bandIds[(int) $player['id']])) {
            $names[] = (string) $player['name'] . ' (' . number_format(player_overall_rating($player), 1, '.', '') . ')';
        }
    }
    return $names;
}

function simulation_team_total(array $team): float
{
    return array_sum(array_map('player_overall_rating', $team));
}

function simulation_run_match(int $matchId, int $runs = 4): array
{
    $match = repo_match_by_id($matchId);
    if (!$match) {
        throw new RuntimeException('Fecha no encontrada: ' . $matchId);
    }

    $players = repo_match_participants_basic($matchId);
    $numTeams = max(2, min(4, (int) ($match['num_teams'] ?? 2)));
    if (!$players || count($players) % $numTeams !== 0) {
        throw new RuntimeException('Fecha ' . $matchId . ': convocados no divisibles por equipos.');
    }

    $bands = draw_player_band_ids($players);
    $maxDiff = max(0.5, (float) ($match['max_diff'] ?? 0.5));
    $attemptDiffs = array_values(array_unique([$maxDiff, 2.5, 3.0, 4.0, 5.0, 6.0]));
    sort($attemptDiffs);

    $rows = [];
    $failures = 0;
    for ($run = 1; $run <= $runs; $run++) {
        mt_srand(1000 + ($matchId * 100) + $run);
        $teams = null;
        $usedDiff = null;
        foreach ($attemptDiffs as $candidateDiff) {
            $teams = generate_valid_teams($players, $numTeams, $candidateDiff, 2500);
            if ($teams !== null) {
                $usedDiff = $candidateDiff;
                break;
            }
        }

        if ($teams === null) {
            $failures++;
            continue;
        }

        $plainTeams = simulation_plain_teams($teams);
        $totals = array_map('simulation_team_total', $plainTeams);
        $lowCounts = draw_team_band_counts($plainTeams, $bands['low']);
        $highCounts = draw_team_band_counts($plainTeams, $bands['high']);
        $rows[] = [
            'run' => $run,
            'used_diff' => $usedDiff,
            'score_spread' => max($totals) - min($totals),
            'low_spread' => draw_count_spread($lowCounts),
            'high_spread' => draw_count_spread($highCounts),
            'totals' => $totals,
            'low_counts' => $lowCounts,
            'high_counts' => $highCounts,
            'low_names' => array_map(static fn(array $team): array => simulation_player_names($team, $bands['low']), $plainTeams),
            'high_names' => array_map(static fn(array $team): array => simulation_player_names($team, $bands['high']), $plainTeams),
        ];
    }

    return [
        'match' => $match,
        'players' => $players,
        'num_teams' => $numTeams,
        'band_size_low' => count($bands['low']),
        'band_size_high' => count($bands['high']),
        'rows' => $rows,
        'failures' => $failures,
    ];
}

$matchIds = array_slice(array_map('intval', array_filter(array_slice($argv, 1))), 0, 20);
if (!$matchIds) {
    $stmt = db()->query(
        'SELECT m.id
         FROM matches m
         INNER JOIN match_players mp ON mp.match_id = m.id
         GROUP BY m.id, m.num_teams
         HAVING COUNT(mp.player_id) >= m.num_teams * 5
            AND MOD(COUNT(mp.player_id), m.num_teams) = 0
         ORDER BY m.id DESC
         LIMIT 5'
    );
    $matchIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

foreach ($matchIds as $matchId) {
    $result = simulation_run_match($matchId);
    $match = $result['match'];
    $rows = $result['rows'];
    $badLow = array_filter($rows, static fn(array $row): bool => $row['low_spread'] > 1);
    $badHigh = array_filter($rows, static fn(array $row): bool => $row['high_spread'] > 1);
    $scoreSpreads = array_column($rows, 'score_spread');

    echo PHP_EOL;
    echo 'Fecha #' . (int) $match['id'] . ' | equipos=' . $result['num_teams'] . ' | convocados=' . count($result['players']) .
        ' | percentil bajo=' . $result['band_size_low'] . ' | percentil top=' . $result['band_size_high'] . PHP_EOL;
    if (!$rows) {
        echo '  Sin sorteos validos. Fallas=' . $result['failures'] . PHP_EOL;
        continue;
    }

    echo '  Simulaciones=' . count($rows) .
        ' | fallas=' . $result['failures'] .
        ' | concentracion bajos=' . count($badLow) .
        ' | concentracion top=' . count($badHigh) .
        ' | diff total min/prom/max=' .
        number_format(min($scoreSpreads), 1, '.', '') . '/' .
        number_format(array_sum($scoreSpreads) / count($scoreSpreads), 1, '.', '') . '/' .
        number_format(max($scoreSpreads), 1, '.', '') . PHP_EOL;

    foreach (array_slice($rows, 0, 3) as $row) {
        echo '  Run ' . $row['run'] .
            ' | maxDiff=' . number_format((float) $row['used_diff'], 1, '.', '') .
            ' | totals=' . implode('/', array_map(static fn(float $v): string => number_format($v, 1, '.', ''), $row['totals'])) .
            ' | bajos=' . implode('/', $row['low_counts']) .
            ' | top=' . implode('/', $row['high_counts']) . PHP_EOL;
        foreach ($row['low_names'] as $teamIndex => $names) {
            echo '    Equipo ' . ($teamIndex + 1) . ' bajos: ' . ($names ? implode(', ', $names) : '-') . PHP_EOL;
        }
        foreach ($row['high_names'] as $teamIndex => $names) {
            echo '    Equipo ' . ($teamIndex + 1) . ' top: ' . ($names ? implode(', ', $names) : '-') . PHP_EOL;
        }
    }
}
