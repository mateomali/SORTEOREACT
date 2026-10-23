<?php
declare(strict_types=1);

function normalize_round_robin_legs(mixed $value): int
{
    return (int) $value === 1 ? 1 : 2;
}

function round_robin_fixtures(array $teams, int $legs = 2): array
{
    $teamNumbers = array_map(static fn(array $team): int => (int) $team['team_number'], $teams);
    sort($teamNumbers);
    $legs = normalize_round_robin_legs($legs);

    $firstLeg = [];
    $secondLeg = [];
    $rotation = $teamNumbers;
    if (count($rotation) % 2 === 1) {
        $rotation[] = 0;
    }

    $roundCount = max(0, count($rotation) - 1);
    $half = (int) (count($rotation) / 2);
    for ($round = 0; $round < $roundCount; $round++) {
        for ($i = 0; $i < $half; $i++) {
            $a = (int) $rotation[$i];
            $b = (int) $rotation[count($rotation) - 1 - $i];
            if ($a === 0 || $b === 0) {
                continue;
            }

            if ($round % 2 === 1) {
                [$a, $b] = [$b, $a];
            }
            $firstLeg[] = ['home' => $a, 'away' => $b, 'leg' => 1];
            $secondLeg[] = ['home' => $b, 'away' => $a, 'leg' => 2];
        }

        $fixed = array_shift($rotation);
        $last = array_pop($rotation);
        array_unshift($rotation, $fixed);
        array_splice($rotation, 1, 0, [$last]);
    }

    return $legs === 1 ? $firstLeg : array_merge($firstLeg, $secondLeg);
}

function round_robin_result_key(int $homeTeam, int $awayTeam, int $leg): string
{
    return $homeTeam . '-' . $awayTeam . '-' . $leg;
}


function calculate_round_robin_table(array $teams, array $fixtures, array $scores): array
{
    $table = [];
    $validTeams = [];
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        $validTeams[$teamNumber] = true;
        $table[$teamNumber] = [
            'team_number' => $teamNumber,
            'points' => 0,
            'played' => 0,
            'won' => 0,
            'drawn' => 0,
            'lost' => 0,
            'gf' => 0,
            'ga' => 0,
            'gd' => 0,
        ];
    }

    foreach ($fixtures as $fixture) {
        $home = (int) $fixture['home'];
        $away = (int) $fixture['away'];
        $leg = (int) $fixture['leg'];
        if (!isset($validTeams[$home], $validTeams[$away])) {
            continue;
        }

        $score = $scores[round_robin_result_key($home, $away, $leg)] ?? null;
        if (!$score || $score['home'] === null || $score['away'] === null) {
            continue;
        }

        $homeGoals = (int) $score['home'];
        $awayGoals = (int) $score['away'];
        $table[$home]['played']++;
        $table[$away]['played']++;
        $table[$home]['gf'] += $homeGoals;
        $table[$home]['ga'] += $awayGoals;
        $table[$away]['gf'] += $awayGoals;
        $table[$away]['ga'] += $homeGoals;

        if ($homeGoals > $awayGoals) {
            $table[$home]['points'] += 3;
            $table[$home]['won']++;
            $table[$away]['lost']++;
        } elseif ($homeGoals < $awayGoals) {
            $table[$away]['points'] += 3;
            $table[$away]['won']++;
            $table[$home]['lost']++;
        } else {
            $table[$home]['points']++;
            $table[$away]['points']++;
            $table[$home]['drawn']++;
            $table[$away]['drawn']++;
        }
    }

    foreach ($table as &$row) {
        $row['gd'] = $row['gf'] - $row['ga'];
    }
    unset($row);

    uasort($table, static function (array $a, array $b): int {
        return ($b['points'] <=> $a['points'])
            ?: ($b['gd'] <=> $a['gd'])
            ?: ($b['gf'] <=> $a['gf'])
            ?: ($a['team_number'] <=> $b['team_number']);
    });

    return $table;
}

