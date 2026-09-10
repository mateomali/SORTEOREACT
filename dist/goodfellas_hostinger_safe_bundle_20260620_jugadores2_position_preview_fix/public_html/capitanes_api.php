<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/sorteo.php';
require_once __DIR__ . '/lib/schema.php';

ensure_control_schema();

header('Content-Type: application/json; charset=utf-8');

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function captain_draft_row(int $matchId): ?array
{
    $stmt = db()->prepare(
        'SELECT d.*,
                p1.name AS captain1_name,
                p1.skill AS captain1_skill,
                p2.name AS captain2_name,
                p2.skill AS captain2_skill,
                p3.name AS captain3_name,
                p3.skill AS captain3_skill,
                p4.name AS captain4_name,
                p4.skill AS captain4_skill
         FROM captain_drafts d
         INNER JOIN players p1 ON p1.id = d.captain1_player_id
         INNER JOIN players p2 ON p2.id = d.captain2_player_id
         LEFT JOIN players p3 ON p3.id = d.captain3_player_id
         LEFT JOIN players p4 ON p4.id = d.captain4_player_id
         WHERE d.match_id = :mid
         LIMIT 1'
    );
    $stmt->execute(['mid' => $matchId]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    foreach ([1, 2, 3, 4] as $teamNumber) {
        $captainId = (int) ($row['captain' . $teamNumber . '_player_id'] ?? 0);
        if ($captainId <= 0) {
            continue;
        }
        $captain = repo_player_by_id($captainId);
        if ($captain) {
            $row['captain' . $teamNumber . '_skill'] = player_overall_rating($captain);
        }
    }
    return $row;
}

function captain_numbers(array $draft): array
{
    $numbers = [];
    foreach ([1, 2, 3, 4] as $teamNumber) {
        if ((int) ($draft['captain' . $teamNumber . '_player_id'] ?? 0) > 0) {
            $numbers[] = $teamNumber;
        }
    }
    return $numbers ?: [1, 2];
}

function captain_count(array $draft): int
{
    return count(captain_numbers($draft));
}

function draft_captain_name(array $draft, int $teamNumber): string
{
    return (string) ($draft['captain' . $teamNumber . '_name'] ?? ('Equipo ' . $teamNumber));
}

function draft_captain_skill(array $draft, int $teamNumber): float
{
    return (float) ($draft['captain' . $teamNumber . '_skill'] ?? 0);
}

function captain_turn_order(array $draft): array
{
    $numbers = captain_numbers($draft);
    usort($numbers, static function (int $a, int $b) use ($draft): int {
        $skillCompare = draft_captain_skill($draft, $a) <=> draft_captain_skill($draft, $b);
        return $skillCompare !== 0 ? $skillCompare : $a <=> $b;
    });
    return $numbers;
}

function next_captain_team(array $draft, int $currentTeam): int
{
    $numbers = captain_turn_order($draft);
    $index = array_search($currentTeam, $numbers, true);
    if ($index === false) {
        return $numbers[0];
    }
    return $numbers[($index + 1) % count($numbers)];
}

function primary_position(array $player): string
{
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    return $positions[0] ?? 'MED';
}

function has_secondary_position(array $player, string $position): bool
{
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    return in_array($position, array_slice($positions, 1), true);
}

function captain_position_base_rating(array $player, string $position): float
{
    $position = strtoupper($position);
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    $rating = player_overall_rating($player);
    if ($position === 'ARQ') {
        $goalkeeperSkill = in_array('ARQ', $positions, true) ? player_effective_stat($player, 'goalkeeper_skill') : 2.0;
        $rating = ($goalkeeperSkill * 0.42)
            + (player_effective_stat($player, 'defense_physical') * 0.14)
            + (player_effective_stat($player, 'rhythm') * 0.10)
            + (player_effective_stat($player, 'technique') * 0.10)
            + (player_effective_stat($player, 'teamwork') * 0.14)
            + (player_effective_stat($player, 'mentality') * 0.10);
    } elseif ($position === 'DEF') {
        $rating = array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('DEF')),
            player_field_stat_weights('DEF')
        ));
    } elseif ($position === 'LAT') {
        $rating = array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('LAT')),
            player_field_stat_weights('LAT')
        ));
    } elseif ($position === 'MED') {
        $rating = array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('MED')),
            player_field_stat_weights('MED')
        ));
    } elseif ($position === 'DEL') {
        $rating = array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('DEL')),
            player_field_stat_weights('DEL')
        ));
    }
    return player_apply_regularity_adjustment($rating, $player);
}

function captain_adjusted_position_rating(array $player, string $position): float
{
    $position = strtoupper($position);
    if ($position === '') {
        return player_overall_rating($player);
    }
    $base = captain_position_base_rating($player, $position);
    return max(1.0, min(6.0, $base));
}

function captain_recent_non_captain_pick_streak(int $matchId, int $captainCount): array
{
    $stmt = db()->prepare(
        'SELECT team_number
         FROM captain_picks
         WHERE match_id = :mid AND pick_order > :captain_count
         ORDER BY pick_order DESC
         LIMIT 10'
    );
    $stmt->execute(['mid' => $matchId, 'captain_count' => $captainCount]);
    $rows = $stmt->fetchAll();
    if (!$rows) {
        return ['team_number' => null, 'count' => 0];
    }

    $teamNumber = (int) $rows[0]['team_number'];
    $count = 0;
    foreach ($rows as $row) {
        if ((int) $row['team_number'] !== $teamNumber) {
            break;
        }
        $count++;
    }

    return ['team_number' => $teamNumber, 'count' => $count];
}

