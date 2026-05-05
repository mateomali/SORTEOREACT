<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function player_order(array $player): int
{
    $order = ['ARQ' => 1, 'DEF' => 2, 'MED' => 3, 'DEL' => 4];
    $positions = parse_positions_csv($player['positions'] ?? '');
    $values = array_map(static fn(string $p): int => $order[$p] ?? 99, $positions);
    return $values ? min($values) : 99;
}

function ordered_player_positions(array $player): array
{
    $positions = parse_positions_csv($player['positions'] ?? '');
    return $positions ?: ['MED'];
}

function is_pure_goalkeeper(array $player): bool
{
    $positions = ordered_player_positions($player);
    return count($positions) === 1 && $positions[0] === 'ARQ';
}

function is_emergency_goalkeeper(array $player): bool
{
    return !empty($player['emergency_goalkeeper']);
}

function prepare_emergency_goalkeepers(array $players, int $numTeams): array
{
    $goalkeepers = array_values(array_filter($players, static fn(array $p): bool => in_array('ARQ', ordered_player_positions($p), true)));
    $missing = max(0, $numTeams - count($goalkeepers));
    if ($missing === 0) {
        return $players;
    }

    $candidates = array_values(array_filter($players, static fn(array $p): bool => !in_array('ARQ', ordered_player_positions($p), true)));
    usort($candidates, static function (array $a, array $b): int {
        $ratingA = player_overall_rating($a);
        $ratingB = player_overall_rating($b);
        if ($ratingA !== $ratingB) {
            return $ratingA <=> $ratingB;
        }
        return strcmp((string) $a['name'], (string) $b['name']);
    });

    $emergencyIds = array_flip(array_map(static fn(array $p): int => (int) $p['id'], array_slice($candidates, 0, $missing)));
    return array_map(static function (array $player) use ($emergencyIds): array {
        if (!isset($emergencyIds[(int) $player['id']])) {
            return $player;
        }
        $player['positions'] = 'ARQ/' . (string) ($player['positions'] ?? '');
        $player['emergency_goalkeeper'] = true;
        return $player;
    }, $players);
}

function build_team_position_assignment(array $team): array
{
    $lines = ['ARQ', 'DEF', 'MED', 'DEL'];
    $maxPerLine = 5;

    $candidates = array_values(array_filter($team, static fn(array $p): bool => in_array('ARQ', ordered_player_positions($p), true)));
    usort($candidates, static function (array $a, array $b): int {
        $emergencyA = is_emergency_goalkeeper($a) ? 1 : 0;
        $emergencyB = is_emergency_goalkeeper($b) ? 1 : 0;
        if ($emergencyA !== $emergencyB) {
            return $emergencyA <=> $emergencyB;
        }
        $pureA = is_pure_goalkeeper($a) ? 0 : 1;
        $pureB = is_pure_goalkeeper($b) ? 0 : 1;
        if ($pureA !== $pureB) {
            return $pureA <=> $pureB;
        }
        $ratingA = player_overall_rating($a);
        $ratingB = player_overall_rating($b);
        if ($ratingB !== $ratingA) {
            return $ratingB <=> $ratingA;
        }
        return strcmp((string) $a['name'], (string) $b['name']);
    });

    $goalkeeperId = $candidates[0]['id'] ?? null;
    if ($goalkeeperId === null && $team) {
        $fallback = $team;
        usort($fallback, static function (array $a, array $b): int {
            $ratingA = player_overall_rating($a);
            $ratingB = player_overall_rating($b);
            if ($ratingA !== $ratingB) {
                return $ratingA <=> $ratingB;
            }
            return strcmp((string) $a['name'], (string) $b['name']);
        });
        $goalkeeperId = $fallback[0]['id'] ?? null;
    }
    $assignment = [];
    $preferences = [];

    foreach ($team as $player) {
        $id = (int) $player['id'];
        $pos = ordered_player_positions($player);
        $pref = $pos;

        if ($goalkeeperId !== null && $id === (int) $goalkeeperId) {
            $pref = ['ARQ'];
        } elseif (in_array('ARQ', $pos, true)) {
            $pref = array_values(array_filter($pos, static fn(string $line): bool => $line !== 'ARQ'));
            if (!$pref) {
                $pref = ['ARQ'];
            }
        }

        $preferences[$id] = $pref;
        $assignment[$id] = $pref[0] ?? 'MED';
    }

    $countLines = static function (array $assigned): array {
        $count = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
        foreach ($assigned as $line) {
            if (!isset($count[$line])) {
                $count['MED']++;
                continue;
            }
            $count[$line]++;
        }
        return $count;
    };

    $changed = true;
    while ($changed) {
        $changed = false;
        $lineCount = $countLines($assignment);
        $overloaded = array_values(array_filter($lines, static fn(string $line): bool => $lineCount[$line] > $maxPerLine));
        usort($overloaded, static fn(string $a, string $b): int => $lineCount[$b] <=> $lineCount[$a]);

        if (!$overloaded) {
            break;
        }

        foreach ($overloaded as $fromLine) {
            $movable = [];
            foreach ($team as $player) {
                $id = (int) $player['id'];
                if (($assignment[$id] ?? '') !== $fromLine) {
                    continue;
                }
                $prefs = $preferences[$id] ?? [];
                $hasAlt = false;
                foreach ($prefs as $line) {
                    if ($line !== $fromLine) {
                        $hasAlt = true;
                        break;
                    }
                }
                if ($hasAlt) {
                    $movable[] = $player;
                }
            }

            usort($movable, static function (array $a, array $b) use ($preferences): int {
                $altA = count($preferences[(int) $a['id']] ?? []);
                $altB = count($preferences[(int) $b['id']] ?? []);
                if ($altA !== $altB) {
                    return $altB <=> $altA;
                }
                return strcmp((string) $a['name'], (string) $b['name']);
            });

            foreach ($movable as $player) {
                $id = (int) $player['id'];
                $prefs = $preferences[$id] ?? [];
                $currentCount = $countLines($assignment);
                $destinations = [];
                foreach ($prefs as $line) {
                    if ($line === $fromLine) {
                        continue;
                    }
                    if (($currentCount[$line] ?? 0) < $maxPerLine) {
                        $destinations[] = $line;
                    }
                }
                if (!$destinations) {
                    continue;
                }

                usort($destinations, static function (string $a, string $b) use ($currentCount, $prefs): int {
                    $missingA = ($currentCount[$a] ?? 0) === 0 ? 1 : 0;
                    $missingB = ($currentCount[$b] ?? 0) === 0 ? 1 : 0;
                    if ($missingA !== $missingB) {
                        return $missingB <=> $missingA;
                    }
                    if (($currentCount[$a] ?? 0) !== ($currentCount[$b] ?? 0)) {
                        return ($currentCount[$a] ?? 0) <=> ($currentCount[$b] ?? 0);
                    }
                    return array_search($a, $prefs, true) <=> array_search($b, $prefs, true);
                });

                $assignment[$id] = $destinations[0];
                $changed = true;
                break 2;
            }
        }
    }

    $finalCount = $countLines($assignment);
    $goalkeepers = $finalCount['ARQ'];
    $lineValid = true;
    foreach ($lines as $line) {
        if (($finalCount[$line] ?? 0) > $maxPerLine) {
            $lineValid = false;
            break;
        }
    }

    return [
        'assignment' => $assignment,
        'goalkeepers' => $goalkeepers,
        'line_counts' => $finalCount,
        'line_limit_ok' => $lineValid,
    ];
}

