<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function player_order(array $player): int
{
    $order = ['ARQ' => 1, 'DEF' => 2, 'LAT' => 3, 'MED' => 4, 'DEL' => 5];
    return $order[player_primary_position($player)] ?? 99;
}

function ordered_player_positions(array $player): array
{
    $positions = parse_positions_csv($player['positions'] ?? '');
    return $positions ?: ['MED'];
}

function draw_position_preferences(array $player): array
{
    $positions = ordered_player_positions($player);
    usort($positions, static function (string $a, string $b) use ($player): int {
        $ratingA = player_position_rating($player, $a);
        $ratingB = player_position_rating($player, $b);
        if ($ratingA !== $ratingB) {
            return $ratingB <=> $ratingA;
        }
        $order = array_flip(allowed_positions());
        return ($order[$a] ?? 99) <=> ($order[$b] ?? 99);
    });
    return $positions ?: ['MED'];
}

function draw_pitch_line(string $position): string
{
    return $position === 'LAT' ? 'DEF' : $position;
}

function draw_pitch_line_counts(array $logicalCounts): array
{
    return [
        'ARQ' => (int) ($logicalCounts['ARQ'] ?? 0),
        'DEF' => (int) ($logicalCounts['DEF'] ?? 0) + (int) ($logicalCounts['LAT'] ?? 0),
        'MED' => (int) ($logicalCounts['MED'] ?? 0),
        'DEL' => (int) ($logicalCounts['DEL'] ?? 0),
    ];
}

function draw_main_field_line_limit(int $teamSize): int
{
    $fieldPlayers = max(0, $teamSize - 1);
    return $fieldPlayers > 0 ? max(1, intdiv($fieldPlayers, 2)) : 0;
}

function draw_defense_side_line_limit(int $teamSize): int
{
    return draw_main_field_line_limit($teamSize);
}

function draw_pitch_line_minimum(string $position, int $teamSize): int
{
    $line = draw_pitch_line(strtoupper(trim($position)));
    $fieldPlayers = max(0, $teamSize - 1);
    if ($line === 'ARQ') {
        return 1;
    }
    if ($fieldPlayers === 4) {
        return in_array($line, player_required_lines(), true) ? 1 : 0;
    }
    if ($fieldPlayers < 5) {
        return 0;
    }
    if ($line === 'DEF' || $line === 'MED') {
        return 2;
    }
    if ($line === 'DEL') {
        return 1;
    }
    return 0;
}

function draw_logical_line_minimum(string $position, int $teamSize): int
{
    $position = strtoupper(trim($position));
    if ($position === 'ARQ') {
        return 1;
    }
    if (!in_array($position, player_field_lines(), true)) {
        return 0;
    }
    $fieldPlayers = max(0, $teamSize - 1);
    if ($position === 'LAT') {
        return $fieldPlayers >= 8 ? 2 : ($fieldPlayers >= count(player_field_lines()) ? 1 : 0);
    }
    return $fieldPlayers >= count(player_field_lines()) ? 1 : 0;
}

function draw_line_limit(string $position, int $teamSize): int
{
    $position = strtoupper(trim($position));
    if ($position === 'ARQ') {
        return 1;
    }
    if ($position === 'DEF' || $position === 'LAT') {
        return draw_defense_side_line_limit($teamSize);
    }
    return draw_main_field_line_limit($teamSize);
}