function captain_next_team_by_lowest_total_skill(int $matchId, array $draft, int $maxConsecutiveTurns = 2): int
{
    $teamNumbers = captain_numbers($draft);
    $captainCount = count($teamNumbers);
    $totalStmt = db()->prepare('SELECT COUNT(*) FROM match_players WHERE match_id = :mid');
    $totalStmt->execute(['mid' => $matchId]);
    $targetSize = $captainCount > 0 ? (int) ((int) $totalStmt->fetchColumn() / $captainCount) : 0;

    $stats = captain_team_skill_totals($matchId);

    usort($teamNumbers, static function (int $a, int $b) use ($stats, $targetSize): int {
        $countA = $stats[$a]['picked_count'] ?? 0;
        $countB = $stats[$b]['picked_count'] ?? 0;
        $fullA = $targetSize > 0 && $countA >= $targetSize ? 1 : 0;
        $fullB = $targetSize > 0 && $countB >= $targetSize ? 1 : 0;
        if ($fullA !== $fullB) {
            return $fullA <=> $fullB;
        }
        $totalA = $stats[$a]['total_skill'] ?? 0.0;
        $totalB = $stats[$b]['total_skill'] ?? 0.0;
        if (abs($totalA - $totalB) > 0.0001) {
            return $totalA <=> $totalB;
        }
        if ($countA !== $countB) {
            return $countA <=> $countB;
        }
        return $a <=> $b;
    });

    $openTeams = [];
    foreach ($teamNumbers as $teamNumber) {
        $count = $stats[$teamNumber]['picked_count'] ?? 0;
        if ($targetSize <= 0 || $count < $targetSize) {
            $openTeams[] = $teamNumber;
        }
    }

    if (!$openTeams) {
        return $teamNumbers[0] ?? 1;
    }

    $streak = captain_recent_non_captain_pick_streak($matchId, $captainCount);
    if (
        $maxConsecutiveTurns > 0
        && (int) ($streak['count'] ?? 0) >= $maxConsecutiveTurns
        && count($openTeams) > 1
    ) {
        $streakTeam = (int) ($streak['team_number'] ?? 0);
        foreach ($openTeams as $teamNumber) {
            if ($teamNumber !== $streakTeam) {
                return $teamNumber;
            }
        }
    }

    return $openTeams[0];
}

function can_edit_captain_formation(array $match): bool
{
    return in_array((string) ($match['status'] ?? ''), ['sorteado', 'finalizado'], true);
}

function validate_captain_formation_line_counts(array $counts): void
{
    $goalkeepers = (int) ($counts['ARQ'] ?? 0);
    if ($goalkeepers !== 1) {
        throw new RuntimeException('Cada equipo debe tener exactamente 1 arquero.');
    }

    $pitchCounts = [
        'DEF' => (int) ($counts['DEF'] ?? 0) + (int) ($counts['LAT'] ?? 0),
        'MED' => (int) ($counts['MED'] ?? 0),
        'DEL' => (int) ($counts['DEL'] ?? 0),
    ];
    foreach ($pitchCounts as $count) {
        if ($count > 4) {
            throw new RuntimeException('Maximo 4 jugadores por linea en la formacion.');
        }
    }
}

function captain_formation_name_from_counts(array $counts): string
{
    return implode('-', [
        (int) ($counts['DEF'] ?? 0) + (int) ($counts['LAT'] ?? 0),
        (int) ($counts['MED'] ?? 0),
        (int) ($counts['DEL'] ?? 0),
    ]);
}

function captain_team_skill_totals(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT mp.team_number, p.*
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid AND mp.team_number IS NOT NULL
         ORDER BY mp.team_number ASC, p.name ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    $totals = [];
    foreach ($stmt->fetchAll() as $row) {
        $teamNumber = (int) $row['team_number'];
        if (!isset($totals[$teamNumber])) {
            $totals[$teamNumber] = [
                'picked_count' => 0,
                'total_skill' => 0.0,
            ];
        }
        $totals[$teamNumber]['picked_count']++;
        $totals[$teamNumber]['total_skill'] += player_overall_rating($row);
    }
    return $totals;
}

function captain_pick_rule_current_teams(int $matchId, array $teamNumbers): array
{
    $teams = [];
    foreach ($teamNumbers as $teamNumber) {
        $teams[(int) $teamNumber] = [];
    }

    $stmt = db()->prepare(
        'SELECT mp.team_number, p.*
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid AND mp.team_number IS NOT NULL
         ORDER BY mp.team_number ASC, p.name ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    foreach ($stmt->fetchAll() as $row) {
        $teamNumber = (int) $row['team_number'];
        if (!isset($teams[$teamNumber])) {
            $teams[$teamNumber] = [];
        }
        $teams[$teamNumber][] = $row;
    }

    return $teams;
}

function captain_pick_rule_quality_options(int $matchId, array $pool, array $available, array $draft): array
{
    if (!$pool) {
        return ['allowed_ids' => [], 'best_score' => null, 'score_margin' => 0.0];
    }

    $currentTeam = (int) ($draft['current_team'] ?? 0);
    $teamNumbers = captain_numbers($draft);
    $teamsByNumber = captain_pick_rule_current_teams($matchId, $teamNumbers);
    $allPlayers = array_merge(
        array_merge(...array_values($teamsByNumber ?: [[]])),
        $available
    );
    $bands = draw_player_band_ids($allPlayers);
    $options = [];

    foreach ($pool as $player) {
        $projected = $teamsByNumber;
        $projected[$currentTeam] = $projected[$currentTeam] ?? [];
        $projected[$currentTeam][] = $player;
        $score = draw_teams_quality_score(array_values($projected), $bands);
        $options[] = [
            'id' => (int) $player['id'],
            'score' => $score,
            'rating' => player_overall_rating($player),
        ];
    }

    usort($options, static function (array $a, array $b): int {
        if (abs($a['score'] - $b['score']) > 0.0001) {
            return $a['score'] <=> $b['score'];
        }
        if (abs($a['rating'] - $b['rating']) > 0.0001) {
            return $a['rating'] <=> $b['rating'];
        }
        return $a['id'] <=> $b['id'];
    });

    $bestScore = (float) ($options[0]['score'] ?? 0.0);
    $scoreMargin = max(18.0, min(75.0, abs($bestScore) * 0.08));
    $minimumAllowed = min(count($options), max(1, min(3, (int) ceil(count($options) * 0.25))));
    $allowedIds = [];

    foreach ($options as $index => $option) {
        if ($index < $minimumAllowed || (float) $option['score'] <= $bestScore + $scoreMargin) {
            $allowedIds[] = (int) $option['id'];
        }
    }

    return [
        'allowed_ids' => array_values(array_unique($allowedIds)),
        'best_score' => $bestScore,
        'score_margin' => $scoreMargin,
    ];
}

function captain_goalkeeper_counts(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT mp.team_number, COUNT(*) AS goalkeeper_count
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid
           AND mp.team_number IS NOT NULL
           AND (p.positions = "ARQ" OR p.positions LIKE "ARQ/%")
         GROUP BY mp.team_number'
    );
    $stmt->execute(['mid' => $matchId]);
    $counts = [];
    foreach ($stmt->fetchAll() as $row) {
        $counts[(int) $row['team_number']] = (int) $row['goalkeeper_count'];
    }
    return $counts;
}

