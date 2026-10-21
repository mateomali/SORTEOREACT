<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/public_round_robin.php';

function expect_standing(mixed $actual, mixed $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ': ' . json_encode([$actual, $expected]));
    }
}

$teams = [['team_number' => 1], ['team_number' => 2], ['team_number' => 3]];
$match = ['status' => 'finalizado', 'round_robin_legs' => 2];
$results = [
    ['home_team_number' => 1, 'away_team_number' => 2, 'leg' => 1, 'home_goals' => 0, 'away_goals' => 1],
    ['home_team_number' => 1, 'away_team_number' => 3, 'leg' => 1, 'home_goals' => 6, 'away_goals' => 0],
    ['home_team_number' => 2, 'away_team_number' => 3, 'leg' => 1, 'home_goals' => 1, 'away_goals' => 0],
];
$summary = public_round_robin_summary($match, $teams, $results);
expect_standing($summary['winner']['team_number'], 2, 'Winner must use points, not total goals');
expect_standing($summary['winner']['points'], 6, 'Three points per win');
expect_standing($summary['complete'], true, 'A closed live date is final even without the generated return fixtures');
expect_standing($summary['table'][1]['gf'], 6, 'All stored games count regardless of generated home/away order');
expect_standing($summary['table'][3]['lost'], 2, 'Losses');

$results[] = ['home_team_number' => 1, 'away_team_number' => 2, 'leg' => 3, 'home_goals' => 2, 'away_goals' => 0];
$summary = public_round_robin_summary($match, $teams, $results);
expect_standing($summary['played'], 4, 'Dynamic repeated encounters count beyond the configured legs');
expect_standing($summary['winner']['team_number'], 1, 'Goal difference breaks equal points');
expect_standing($summary['table'][1]['played'], 3, 'Per-team games played');

$draws = array_map(static fn(array $row): array => array_replace($row, ['home_goals' => 0, 'away_goals' => 0]), array_slice($results, 0, 3));
$summary = public_round_robin_summary($match, $teams, $draws);
expect_standing($summary['table'][1]['points'], 2, 'One point per draw');
expect_standing($summary['table'][1]['drawn'], 2, 'Draw counts');
expect_standing(array_keys($summary['table']), [1, 2, 3], 'Exact ties use the same stable team order as Finalizar fecha');

$cycle = [
    ['home_team_number' => 1, 'away_team_number' => 2, 'leg' => 1, 'home_goals' => 2, 'away_goals' => 1],
    ['home_team_number' => 2, 'away_team_number' => 3, 'leg' => 1, 'home_goals' => 3, 'away_goals' => 2],
    ['home_team_number' => 3, 'away_team_number' => 1, 'leg' => 1, 'home_goals' => 1, 'away_goals' => 0],
];
expect_standing(public_round_robin_summary($match, $teams, $cycle)['winner']['team_number'], 2, 'Goals scored break equal points and goal difference');

$match['status'] = 'sorteado';
expect_standing(public_round_robin_summary($match, $teams, $results)['winner'], null, 'Do not declare a final winner before closing the date');
$match['status'] = 'finalizado';
expect_standing(public_round_robin_summary($match, $teams, [])['winner'], null, 'Do not invent a winner without results');
echo "Public round-robin standings: OK\n";