function validate_teams(array $teams, int $teamSize, float $maxDiff): bool
{
    $scores = [];
    $slowCounts = [];
    foreach ($teams as $team) {
        if (count($team) !== $teamSize) {
            return false;
        }

        $data = build_team_position_assignment($team);
        if ($data['goalkeepers'] !== 1) {
            return false;
        }
        if (!$data['line_limit_ok']) {
            return false;
        }

        $lines = array_values(array_unique(array_values($data['assignment'])));
        foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $required) {
            if (!in_array($required, $lines, true)) {
                return false;
            }
        }

        $score = 0.0;
        $slow = 0;
        foreach ($team as $player) {
            $score += player_overall_rating($player);
            if (player_is_low_rhythm($player)) {
                $slow++;
            }
        }
        $scores[] = $score;
        $slowCounts[] = $slow;
    }

    if ((max($scores) - min($scores)) > $maxDiff) {
        return false;
    }

    return (max($slowCounts) - min($slowCounts)) <= 1;
}

function decorate_teams(array $teams): array
{
    $out = [];
    foreach ($teams as $index => $team) {
        usort($team, static function (array $a, array $b): int {
            $order = player_order($a) <=> player_order($b);
            if ($order !== 0) {
                return $order;
            }
            return strcmp((string) $a['name'], (string) $b['name']);
        });
        $assignmentData = build_team_position_assignment($team);
        $assigned = $assignmentData['assignment'];
        $linePlayers = ['ARQ' => [], 'DEF' => [], 'MED' => [], 'DEL' => []];
        foreach ($team as $player) {
            $pid = (int) $player['id'];
            $line = $assigned[$pid] ?? 'MED';
            $linePlayers[$line][] = $player + [
                'assigned_position' => $line,
                'is_goalkeeper' => ($line === 'ARQ') ? 1 : 0,
            ];
        }
        foreach (array_keys($linePlayers) as $line) {
            usort($linePlayers[$line], static function (array $a, array $b): int {
                $ratingA = player_overall_rating($a);
                $ratingB = player_overall_rating($b);
                if ($ratingB !== $ratingA) {
                    return $ratingB <=> $ratingA;
                }
                return strcmp((string) $a['name'], (string) $b['name']);
            });
        }

        $totalSkill = array_reduce($team, static fn(float $carry, array $p): float => $carry + player_overall_rating($p), 0.0);
        $out[] = [
            'team_number' => $index + 1,
            'players' => $team,
            'line_players' => $linePlayers,
            'total_skill' => $totalSkill,
            'line_counts' => $assignmentData['line_counts'],
        ];
    }
    return $out;
}