function captain_secondary_goalkeeper_counts(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT mp.team_number, COUNT(*) AS goalkeeper_count
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid
           AND mp.team_number IS NOT NULL
           AND p.positions LIKE "%/ARQ%"
           AND p.positions NOT LIKE "ARQ/%"
         GROUP BY mp.team_number'
    );
    $stmt->execute(['mid' => $matchId]);
    $counts = [];
    foreach ($stmt->fetchAll() as $row) {
        $counts[(int) $row['team_number']] = (int) $row['goalkeeper_count'];
    }
    return $counts;
}

function captain_pick_rule(int $matchId, array $available, array $draft): array
{
    if (!$available) {
        return [
            'active' => false,
            'enforced' => false,
            'mode' => 'complete',
            'active_pot' => null,
            'allowed_ids' => [],
            'message' => 'No quedan jugadores disponibles.',
        ];
    }

    $currentTeam = (int) ($draft['current_team'] ?? 0);
    $teamNumbers = captain_numbers($draft);
    $goalkeeperCounts = captain_goalkeeper_counts($matchId);
    $availableGoalkeepers = array_values(array_filter($available, static fn(array $player): bool => primary_position($player) === 'ARQ'));
    if (!$availableGoalkeepers) {
        $secondaryGoalkeeperCounts = captain_secondary_goalkeeper_counts($matchId);
        foreach ($secondaryGoalkeeperCounts as $teamNumber => $count) {
            if ($count > 0 && (($goalkeeperCounts[$teamNumber] ?? 0) <= 0)) {
                $goalkeeperCounts[$teamNumber] = 1;
            }
        }
    }
    $teamNeedsGoalkeeper = $currentTeam > 0 && (($goalkeeperCounts[$currentTeam] ?? 0) <= 0);
    $availableSecondaryGoalkeepers = array_values(array_filter($available, static fn(array $player): bool => primary_position($player) !== 'ARQ' && has_secondary_position($player, 'ARQ')));
    $pool = $available;
    $activePot = null;
    if ($teamNeedsGoalkeeper && $availableGoalkeepers) {
        $pool = $availableGoalkeepers;
        $activePot = 'ARQ';
    } elseif ($teamNeedsGoalkeeper && !$availableGoalkeepers && $availableSecondaryGoalkeepers) {
        $pool = $availableSecondaryGoalkeepers;
        $activePot = 'ARQ secundaria';
    } elseif ($availableGoalkeepers) {
        $teamsWithoutGoalkeeper = 0;
        foreach ($teamNumbers as $teamNumber) {
            if (($goalkeeperCounts[$teamNumber] ?? 0) <= 0) {
                $teamsWithoutGoalkeeper++;
            }
        }
        if ($teamsWithoutGoalkeeper > 0) {
            $pool = array_values(array_filter($available, static fn(array $player): bool => primary_position($player) !== 'ARQ'));
        }
    }

    if (!$pool) {
        $pool = $available;
    }

    $totals = captain_team_skill_totals($matchId);
    $currentTotal = $currentTeam > 0 ? (float) ($totals[$currentTeam]['total_skill'] ?? 0.0) : 0.0;
    $highestTotal = $currentTotal;
    foreach ($teamNumbers as $teamNumber) {
        $highestTotal = max($highestTotal, (float) ($totals[$teamNumber]['total_skill'] ?? 0.0));
    }

    $qualityOptions = captain_pick_rule_quality_options($matchId, $pool, $available, $draft);
    $allowedIds = $qualityOptions['allowed_ids'];
    $allowedLookup = array_flip($allowedIds);
    $allowedRatings = array_map(
        static fn(array $player): float => player_overall_rating($player),
        array_values(array_filter($pool, static fn(array $player): bool => isset($allowedLookup[(int) $player['id']])))
    );
    $maxAllowedRating = $allowedRatings ? max($allowedRatings) : 0.0;
    $maxProjectedTotal = $currentTotal + $maxAllowedRating;
    $scoreMargin = (float) ($qualityOptions['score_margin'] ?? 0.0);
    if ($activePot === 'ARQ') {
        return [
            'active' => true,
            'enforced' => true,
            'mode' => 'quality_balance',
            'active_pot' => $activePot,
            'reference_skill' => null,
            'current_total' => $currentTotal,
            'highest_total' => $highestTotal,
            'min_skill' => null,
            'max_skill' => max(0.0, $maxProjectedTotal - $currentTotal),
            'range' => $scoreMargin,
            'allowed_ids' => $allowedIds,
            'message' => 'Tu equipo necesita arquero. Elegi una opcion habilitada que mantenga mejor el balance general.',
        ];
    }
    if ($activePot === 'ARQ secundaria') {
        return [
            'active' => true,
            'enforced' => true,
            'mode' => 'quality_balance',
            'active_pot' => $activePot,
            'reference_skill' => null,
            'current_total' => $currentTotal,
            'highest_total' => $highestTotal,
            'min_skill' => null,
            'max_skill' => max(0.0, $maxProjectedTotal - $currentTotal),
            'range' => $scoreMargin,
            'allowed_ids' => $allowedIds,
            'message' => 'No quedan arqueros primarios. Elegi una opcion con ARQ secundaria que mantenga mejor el balance general.',
        ];
    }

    return [
        'active' => true,
        'enforced' => true,
        'mode' => 'quality_balance',
        'active_pot' => null,
        'reference_skill' => null,
        'current_total' => $currentTotal,
        'highest_total' => $highestTotal,
        'min_skill' => null,
        'max_skill' => max(0.0, $maxProjectedTotal - $currentTotal),
        'range' => $scoreMargin,
        'allowed_ids' => $allowedIds,
        'message' => 'Equilibrio integral: elegi una opcion habilitada por balance de equipo, lineas, stats y niveles.',
    ];
}