function draw_line_counts_fit_limits(array $lineCounts, int $teamSize): bool
{
    $pitchCounts = draw_pitch_line_counts($lineCounts);
    foreach (player_required_lines() as $line) {
        $count = (int) ($pitchCounts[$line] ?? 0);
        if ($count < draw_pitch_line_minimum($line, $teamSize)) {
            return false;
        }
        if ($count > draw_main_field_line_limit($teamSize)) {
            return false;
        }
    }
    foreach (player_field_lines() as $line) {
        $count = (int) ($lineCounts[$line] ?? 0);
        if ($count < draw_logical_line_minimum($line, $teamSize)) {
            return false;
        }
        if ($count > draw_line_limit($line, $teamSize)) {
            return false;
        }
    }
    return true;
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

function player_has_secondary_position(array $player, string $position): bool
{
    return in_array($position, array_slice(ordered_player_positions($player), 1), true);
}

function prepare_emergency_goalkeepers(array $players, int $numTeams): array
{
    $goalkeepers = array_values(array_filter($players, static fn(array $p): bool => player_primary_position($p) === 'ARQ'));
    $missing = max(0, $numTeams - count($goalkeepers));
    if ($missing === 0) {
        return $players;
    }

    $candidates = array_values(array_filter($players, static fn(array $p): bool => player_primary_position($p) !== 'ARQ'));
    usort($candidates, static function (array $a, array $b): int {
        $secondaryA = player_has_secondary_position($a, 'ARQ') ? 0 : 1;
        $secondaryB = player_has_secondary_position($b, 'ARQ') ? 0 : 1;
        if ($secondaryA !== $secondaryB) {
            return $secondaryA <=> $secondaryB;
        }
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
        $fieldPositions = array_values(array_filter(parse_positions_csv((string) ($player['positions'] ?? '')), static fn(string $position): bool => $position !== 'ARQ'));
        $player['positions'] = join_positions(array_merge(['ARQ'], $fieldPositions));
        $player['goalkeeper_skill'] = 2.0;
        $player['emergency_goalkeeper'] = true;
        return $player;
    }, $players);
}

function build_team_position_assignment(array $team): array
{
    $fieldLines = player_field_lines();
    $teamSize = count($team);
    $maxPerMainLine = draw_main_field_line_limit($teamSize);

    $candidates = array_values(array_filter($team, static fn(array $p): bool => player_primary_position($p) === 'ARQ' || is_emergency_goalkeeper($p)));
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
    $assignment = [];
    $preferences = [];

    foreach ($team as $player) {
        $id = (int) $player['id'];
        $pos = draw_position_preferences($player);
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
        $count = array_fill_keys(player_formation_lines(), 0);
        foreach ($assigned as $line) {
            if (!isset($count[$line])) {
                $count['MED']++;
                continue;
            }
            $count[$line]++;
        }
        return $count;
    };

    foreach (player_required_lines() as $requiredLine) {
        $guard = 0;
        while ($guard < $teamSize) {
            $guard++;
            $lineCount = $countLines($assignment);
            $pitchCount = draw_pitch_line_counts($lineCount);
            if (($pitchCount[$requiredLine] ?? 0) >= draw_pitch_line_minimum($requiredLine, $teamSize)) {
                break;
            }

            $candidate = null;
            $candidateRating = null;
            foreach ($team as $player) {
                $id = (int) $player['id'];
                $currentLine = draw_pitch_line((string) ($assignment[$id] ?? 'MED'));
                if ($currentLine === $requiredLine || $currentLine === 'ARQ') {
                    continue;
                }
                if (($pitchCount[$currentLine] ?? 0) <= draw_pitch_line_minimum($currentLine, $teamSize)) {
                    continue;
                }
                $rating = player_position_rating($player, $requiredLine);
                if ($candidate === null || $rating > $candidateRating) {
                    $candidate = $player;
                    $candidateRating = $rating;
                }
            }
            if ($candidate === null) {
                break;
            }
            $assignment[(int) $candidate['id']] = $requiredLine;
        }
    }

    foreach (player_field_lines() as $requiredLine) {
        $guard = 0;
        while ($guard < $teamSize) {
            $guard++;
            $lineCount = $countLines($assignment);
            if (($lineCount[$requiredLine] ?? 0) >= draw_logical_line_minimum($requiredLine, $teamSize)) {
                break;
            }

            $candidate = null;
            $candidateLoss = null;
            $candidateRating = null;
            foreach ($team as $player) {
                $id = (int) $player['id'];
                $currentLine = (string) ($assignment[$id] ?? 'MED');
                if ($currentLine === $requiredLine || $currentLine === 'ARQ') {
                    continue;
                }
                if (($lineCount[$currentLine] ?? 0) <= draw_logical_line_minimum($currentLine, $teamSize)) {
                    continue;
                }
                $pitchCount = draw_pitch_line_counts($lineCount);
                $currentPitchLine = draw_pitch_line($currentLine);
                if (($pitchCount[$currentPitchLine] ?? 0) <= draw_pitch_line_minimum($currentPitchLine, $teamSize)) {
                    continue;
                }
                $currentRating = player_position_rating($player, $currentLine);
                $requiredRating = player_position_rating($player, $requiredLine);
                $loss = $currentRating - $requiredRating;
                if (
                    $candidate === null
                    || $loss < $candidateLoss
                    || ($loss === $candidateLoss && $requiredRating > $candidateRating)
                ) {
                    $candidate = $player;
                    $candidateLoss = $loss;
                    $candidateRating = $requiredRating;
                }
            }
            if ($candidate === null) {
                break;
            }
            $assignment[(int) $candidate['id']] = $requiredLine;
        }
    }

    $changed = true;
    while ($changed) {
        $changed = false;
        $lineCount = $countLines($assignment);
        $pitchCount = draw_pitch_line_counts($lineCount);
        $overloaded = array_values(array_filter(player_required_lines(), static fn(string $line): bool => $pitchCount[$line] > $maxPerMainLine));
        usort($overloaded, static fn(string $a, string $b): int => $pitchCount[$b] <=> $pitchCount[$a]);
        $logicalOverloaded = array_values(array_filter($fieldLines, static fn(string $line): bool => $lineCount[$line] > draw_line_limit($line, $teamSize)));
        usort($logicalOverloaded, static fn(string $a, string $b): int => $lineCount[$b] <=> $lineCount[$a]);
        foreach ($logicalOverloaded as $line) {
            if (!in_array($line, $overloaded, true)) {
                $overloaded[] = $line;
            }
        }

        if (!$overloaded) {
            break;
        }

        foreach ($overloaded as $fromLine) {
            $fromLines = [$fromLine];
            $movable = [];
            foreach ($team as $player) {
                $id = (int) $player['id'];
                $currentAssignedLine = (string) ($assignment[$id] ?? '');
                if (!in_array($currentAssignedLine, $fromLines, true)) {
                    continue;
                }
                if (($lineCount[$currentAssignedLine] ?? 0) <= draw_logical_line_minimum($currentAssignedLine, $teamSize)) {
                    continue;
                }
                $prefs = $preferences[$id] ?? [];
                $hasAlt = false;
                foreach ($prefs as $line) {
                    if (!in_array($line, $fromLines, true)) {
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
                $currentPitchCount = draw_pitch_line_counts($currentCount);
                $destinations = [];
                foreach ($prefs as $line) {
                    if (in_array($line, $fromLines, true)) {
                        continue;
                    }
                    if ($line !== 'ARQ' && ($currentCount[$line] ?? 0) < draw_line_limit($line, $teamSize)) {
                        $destinations[] = $line;
                    }
                }
                if (!$destinations) {
                    continue;
                }

                usort($destinations, static function (string $a, string $b) use ($currentCount, $currentPitchCount, $prefs): int {
                    $pitchA = draw_pitch_line($a);
                    $pitchB = draw_pitch_line($b);
                    $missingA = ($currentPitchCount[$pitchA] ?? 0) === 0 ? 1 : 0;
                    $missingB = ($currentPitchCount[$pitchB] ?? 0) === 0 ? 1 : 0;
                    if ($missingA !== $missingB) {
                        return $missingB <=> $missingA;
                    }
                    if (($currentPitchCount[$pitchA] ?? 0) !== ($currentPitchCount[$pitchB] ?? 0)) {
                        return ($currentPitchCount[$pitchA] ?? 0) <=> ($currentPitchCount[$pitchB] ?? 0);
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
    $lineValid = draw_line_counts_fit_limits($finalCount, $teamSize);

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

        $lines = array_values(array_unique(array_map('draw_pitch_line', array_values($data['assignment']))));
        foreach (player_required_lines() as $required) {
            if (!in_array($required, $lines, true)) {
                return false;
            }
        }

        $score = 0.0;
        $slow = 0;
        foreach ($team as $player) {
            $assigned = $data['assignment'][(int) $player['id']] ?? player_best_natural_position($player);
            $score += player_position_rating($player, $assigned);
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

    if (draw_platinum_spread($teams) > 1) {
        return false;
    }

    return (max($slowCounts) - min($slowCounts)) <= 1;
}

function draw_player_band_ids(array $players, float $ratio = 0.25): array
{
    $players = array_values($players);
    if (count($players) < 4) {
        return ['low' => [], 'high' => []];
    }

    usort($players, static function (array $a, array $b): int {
        $ratingA = player_best_natural_rating($a);
        $ratingB = player_best_natural_rating($b);
        if ($ratingA !== $ratingB) {
            return $ratingA <=> $ratingB;
        }
        return strcmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
    });

    $bandSize = max(1, (int) floor(count($players) * $ratio));
    return [
        'low' => array_flip(array_map(static fn(array $p): int => (int) $p['id'], array_slice($players, 0, $bandSize))),
        'high' => array_flip(array_map(static fn(array $p): int => (int) $p['id'], array_slice($players, -$bandSize))),
    ];
}

function draw_team_band_counts(array $teams, array $bandIds): array
{
    return array_map(static function (array $team) use ($bandIds): int {
        $count = 0;
        foreach ($team as $player) {
            if (isset($bandIds[(int) $player['id']])) {
                $count++;
            }
        }
        return $count;
    }, $teams);
}

function draw_count_spread(array $counts): int
{
    return $counts ? (max($counts) - min($counts)) : 0;
}

function draw_team_floor_score(array $team, int $count = 2): float
{
    if (!$team) {
        return 0.0;
    }
    $ratings = array_map(static fn(array $player): float => player_best_natural_rating($player), $team);
    sort($ratings, SORT_NUMERIC);
    return array_sum(array_slice($ratings, 0, max(1, min($count, count($ratings)))));
}

function draw_team_floor_spread(array $teams, int $count = 2): float
{
    $values = array_map(static fn(array $team): float => draw_team_floor_score($team, $count), $teams);
    return $values ? (max($values) - min($values)) : 0.0;
}

function draw_player_low_liability(array $player): float
{
    $rating = player_best_natural_rating($player);
    $liability = max(0.0, 2.5 - $rating) * 2.0;
    if ($rating < 2.0) {
        $liability += (2.0 - $rating) * 3.0;
    }
    return $liability;
}

function draw_team_low_liability_score(array $team): float
{
    return array_sum(array_map('draw_player_low_liability', $team));
}

function draw_team_low_liability_spread(array $teams): float
{
    $values = array_map('draw_team_low_liability_score', $teams);
    return $values ? (max($values) - min($values)) : 0.0;
}

function draw_position_balance_penalty(array $teams): float
{
    if (!$teams) {
        return 0.0;
    }

    $teamSize = max(array_map('count', $teams));
    $countsByLine = array_fill_keys(player_field_lines(), []);
    $missingPenalty = 0.0;

    foreach ($teams as $team) {
        $assignmentData = build_team_position_assignment($team);
        $counts = $assignmentData['line_counts'];
        foreach (player_field_lines() as $line) {
            $count = (int) ($counts[$line] ?? 0);
            $countsByLine[$line][] = $count;
            $minimum = draw_logical_line_minimum($line, $teamSize);
            if ($count < $minimum) {
                $missingPenalty += ($minimum - $count) * 500.0;
            }
        }
    }

    $spreadPenalty = 0.0;
    foreach ($countsByLine as $lineCounts) {
        $spreadPenalty += draw_count_spread($lineCounts) * 140.0;
    }

    return $missingPenalty + $spreadPenalty;
}

function draw_player_card_overall(float $rating): int
{
    $rating = max(1.0, min(6.0, $rating));
    $anchors = [
        [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
        [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
        [5.2, 93], [5.3, 94], [6.0, 99],
    ];
    $last = count($anchors) - 1;
    for ($i = 0; $i < $last; $i++) {
        [$fromRating, $fromOverall] = $anchors[$i];
        [$toRating, $toOverall] = $anchors[$i + 1];
        if ($rating <= $toRating) {
            $ratio = ($rating - $fromRating) / ($toRating - $fromRating);
            return (int) round($fromOverall + (($toOverall - $fromOverall) * $ratio));
        }
    }
    return 99;
}

function draw_player_card_tier(float $rating): string
{
    $overall = draw_player_card_overall($rating);
    if ($overall >= 88) {
        return 'supreme';
    }
    if ($overall >= 84) {
        return 'elite';
    }
    if ($overall >= 76) {
        return 'gold';
    }
    if ($overall >= 66) {
        return 'silver';
    }
    return 'bronze';
}

function draw_player_is_platinum(array $player): bool
{
    return draw_player_card_tier(player_best_natural_rating($player)) === 'supreme';
}

function draw_team_card_tier_counts(array $team): array
{
    $counts = array_fill_keys(['bronze', 'silver', 'gold', 'elite', 'supreme'], 0);
    $assignmentData = build_team_position_assignment($team);
    $assigned = $assignmentData['assignment'];
    foreach ($team as $player) {
        $playerId = (int) $player['id'];
        $line = $assigned[$playerId] ?? player_best_natural_position($player);
        $tier = draw_player_card_tier(player_position_rating($player, $line));
        $counts[$tier] = ($counts[$tier] ?? 0) + 1;
    }
    return $counts;
}

function draw_teams_card_tier_counts(array $teams): array
{
    $countsByTier = array_fill_keys(['bronze', 'silver', 'gold', 'elite', 'supreme'], []);
    foreach ($teams as $team) {
        $counts = draw_team_card_tier_counts($team);
        foreach ($counts as $tier => $count) {
            $countsByTier[$tier][] = $count;
        }
    }
    return $countsByTier;
}

function draw_platinum_spread(array $teams): int
{
    return draw_count_spread(draw_teams_card_tier_counts($teams)['supreme'] ?? []);
}

function draw_tier_balance_penalty(array $teams): float
{
    if (!$teams) {
        return 0.0;
    }

    $tierWeights = [
        'bronze' => 35.0,
        'silver' => 45.0,
        'gold' => 70.0,
        'elite' => 110.0,
        'supreme' => 150.0,
    ];
    $countsByTier = draw_teams_card_tier_counts($teams);

    $penalty = 0.0;
    foreach ($tierWeights as $tier => $weight) {
        $penalty += draw_count_spread($countsByTier[$tier] ?? []) * $weight;
    }
    return $penalty;
}

function draw_line_strength_balance_penalty(array $teams): float
{
    if (!$teams) {
        return 0.0;
    }

    $weights = [
        'ARQ' => 240.0,
        'DEF' => 280.0,
        'MED' => 240.0,
        'DEL' => 260.0,
    ];
    $totalsByLine = array_fill_keys(player_pitch_lines(), []);

    foreach ($teams as $team) {
        $assignmentData = build_team_position_assignment($team);
        $assigned = $assignmentData['assignment'];
        $lineTotals = array_fill_keys(player_pitch_lines(), 0.0);
        foreach ($team as $player) {
            $playerId = (int) $player['id'];
            $position = $assigned[$playerId] ?? player_best_natural_position($player);
            $line = player_pitch_line($position);
            if (!array_key_exists($line, $lineTotals)) {
                continue;
            }
            $lineTotals[$line] += player_position_rating($player, $position);
        }
        foreach ($lineTotals as $line => $total) {
            $totalsByLine[$line][] = $total;
        }
    }

    $penalty = 0.0;
    foreach ($totalsByLine as $line => $values) {
        if (!$values) {
            continue;
        }
        $penalty += (max($values) - min($values)) * ($weights[$line] ?? 200.0);
    }
    return $penalty;
}

function draw_profile_distribution_penalty(array $teams): float
{
    if (!$teams) {
        return 0.0;
    }

    $fields = ['attack', 'defense_physical', 'rhythm', 'technique', 'teamwork', 'mentality'];
    $penalty = 0.0;
    foreach ($fields as $field) {
        $strongCounts = [];
        $weakCounts = [];
        foreach ($teams as $team) {
            $strong = 0;
            $weak = 0;
            foreach ($team as $player) {
                $value = player_effective_stat($player, $field);
                if ($value >= 4.2) {
                    $strong++;
                }
                if ($value <= 2.8) {
                    $weak++;
                }
            }
            $strongCounts[] = $strong;
            $weakCounts[] = $weak;
        }
        $penalty += draw_count_spread($strongCounts) * 85.0;
        $penalty += draw_count_spread($weakCounts) * 45.0;
    }
    return $penalty;
}

function draw_teams_quality_score(array $teams, array $bands): float
{
    $drawWeights = player_draw_balance_weights();
    $drawStatFields = array_values(array_filter(array_keys($drawWeights), static fn(string $field): bool => $field !== 'general'));
    $scores = [];
    $lowRhythmCounts = [];
    $statTotals = array_fill(0, count($teams), array_fill_keys($drawStatFields, 0.0));

    foreach ($teams as $teamIndex => $team) {
        $assignmentData = build_team_position_assignment($team);
        $assigned = $assignmentData['assignment'];
        $teamScore = 0.0;
        $lowRhythm = 0;
        foreach ($team as $player) {
            $line = $assigned[(int) $player['id']] ?? player_best_natural_position($player);
            $teamScore += player_position_rating($player, $line);
            if (player_is_low_rhythm($player)) {
                $lowRhythm++;
            }
            foreach ($drawStatFields as $field) {
                if ($field === 'goalkeeper_skill' && !player_has_goalkeeper_position($player)) {
                    continue;
                }
                $statTotals[$teamIndex][$field] += player_effective_stat($player, $field);
            }
        }
        $scores[] = $teamScore;
        $lowRhythmCounts[] = $lowRhythm;
    }

    $cost = (max($scores) - min($scores)) * $drawWeights['general'];
    foreach ($drawStatFields as $field) {
        $weight = $drawWeights[$field] ?? 0.0;
        if ($weight <= 0.0) {
            continue;
        }
        $values = array_map(static fn(array $stats): float => (float) $stats[$field], $statTotals);
        $cost += (max($values) - min($values)) * $weight;
    }

    $lowBandSpread = draw_count_spread(draw_team_band_counts($teams, $bands['low'] ?? []));
    $highBandSpread = draw_count_spread(draw_team_band_counts($teams, $bands['high'] ?? []));

    $cost += draw_count_spread($lowRhythmCounts) * 20.0;
    $cost += $lowBandSpread * 120.0;
    $cost += $highBandSpread * 90.0;
    $cost += draw_team_floor_spread($teams, 2) * 55.0;
    $cost += draw_team_low_liability_spread($teams) * 85.0;
    $cost += draw_position_balance_penalty($teams);
    $cost += draw_tier_balance_penalty($teams);
    $cost += draw_line_strength_balance_penalty($teams);
    $cost += draw_profile_distribution_penalty($teams);

    return $cost;
}

function draw_optimized_team_swap(array $teams, int $teamSize, float $maxDiff, array $bands): ?array
{
    $currentScore = draw_teams_quality_score($teams, $bands);
    $best = null;
    $bestScore = $currentScore;
    $teamCount = count($teams);

    for ($leftTeam = 0; $leftTeam < $teamCount - 1; $leftTeam++) {
        for ($rightTeam = $leftTeam + 1; $rightTeam < $teamCount; $rightTeam++) {
            foreach ($teams[$leftTeam] as $leftIndex => $_leftPlayer) {
                foreach ($teams[$rightTeam] as $rightIndex => $_rightPlayer) {
                    $candidate = $teams;
                    $candidate[$leftTeam][$leftIndex] = $teams[$rightTeam][$rightIndex];
                    $candidate[$rightTeam][$rightIndex] = $teams[$leftTeam][$leftIndex];

                    if (!validate_teams($candidate, $teamSize, $maxDiff)) {
                        continue;
                    }

                    $score = draw_teams_quality_score($candidate, $bands);
                    if ($score + 0.0001 < $bestScore) {
                        $bestScore = $score;
                        $best = $candidate;
                    }
                }
            }
        }
    }

    return $best;
}

function draw_optimize_teams(array $teams, int $teamSize, float $maxDiff, array $bands, int $passes = 3): array
{
    for ($pass = 0; $pass < $passes; $pass++) {
        $next = draw_optimized_team_swap($teams, $teamSize, $maxDiff, $bands);
        if ($next === null) {
            break;
        }
        $teams = $next;
    }

    return $teams;
}

function draw_exact_two_team_candidate(array $players, int $teamSize, float $maxDiff, array $bands): ?array
{
    $totalPlayers = count($players);
    if ($teamSize < 2 || $totalPlayers !== ($teamSize * 2) || $totalPlayers > 20) {
        return null;
    }

    $bestTeams = null;
    $bestScore = null;
    $selected = [0];
    $candidateIndexes = range(1, $totalPlayers - 1);
    $targetPicks = $teamSize - 1;
    $totalPlatinum = count(array_filter($players, 'draw_player_is_platinum'));
    $minPlatinumPerTeam = intdiv($totalPlatinum, 2);
    $maxPlatinumPerTeam = (int) ceil($totalPlatinum / 2);

    $visit = static function (int $start, int $remaining) use (&$visit, &$selected, $candidateIndexes, $players, $teamSize, $maxDiff, $bands, &$bestTeams, &$bestScore, $minPlatinumPerTeam, $maxPlatinumPerTeam): void {
        $selectedPlatinum = count(array_filter($selected, static fn(int $index): bool => draw_player_is_platinum($players[$index])));
        if ($selectedPlatinum > $maxPlatinumPerTeam) {
            return;
        }
        $remainingPlatinum = 0;
        for ($i = $start; $i < count($candidateIndexes); $i++) {
            if (draw_player_is_platinum($players[$candidateIndexes[$i]])) {
                $remainingPlatinum++;
            }
        }
        if (($selectedPlatinum + $remainingPlatinum) < $minPlatinumPerTeam) {
            return;
        }
        if ($remaining === 0) {
            if ($selectedPlatinum < $minPlatinumPerTeam || $selectedPlatinum > $maxPlatinumPerTeam) {
                return;
            }
            $selectedSet = array_flip($selected);
            $left = [];
            $right = [];
            foreach ($players as $index => $player) {
                if (isset($selectedSet[$index])) {
                    $left[] = $player;
                } else {
                    $right[] = $player;
                }
            }

            $teams = [$left, $right];
            if (!validate_teams($teams, $teamSize, $maxDiff)) {
                return;
            }

            $score = draw_teams_quality_score($teams, $bands);
            if ($bestScore === null || $score < $bestScore) {
                $bestScore = $score;
                $bestTeams = $teams;
            }
            return;
        }

        $lastStart = count($candidateIndexes) - $remaining;
        for ($i = $start; $i <= $lastStart; $i++) {
            $selected[] = $candidateIndexes[$i];
            $visit($i + 1, $remaining - 1);
            array_pop($selected);
        }
    };

    $visit(0, $targetPicks);
    return $bestTeams;
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
        $linePlayers = array_fill_keys(player_formation_lines(), []);
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
                $ratingA = player_position_rating($a, (string) ($a['assigned_position'] ?? player_best_natural_position($a)));
                $ratingB = player_position_rating($b, (string) ($b['assigned_position'] ?? player_best_natural_position($b)));
                if ($ratingB !== $ratingA) {
                    return $ratingB <=> $ratingA;
                }
                return strcmp((string) $a['name'], (string) $b['name']);
            });
        }

        $totalSkill = 0.0;
        foreach ($team as $player) {
            $pid = (int) $player['id'];
            $totalSkill += player_position_rating($player, $assigned[$pid] ?? player_best_natural_position($player));
        }
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

function generate_valid_teams(array $players, int $numTeams, float $maxDiff, int $attempts = 50000, int $targetValidCandidates = 80): ?array
{
    static $exactCache = [];

    if ($numTeams < 2) {
        return null;
    }
    $totalPlayers = count($players);
    if ($totalPlayers === 0 || ($totalPlayers % $numTeams) !== 0) {
        return null;
    }
    $teamSize = (int) ($totalPlayers / $numTeams);
    $bands = draw_player_band_ids($players);
    $players = prepare_emergency_goalkeepers($players, $numTeams);
    if ($numTeams === 2 && $totalPlayers <= 20) {
        $cacheKey = md5(json_encode([
            'ids' => array_map(static fn(array $player): int => (int) ($player['id'] ?? 0), $players),
            'max_diff' => round($maxDiff, 2),
        ], JSON_THROW_ON_ERROR));
        if (array_key_exists($cacheKey, $exactCache)) {
            return $exactCache[$cacheKey] !== null ? decorate_teams($exactCache[$cacheKey]) : null;
        }
        $exactTeams = draw_exact_two_team_candidate($players, $teamSize, $maxDiff, $bands);
        if ($exactTeams !== null) {
            $exactCache[$cacheKey] = $exactTeams;
            return decorate_teams($exactTeams);
        }
        $exactCache[$cacheKey] = null;
    }

    $goalkeepers = array_values(array_filter($players, static fn(array $p): bool => player_primary_position($p) === 'ARQ' || is_emergency_goalkeeper($p)));
    $bestTeams = null;
    $bestScore = null;
    $validCandidates = 0;

    for ($try = 0; $try < $attempts; $try++) {
        $gkPool = $goalkeepers;
        shuffle($gkPool);
        $starterGk = array_slice($gkPool, 0, $numTeams);
        if (count($starterGk) < $numTeams) {
            continue;
        }

        $gkIds = array_map(static fn(array $p): int => (int) $p['id'], $starterGk);
        $fieldPool = array_values(array_filter($players, static fn(array $p): bool => !in_array((int) $p['id'], $gkIds, true)));
        $platinumPool = array_values(array_filter($fieldPool, 'draw_player_is_platinum'));
        $platinumIds = array_flip(array_map(static fn(array $p): int => (int) $p['id'], $platinumPool));
        $nonPlatinumFieldPool = array_values(array_filter($fieldPool, static fn(array $p): bool => !isset($platinumIds[(int) $p['id']])));
        $slowField = array_values(array_filter($nonPlatinumFieldPool, static fn(array $p): bool => player_is_low_rhythm($p)));
        $fastField = array_values(array_filter($nonPlatinumFieldPool, static fn(array $p): bool => !player_is_low_rhythm($p)));
        shuffle($slowField);
        shuffle($fastField);
        $fieldOrder = match ($try % 4) {
            0 => array_merge($slowField, $fastField),
            1 => $nonPlatinumFieldPool,
            2 => $nonPlatinumFieldPool,
            default => array_merge($fastField, $slowField),
        };
        if (($try % 4) === 1) {
            usort($fieldOrder, static fn(array $a, array $b): int => player_best_natural_rating($b) <=> player_best_natural_rating($a));
        } elseif (($try % 4) === 2) {
            usort($fieldOrder, static fn(array $a, array $b): int => player_best_natural_rating($a) <=> player_best_natural_rating($b));
        } else {
            shuffle($fieldOrder);
        }

        $teams = array_fill(0, $numTeams, []);
        $teamPoints = array_fill(0, $numTeams, 0.0);
        $drawWeights = player_draw_balance_weights();
        $drawStatFields = array_values(array_filter(array_keys($drawWeights), static fn(string $field): bool => $field !== 'general'));
        $teamStats = array_fill(0, $numTeams, array_fill_keys($drawStatFields, 0.0));
        $lowRhythmCounts = array_fill(0, $numTeams, 0);

        $addPlayerToTeam = static function (array $player, int $teamIndex) use (&$teams, &$teamPoints, &$teamStats, &$lowRhythmCounts, $drawStatFields): void {
            $teams[$teamIndex][] = $player;
            $teamPoints[$teamIndex] += player_best_natural_rating($player);
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

        $chooseBestTeam = static function (array $player, array $available) use (&$teamPoints, &$teamStats, &$lowRhythmCounts, $drawWeights, $drawStatFields, $bands, &$teams, $try): int {
            $bestTeam = $available[0];
            $bestCost = null;
            foreach ($available as $teamIndex) {
                $projectedPoints = $teamPoints;
                $projectedStats = $teamStats;
                $projectedLowRhythm = $lowRhythmCounts;
                $projectedPoints[$teamIndex] += player_best_natural_rating($player);
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
                $cost += (max($projectedLowRhythm) - min($projectedLowRhythm)) * 20.0;
                if (isset($bands['low'][(int) $player['id']])) {
                    $projectedLowBand = draw_team_band_counts($teams, $bands['low']);
                    $projectedLowBand[$teamIndex]++;
                    $cost += draw_count_spread($projectedLowBand) * 120.0;
                }
                if (isset($bands['high'][(int) $player['id']])) {
                    $projectedHighBand = draw_team_band_counts($teams, $bands['high']);
                    $projectedHighBand[$teamIndex]++;
                    $cost += draw_count_spread($projectedHighBand) * 90.0;
                }
                $projectedTeams = $teams;
                $projectedTeams[$teamIndex][] = $player;
                $cost += draw_team_low_liability_spread($projectedTeams) * 85.0;
                $cost += draw_position_balance_penalty($projectedTeams);
                $cost += draw_tier_balance_penalty($projectedTeams);
                $cost += draw_line_strength_balance_penalty($projectedTeams);
                $cost += draw_profile_distribution_penalty($projectedTeams);
                if (count($available) > 1) {
                    $exploration = match ($try % 6) {
                        0 => 30.0,
                        3 => 12.0,
                        default => 0.05,
                    };
                    $cost += (mt_rand(0, 1000) / 1000) * $exploration;
                }

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

        shuffle($platinumPool);
        usort($platinumPool, static fn(array $a, array $b): int => player_best_natural_rating($b) <=> player_best_natural_rating($a));
        foreach ($platinumPool as $player) {
            $platinumCounts = array_map(static fn(array $team): int => draw_team_card_tier_counts($team)['supreme'] ?? 0, $teams);
            $minimumPlatinumCount = min($platinumCounts);
            $available = [];
            for ($t = 0; $t < $numTeams; $t++) {
                if (count($teams[$t]) < $teamSize && $platinumCounts[$t] === $minimumPlatinumCount) {
                    $available[] = $t;
                }
            }
            if (!$available) {
                break;
            }
            $target = $chooseBestTeam($player, $available);
            $addPlayerToTeam($player, $target);
        }

        foreach ($fieldOrder as $player) {
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
            $validCandidates++;
            $qualityScore = draw_teams_quality_score($teams, $bands);
            if ($bestScore === null || $qualityScore < $bestScore) {
                $teams = draw_optimize_teams($teams, $teamSize, $maxDiff, $bands);
                if (!validate_teams($teams, $teamSize, $maxDiff)) {
                    continue;
                }
                $qualityScore = draw_teams_quality_score($teams, $bands);
                $bestScore = $qualityScore;
                $bestTeams = $teams;
            }
            $lowBandSpread = draw_count_spread(draw_team_band_counts($teams, $bands['low'] ?? []));
            $highBandSpread = draw_count_spread(draw_team_band_counts($teams, $bands['high'] ?? []));
            $floorSpread = draw_team_floor_spread($teams, 2);
            $lowLiabilitySpread = draw_team_low_liability_spread($teams);
            if ($validCandidates >= max(1, $targetValidCandidates) && $lowBandSpread <= 1 && $highBandSpread <= 1 && $floorSpread <= 1.0 && $lowLiabilitySpread <= 1.0) {
                break;
            }
        }
    }

    if ($numTeams === 2 && $totalPlayers <= 20) {
        $exactTeams = draw_exact_two_team_candidate($players, $teamSize, $maxDiff, $bands);
        if ($exactTeams !== null) {
            $exactScore = draw_teams_quality_score($exactTeams, $bands);
            if ($bestScore === null || $exactScore < $bestScore) {
                $bestTeams = $exactTeams;
            }
        }
    }

    return $bestTeams !== null ? decorate_teams($bestTeams) : null;
}