function generate_valid_teams(array $players, int $numTeams, float $maxDiff, int $attempts = 50000): ?array
{
    if ($numTeams < 2) {
        return null;
    }
    $totalPlayers = count($players);
    if ($totalPlayers === 0 || ($totalPlayers % $numTeams) !== 0) {
        return null;
    }
    $teamSize = (int) ($totalPlayers / $numTeams);
    $players = prepare_emergency_goalkeepers($players, $numTeams);

    $goalkeepers = array_values(array_filter($players, static fn(array $p): bool => in_array('ARQ', ordered_player_positions($p), true)));

    for ($try = 0; $try < $attempts; $try++) {
        $gkPool = $goalkeepers;
        shuffle($gkPool);
        $starterGk = array_slice($gkPool, 0, $numTeams);
        if (count($starterGk) < $numTeams) {
            continue;
        }

        $gkIds = array_map(static fn(array $p): int => (int) $p['id'], $starterGk);
        $fieldPool = array_values(array_filter($players, static fn(array $p): bool => !in_array((int) $p['id'], $gkIds, true)));
        $slowField = array_values(array_filter($fieldPool, static fn(array $p): bool => player_is_low_rhythm($p)));
        $fastField = array_values(array_filter($fieldPool, static fn(array $p): bool => !player_is_low_rhythm($p)));
        shuffle($slowField);
        usort($fastField, static fn(array $a, array $b): int => player_overall_rating($b) <=> player_overall_rating($a));

        $teams = array_fill(0, $numTeams, []);
        $teamPoints = array_fill(0, $numTeams, 0.0);
        $drawWeights = player_draw_balance_weights();
        $drawStatFields = array_values(array_filter(array_keys($drawWeights), static fn(string $field): bool => $field !== 'general'));
        $teamStats = array_fill(0, $numTeams, array_fill_keys($drawStatFields, 0.0));
        $lowRhythmCounts = array_fill(0, $numTeams, 0);

        $addPlayerToTeam = static function (array $player, int $teamIndex) use (&$teams, &$teamPoints, &$teamStats, &$lowRhythmCounts, $drawStatFields): void {
            $teams[$teamIndex][] = $player;
            $teamPoints[$teamIndex] += player_overall_rating($player);
            foreach ($drawStatFields as $field) {
                if ($field === 'goalkeeper_skill' && !player_has_goalkeeper_position($player)) {
                    continue;
                }
                $teamStats[$teamIndex][$field] += player_effective_stat($player, $field);
            }
            if (player_is_low_rhythm($player)) {
                $lowRhythmCounts[$teamIndex]++;
            }
        };

        $chooseBestTeam = static function (array $player, array $available) use (&$teamPoints, &$teamStats, &$lowRhythmCounts, $drawWeights, $drawStatFields): int {
            $bestTeam = $available[0];
            $bestCost = null;
            foreach ($available as $teamIndex) {
                $projectedPoints = $teamPoints;
                $projectedStats = $teamStats;
                $projectedLowRhythm = $lowRhythmCounts;
                $projectedPoints[$teamIndex] += player_overall_rating($player);
                foreach ($drawStatFields as $field) {
                    if ($field === 'goalkeeper_skill' && !player_has_goalkeeper_position($player)) {
                        continue;
                    }
                    $projectedStats[$teamIndex][$field] += player_effective_stat($player, $field);
                }
                if (player_is_low_rhythm($player)) {
                    $projectedLowRhythm[$teamIndex]++;
                }

                $cost = (max($projectedPoints) - min($projectedPoints)) * $drawWeights['general'];
                foreach ($drawStatFields as $field) {
                    $weight = $drawWeights[$field] ?? 0.0;
                    if ($weight <= 0.0) {
                        continue;
                    }
                    $values = array_map(static fn(array $stats): float => (float) $stats[$field], $projectedStats);
                    $cost += (max($values) - min($values)) * $weight;
                }
                $cost += (max($projectedLowRhythm) - min($projectedLowRhythm)) * 5;
                $cost += count($available) > 1 ? (mt_rand(0, 100) / 100000) : 0;

                if ($bestCost === null || $cost < $bestCost) {
                    $bestCost = $cost;
                    $bestTeam = $teamIndex;
                }
            }
            return $bestTeam;
        };

        for ($i = 0; $i < $numTeams; $i++) {
            $addPlayerToTeam($starterGk[$i], $i);
        }

        foreach (array_merge($slowField, $fastField) as $player) {
            $available = [];
            for ($t = 0; $t < $numTeams; $t++) {
                if (count($teams[$t]) < $teamSize) {
                    $available[] = $t;
                }
            }
            if (!$available) {
                break;
            }
            $target = $chooseBestTeam($player, $available);
            $addPlayerToTeam($player, $target);
        }

        $allFull = true;
        foreach ($teams as $team) {
            if (count($team) !== $teamSize) {
                $allFull = false;
                break;
            }
        }
        if (!$allFull) {
            continue;
        }

        if (validate_teams($teams, $teamSize, $maxDiff)) {
            return decorate_teams($teams);
        }
    }

    return null;
}