function captain_state(int $matchId): array
{
    $match = repo_match_by_id($matchId);
    if (!$match) {
        return ['ok' => false, 'message' => 'Fecha no encontrada'];
    }

    $draft = captain_draft_row($matchId);
    if (!$draft) {
        if (!is_admin() || !in_array((string) ($match['status'] ?? ''), ['sorteado', 'finalizado'], true)) {
            return ['ok' => false, 'message' => 'No hay modo capitanes iniciado para esta fecha'];
        }
    }

    $participants = repo_match_participants($matchId);
    $teamNumbers = $draft ? captain_numbers($draft) : array_map(static fn(array $team): int => (int) $team['team_number'], repo_match_teams($matchId));
    if (!$teamNumbers) {
        $teamNumbers = [1, 2];
    }
    $teams = [];
    foreach ($teamNumbers as $teamNumber) {
        $teams[$teamNumber] = [];
    }
    $available = [];

    foreach ($participants as $p) {
        $row = [
            'id' => (int) $p['id'],
            'name' => (string) $p['name'],
            'positions' => (string) $p['positions'],
            'primary_position' => primary_position($p),
            'pace' => (string) $p['pace'],
            'pace_label' => pace_label((string) $p['pace']),
            'photo_path' => player_photo_path($p),
            'has_custom_photo' => player_has_custom_photo($p),
            'photo_position_x' => player_photo_position_x($p),
            'photo_position_y' => player_photo_position_y($p),
            'photo_zoom' => player_photo_zoom($p),
            'skill' => player_overall_rating($p),
            'base_skill' => (float) $p['skill'],
            'technique' => player_effective_stat($p, 'technique'),
            'rhythm' => player_effective_stat($p, 'rhythm'),
            'defense_physical' => player_effective_stat($p, 'defense_physical'),
            'attack' => player_effective_stat($p, 'attack'),
            'teamwork' => player_effective_stat($p, 'teamwork'),
            'mentality' => player_effective_stat($p, 'mentality'),
            'regularity' => player_effective_stat($p, 'regularity'),
            'goalkeeper_skill' => player_effective_stat($p, 'goalkeeper_skill'),
            'team_number' => $p['team_number'] !== null ? (int) $p['team_number'] : null,
            'assigned_position' => $p['assigned_position'] !== null ? (string) $p['assigned_position'] : primary_position($p),
            'lineup_order' => $p['lineup_order'] !== null ? (int) $p['lineup_order'] : null,
            'formation_line_order' => $p['formation_line_order'] !== null ? (int) $p['formation_line_order'] : null,
        ];
        if (in_array((int) $row['team_number'], $teamNumbers, true)) {
            $teams[$row['team_number']][] = $row;
        } else {
            $available[] = $row;
        }
    }

    foreach ($teamNumbers as $teamNumber) {
        usort($teams[$teamNumber], static function (array $a, array $b): int {
            $positionOrder = ['ARQ' => 1, 'DEF' => 2, 'MED' => 3, 'DEL' => 4];
            $positionCompare = ($positionOrder[$a['assigned_position']] ?? 99) <=> ($positionOrder[$b['assigned_position']] ?? 99);
            if ($positionCompare !== 0) {
                return $positionCompare;
            }
            $lineOrderA = $a['formation_line_order'] ?? 999;
            $lineOrderB = $b['formation_line_order'] ?? 999;
            if ($lineOrderA !== $lineOrderB) {
                return $lineOrderA <=> $lineOrderB;
            }
            $lineupA = $a['lineup_order'] ?? 999;
            $lineupB = $b['lineup_order'] ?? 999;
            if ($lineupA !== $lineupB) {
                return $lineupA <=> $lineupB;
            }
            if ((float) $b['skill'] !== (float) $a['skill']) {
                return (float) $b['skill'] <=> (float) $a['skill'];
            }
            return strcmp((string) $a['name'], (string) $b['name']);
        });
    }
    usort($available, static function (array $a, array $b): int {
        $order = ['ARQ' => 1, 'DEF' => 2, 'MED' => 3, 'DEL' => 4];
        $pos = ($order[$a['primary_position']] ?? 99) <=> ($order[$b['primary_position']] ?? 99);
        if ($pos !== 0) {
            return $pos;
        }
        if ((float) $b['skill'] !== (float) $a['skill']) {
            return (float) $b['skill'] <=> (float) $a['skill'];
        }
        return strcmp((string) $a['name'], (string) $b['name']);
    });

    $pickRule = $draft ? captain_pick_rule($matchId, $available, $draft) : [
        'active' => false,
        'enforced' => false,
        'mode' => 'admin_formations',
        'allowed_ids' => [],
        'message' => '',
    ];
    $allowedLookup = array_flip(array_map('intval', $pickRule['allowed_ids'] ?? []));
    foreach ($available as &$player) {
        $player['pick_allowed'] = !$pickRule['enforced'] || isset($allowedLookup[(int) $player['id']]);
    }
    unset($player);

    $captainCount = $draft ? captain_count($draft) : max(2, count($teamNumbers));
    $targetTeamSize = count($participants) > 0 ? (int) (count($participants) / $captainCount) : 0;
    $currentTeam = $draft && $draft['current_team'] !== null ? (int) $draft['current_team'] : null;
    $teamLabels = repo_match_team_labels($match, repo_match_teams($matchId));
    $captains = [];
    foreach ($teamNumbers as $teamNumber) {
        $captains[$teamNumber] = [
            'id' => $draft ? (int) ($draft['captain' . $teamNumber . '_player_id'] ?? 0) : 0,
            'name' => $draft ? draft_captain_name($draft, $teamNumber) : (string) ($teamLabels[$teamNumber] ?? 'Equipo ' . $teamNumber),
            'color_name' => $draft ? trim((string) ($draft['captain' . $teamNumber . '_color_name'] ?? '')) : '',
        ];
    }

    return [
        'ok' => true,
        'match' => [
            'id' => (int) $match['id'],
            'title' => (string) ($match['title'] ?: 'Fecha #' . $match['id']),
            'status' => (string) $match['status'],
            'match_date' => (string) $match['match_date'],
            'participants_count' => count($participants),
            'target_team_size' => $targetTeamSize,
            'team_numbers' => $teamNumbers,
            'captain_count' => $captainCount,
            'can_edit_formations' => can_edit_captain_formation($match),
        ],
        'draft' => [
            'status' => $draft ? (string) $draft['status'] : 'completed',
            'current_team' => $currentTeam,
            'current_captain' => $draft && $currentTeam ? draft_captain_name($draft, $currentTeam) : '',
            'captains' => $captains,
        ],
        'teams' => $teams,
        'available' => $available,
        'pick_rule' => $pickRule,
    ];
}

function finish_captain_draft(int $matchId): void
{
    $pdo = db();
    $stmtDraft = $pdo->prepare('SELECT * FROM captain_drafts WHERE match_id = :mid LIMIT 1');
    $stmtDraft->execute(['mid' => $matchId]);
    $draft = $stmtDraft->fetch() ?: [];
    $participants = repo_match_participants($matchId);
    $teamNumbers = $draft ? captain_numbers($draft) : [1, 2];
    $teams = [];
    foreach ($teamNumbers as $teamNumber) {
        $teams[$teamNumber] = [];
    }
    foreach ($participants as $p) {
        $teamNumber = $p['team_number'] !== null ? (int) $p['team_number'] : 0;
        if (in_array($teamNumber, $teamNumbers, true)) {
            $teams[$teamNumber][] = $p;
        }
    }

    $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $saveTeam = $pdo->prepare(
        'INSERT INTO match_teams (match_id, team_number, team_name, captain_player_id, total_skill, formation_name, formation_data, color_name)
         VALUES (:mid, :team_number, :team_name, :captain_player_id, :total_skill, :formation_name, :formation_data, :color_name)'
    );
    $savePlayer = $pdo->prepare(
        'UPDATE match_players
         SET assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper, lineup_order = :lineup_order, formation_line_order = :formation_line_order
         WHERE match_id = :mid AND player_id = :pid'
    );

    foreach ($teamNumbers as $teamNumber) {
        $team = $teams[$teamNumber];
        $assignmentData = build_team_position_assignment($team);
        $totalSkill = 0.0;
        foreach ($team as $p) {
            $line = $assignmentData['assignment'][(int) $p['id']] ?? primary_position($p);
            $totalSkill += player_overall_rating($p);
        }
        $lineCounts = array_fill_keys(player_formation_lines(), 0);
        foreach ($team as $p) {
            $line = $assignmentData['assignment'][(int) $p['id']] ?? primary_position($p);
            $lineCounts[$line] = ($lineCounts[$line] ?? 0) + 1;
        }
        $saveTeam->execute([
            'mid' => $matchId,
            'team_number' => $teamNumber,
            'team_name' => 'Equipo ' . $teamNumber,
            'captain_player_id' => $draft['captain' . $teamNumber . '_player_id'] ?? null,
            'total_skill' => $totalSkill,
            'formation_name' => captain_formation_name_from_counts($lineCounts),
            'formation_data' => json_encode(array_map(static function (array $p) use ($assignmentData): array {
                $line = $assignmentData['assignment'][(int) $p['id']] ?? primary_position($p);
                return ['id' => (int) $p['id'], 'position' => $line];
            }, $team), JSON_UNESCAPED_UNICODE),
            'color_name' => trim((string) ($draft['captain' . $teamNumber . '_color_name'] ?? '')),
        ]);
        $lineOrder = array_fill_keys(player_formation_lines(), 0);
        foreach ($team as $lineupIndex => $p) {
            $line = $assignmentData['assignment'][(int) $p['id']] ?? primary_position($p);
            $lineOrder[$line] = ($lineOrder[$line] ?? 0) + 1;
            $savePlayer->execute([
                'mid' => $matchId,
                'pid' => (int) $p['id'],
                'assigned_position' => $line,
                'is_goalkeeper' => $line === 'ARQ' ? 1 : 0,
                'lineup_order' => $lineupIndex + 1,
                'formation_line_order' => $lineOrder[$line],
            ]);
        }
    }

    $pdo->prepare(
        'UPDATE matches
         SET status = "sorteado", draw_mode = "captains", draw_completed_at = NOW(), formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
         WHERE id = :mid'
    )->execute(['mid' => $matchId]);
    $pdo->prepare('UPDATE captain_drafts SET status = "completed", current_team = NULL, completed_at = NOW() WHERE match_id = :mid')->execute(['mid' => $matchId]);
}

$action = (string) ($_GET['action'] ?? $_POST['action'] ?? '');

if ($action === 'state') {
    $matchId = (int) ($_GET['match_id'] ?? 0);
    json_response(captain_state($matchId));
}

if (!in_array($action, ['pick', 'save_formation', 'save_all_formations'], true) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Accion no valida'], 400);
}

$data = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($data)) {
    json_response(['ok' => false, 'message' => 'JSON invalido'], 400);
}

$matchId = (int) ($data['match_id'] ?? 0);
$teamNumber = (int) ($data['team_number'] ?? 0);
$playerId = (int) ($data['player_id'] ?? 0);
$token = trim((string) ($data['token'] ?? ''));
if (
    $matchId <= 0
    || ($action !== 'save_all_formations' && !in_array($teamNumber, [1, 2, 3, 4], true))
    || ($action === 'pick' && $playerId <= 0)
) {
    json_response(['ok' => false, 'message' => 'Datos incompletos'], 422);
}

$pdo = db();
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT * FROM captain_drafts WHERE match_id = :mid FOR UPDATE');
    $stmt->execute(['mid' => $matchId]);
    $draft = $stmt->fetch();
    if (!$draft && !(in_array($action, ['save_formation', 'save_all_formations'], true) && is_admin())) {
        throw new RuntimeException('No hay draft de capitanes para esta fecha.');
    }
    if ($action === 'pick' && $draft['status'] !== 'active') {
        throw new RuntimeException('El draft no esta activo.');
    }
    if ($action === 'pick' && (int) $draft['current_team'] !== $teamNumber) {
        throw new RuntimeException('No es el turno de este capitan.');
    }

    $captainId = $draft ? (int) ($draft['captain' . $teamNumber . '_player_id'] ?? 0) : 0;
    $expectedToken = $draft ? (string) ($draft['captain' . $teamNumber . '_token'] ?? '') : '';
    $isAdminFormationSave = in_array($action, ['save_formation', 'save_all_formations'], true) && is_admin();
    if (!$isAdminFormationSave && ($expectedToken === '' || $token === '' || !hash_equals($expectedToken, $token))) {
        throw new RuntimeException('Token de capitan invalido.');
    }

    if ($action === 'save_all_formations') {
        if (!is_admin()) {
            throw new RuntimeException('Solo el admin puede guardar formaciones entre equipos.');
        }
        $match = repo_match_by_id($matchId);
        if (!$match) {
            throw new RuntimeException('Fecha no encontrada.');
        }
        if ($draft && (string) $draft['status'] !== 'completed') {
            throw new RuntimeException('La formacion se puede ajustar cuando el draft esta completo.');
        }
        if (!$draft && !in_array((string) ($match['status'] ?? ''), ['sorteado', 'finalizado'], true)) {
            throw new RuntimeException('La formacion se puede ajustar cuando los equipos ya estan generados.');
        }
        if (!can_edit_captain_formation($match)) {
            throw new RuntimeException('La formacion no se puede editar para esta fecha.');
        }

        $teamsPayload = $data['teams'] ?? [];
        if (!is_array($teamsPayload) || !$teamsPayload) {
            throw new RuntimeException('Datos de formacion invalidos.');
        }
        $allowed = player_formation_lines();
        $matchTeams = repo_match_teams($matchId);
        $validTeams = array_flip(array_map(static fn(array $team): int => (int) $team['team_number'], $matchTeams));
        $participants = repo_match_participants($matchId);
        $validPlayers = [];
        foreach ($participants as $player) {
            $validPlayers[(int) $player['id']] = $player;
        }

        $rows = [];
        $seen = [];
        foreach ($teamsPayload as $teamPayload) {
            if (!is_array($teamPayload)) {
                continue;
            }
            $payloadTeamNumber = (int) ($teamPayload['team_number'] ?? 0);
            if (!isset($validTeams[$payloadTeamNumber])) {
                throw new RuntimeException('Equipo invalido en la formacion.');
            }
            $assignments = $teamPayload['assignments'] ?? [];
            if (!is_array($assignments)) {
                continue;
            }
            foreach ($assignments as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $pid = (int) ($row['player_id'] ?? 0);
                $position = strtoupper(trim((string) ($row['assigned_position'] ?? '')));
                if ($pid <= 0 || !isset($validPlayers[$pid]) || !in_array($position, $allowed, true)) {
                    continue;
                }
                if (isset($seen[$pid])) {
                    throw new RuntimeException('Un jugador aparece repetido en la formacion.');
                }
                $seen[$pid] = true;
                $rows[] = [
                    'player_id' => $pid,
                    'team_number' => $payloadTeamNumber,
                    'position' => $position,
                    'player' => $validPlayers[$pid],
                ];
            }
        }
        if (count($seen) !== count($validPlayers)) {
            throw new RuntimeException('La formacion debe incluir a todos los jugadores de la fecha.');
        }

        $teamLineCounts = [];
        foreach (array_keys($validTeams) as $rowTeamNumber) {
            $teamLineCounts[(int) $rowTeamNumber] = array_fill_keys(player_formation_lines(), 0);
        }
        foreach ($rows as $row) {
            $rowTeamNumber = (int) $row['team_number'];
            $position = (string) $row['position'];
            $teamLineCounts[$rowTeamNumber][$position] = ($teamLineCounts[$rowTeamNumber][$position] ?? 0) + 1;
        }
        foreach ($teamLineCounts as $counts) {
            validate_captain_formation_line_counts($counts);
        }

        $update = $pdo->prepare(
            'UPDATE match_players
             SET team_number = :team_number, assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper,
                 lineup_order = :lineup_order, formation_line_order = :formation_line_order
             WHERE match_id = :mid AND player_id = :pid'
        );
        $lineOrder = [];
        $lineupOrder = [];
        foreach ($rows as $row) {
            $rowTeamNumber = (int) $row['team_number'];
            $position = (string) $row['position'];
            $lineOrder[$rowTeamNumber] = $lineOrder[$rowTeamNumber] ?? array_fill_keys(player_formation_lines(), 0);
            $lineupOrder[$rowTeamNumber] = ($lineupOrder[$rowTeamNumber] ?? 0) + 1;
            $lineOrder[$rowTeamNumber][$position]++;
            $update->execute([
                'mid' => $matchId,
                'pid' => (int) $row['player_id'],
                'team_number' => $rowTeamNumber,
                'assigned_position' => $position,
                'is_goalkeeper' => $position === 'ARQ' ? 1 : 0,
                'lineup_order' => $lineupOrder[$rowTeamNumber],
                'formation_line_order' => $lineOrder[$rowTeamNumber][$position],
            ]);
        }

        $updateTeam = $pdo->prepare(
            'UPDATE match_teams
             SET total_skill = :total_skill, formation_name = :formation_name, formation_data = :formation_data
             WHERE match_id = :mid AND team_number = :team_number'
        );
        foreach (array_keys($validTeams) as $rowTeamNumber) {
            $teamRows = array_values(array_filter($rows, static fn(array $row): bool => (int) $row['team_number'] === (int) $rowTeamNumber));
            $counts = array_fill_keys(player_formation_lines(), 0);
            $totalSkill = 0.0;
            foreach ($teamRows as $row) {
                $counts[(string) $row['position']]++;
                $totalSkill += player_overall_rating((array) $row['player']);
            }
            $updateTeam->execute([
                'mid' => $matchId,
                'team_number' => (int) $rowTeamNumber,
                'total_skill' => $totalSkill,
                'formation_name' => captain_formation_name_from_counts($counts),
                'formation_data' => json_encode(array_map(static fn(array $row): array => [
                    'id' => (int) $row['player_id'],
                    'position' => (string) $row['position'],
                ], $teamRows), JSON_UNESCAPED_UNICODE),
            ]);
        }

        $pdo->commit();
        json_response(captain_state($matchId));
    }

    if ($action === 'save_formation') {
        $match = repo_match_by_id($matchId);
        if (!$match) {
            throw new RuntimeException('Fecha no encontrada.');
        }
        if ($draft && (string) $draft['status'] !== 'completed') {
            throw new RuntimeException('La formacion se puede ajustar cuando el draft esta completo.');
        }
        if (!$draft && !in_array((string) ($match['status'] ?? ''), ['sorteado', 'finalizado'], true)) {
            throw new RuntimeException('La formacion se puede ajustar cuando los equipos ya estan generados.');
        }
        if (!can_edit_captain_formation($match)) {
            throw new RuntimeException('La formacion no se puede editar para esta fecha.');
        }
        $assignments = $data['assignments'] ?? [];
        if (!is_array($assignments)) {
            throw new RuntimeException('Datos de formacion invalidos.');
        }
        $allowed = player_formation_lines();
        $lineOrder = array_fill_keys(player_formation_lines(), 0);
        $formationData = [];
        $validRows = [];
        foreach ($assignments as $index => $row) {
            if (!is_array($row)) {
                continue;
            }
            $pid = (int) ($row['player_id'] ?? 0);
            $position = strtoupper(trim((string) ($row['assigned_position'] ?? '')));
            if ($pid <= 0 || !in_array($position, $allowed, true)) {
                continue;
            }
            $lineOrder[$position] = ($lineOrder[$position] ?? 0) + 1;
            $formationData[] = ['id' => $pid, 'position' => $position];
            $validRows[] = [
                'player_id' => $pid,
                'position' => $position,
                'lineup_order' => $index + 1,
                'formation_line_order' => $lineOrder[$position],
            ];
        }
        validate_captain_formation_line_counts($lineOrder);

        $teamPlayers = array_values(array_filter(
            repo_match_participants($matchId),
            static fn(array $player): bool => (int) ($player['team_number'] ?? 0) === $teamNumber
        ));
        $teamPlayerLookup = [];
        foreach ($teamPlayers as $player) {
            $teamPlayerLookup[(int) $player['id']] = $player;
        }
        if (count($validRows) !== count($teamPlayerLookup)) {
            throw new RuntimeException('La formacion debe incluir a todos los jugadores del equipo.');
        }
        foreach ($validRows as $row) {
            if (!isset($teamPlayerLookup[(int) $row['player_id']])) {
                throw new RuntimeException('La formacion incluye un jugador de otro equipo.');
            }
        }

        $update = $pdo->prepare(
            'UPDATE match_players
             SET assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper, lineup_order = :lineup_order, formation_line_order = :formation_line_order
             WHERE match_id = :mid AND player_id = :pid AND team_number = :team'
        );
        foreach ($validRows as $row) {
            $update->execute([
                'mid' => $matchId,
                'pid' => (int) $row['player_id'],
                'team' => $teamNumber,
                'assigned_position' => (string) $row['position'],
                'is_goalkeeper' => (string) $row['position'] === 'ARQ' ? 1 : 0,
                'lineup_order' => (int) $row['lineup_order'],
                'formation_line_order' => (int) $row['formation_line_order'],
            ]);
        }
        $pdo->prepare(
            'UPDATE match_teams
             SET total_skill = :total_skill, formation_name = :formation_name, formation_data = :formation_data
             WHERE match_id = :mid AND team_number = :team'
        )->execute([
            'mid' => $matchId,
            'team' => $teamNumber,
            'total_skill' => array_reduce($validRows, static function (float $sum, array $row) use ($teamPlayerLookup): float {
                return $sum + player_overall_rating($teamPlayerLookup[(int) $row['player_id']]);
            }, 0.0),
            'formation_name' => captain_formation_name_from_counts($lineOrder),
            'formation_data' => json_encode($formationData, JSON_UNESCAPED_UNICODE),
        ]);
        $pdo->commit();
        json_response(captain_state($matchId));
    }

    $playerStmt = $pdo->prepare(
        'SELECT mp.player_id, mp.team_number
         FROM match_players mp
         WHERE mp.match_id = :mid AND mp.player_id = :pid
         LIMIT 1
         FOR UPDATE'
    );
    $playerStmt->execute(['mid' => $matchId, 'pid' => $playerId]);
    $row = $playerStmt->fetch();
    if (!$row) {
        throw new RuntimeException('El jugador no pertenece a esta fecha.');
    }
    if ($row['team_number'] !== null) {
        throw new RuntimeException('Ese jugador ya fue elegido.');
    }

    $targetSize = (int) ($pdo->query('SELECT COUNT(*) FROM match_players WHERE match_id = ' . $matchId)->fetchColumn() / captain_count($draft));
    $teamCountStmt = $pdo->prepare('SELECT COUNT(*) FROM match_players WHERE match_id = :mid AND team_number = :team');
    $teamCountStmt->execute(['mid' => $matchId, 'team' => $teamNumber]);
    if ((int) $teamCountStmt->fetchColumn() >= $targetSize) {
        throw new RuntimeException('Ese equipo ya esta completo.');
    }

    $draftDetails = captain_draft_row($matchId);
    if (!$draftDetails) {
        throw new RuntimeException('No hay draft de capitanes para esta fecha.');
    }
    $availableStmt = $pdo->prepare(
        'SELECT p.id, p.name, p.positions, p.pace, p.skill, p.photo_path, p.photo_position_x, p.photo_position_y, p.photo_zoom,
                p.technique, p.pass_vision, p.rhythm, p.stamina, p.defense_physical, p.attack, p.teamwork, p.mentality, p.regularity, p.goalkeeper_skill
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid AND mp.team_number IS NULL'
    );
    $availableStmt->execute(['mid' => $matchId]);
    $pickRule = captain_pick_rule($matchId, $availableStmt->fetchAll(), $draftDetails);
    if ($pickRule['enforced'] && !in_array($playerId, array_map('intval', $pickRule['allowed_ids'] ?? []), true)) {
        $activePot = (string) ($pickRule['active_pot'] ?? '');
        if ($activePot !== '') {
            throw new RuntimeException('Pote activo: ' . $activePot . '. Debes elegir un jugador habilitado de esa posicion.');
        }
        if (($pickRule['mode'] ?? '') === 'initial') {
            throw new RuntimeException('Primera eleccion restringida: debes elegir un jugador con el puntaje habilitado por el capitan rival.');
        }
        throw new RuntimeException('Por equilibrio, este turno solo permite elegir jugadores dentro del rango habilitado.');
    }

    $orderStmt = $pdo->prepare('SELECT COALESCE(MAX(pick_order), 0) + 1 FROM captain_picks WHERE match_id = :mid');
    $orderStmt->execute(['mid' => $matchId]);
    $pickOrder = (int) $orderStmt->fetchColumn();

    $pdo->prepare(
        'INSERT INTO captain_picks (match_id, player_id, team_number, picked_by_player_id, pick_order)
         VALUES (:mid, :pid, :team, :picker, :pick_order)'
    )->execute([
        'mid' => $matchId,
        'pid' => $playerId,
        'team' => $teamNumber,
        'picker' => $captainId,
        'pick_order' => $pickOrder,
    ]);
    $pdo->prepare(
        'UPDATE match_players SET team_number = :team WHERE match_id = :mid AND player_id = :pid'
    )->execute(['team' => $teamNumber, 'mid' => $matchId, 'pid' => $playerId]);

    $remainingStmt = $pdo->prepare('SELECT COUNT(*) FROM match_players WHERE match_id = :mid AND team_number IS NULL');
    $remainingStmt->execute(['mid' => $matchId]);
    $remaining = (int) $remainingStmt->fetchColumn();
    if ($remaining === 0) {
        finish_captain_draft($matchId);
    } else {
        $nextTeam = captain_next_team_by_lowest_total_skill($matchId, $draft);
        $pdo->prepare('UPDATE captain_drafts SET current_team = :team WHERE match_id = :mid')
            ->execute(['team' => $nextTeam, 'mid' => $matchId]);
    }

    $pdo->commit();
    json_response(captain_state($matchId));
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['ok' => false, 'message' => $e->getMessage()], 409);
}
