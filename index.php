<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/directivos.php';
require_once __DIR__ . '/lib/sorteo_multiple.php';

ensure_control_schema();
ensure_multiple_draw_schema();
directive_publish_due_results();

$showHistoryPage = defined('SHOW_HISTORY_PAGE') && SHOW_HISTORY_PAGE;
$title = ($showHistoryPage ? 'Historial' : 'Inicio') . ' | ' . APP_NAME;
$activePage = $showHistoryPage ? 'historial.php' : 'index.php';

function home_player_card_rating(float $value): int
{
    $clamped = max(1.0, min(6.0, $value));
    $anchorPoints = [
        [1.0, 35.0],
        [2.5, 54.0],
        [3.0, 64.0],
        [3.2, 69.0],
        [3.5, 74.0],
        [3.8, 79.0],
        [4.0, 81.0],
        [4.4, 86.0],
        [4.5, 87.0],
        [5.0, 92.0],
        [5.2, 93.0],
        [5.3, 94.0],
        [6.0, 98.0],
    ];

    for ($i = 0, $count = count($anchorPoints) - 1; $i < $count; $i++) {
        [$fromRating, $fromOverall] = $anchorPoints[$i];
        [$toRating, $toOverall] = $anchorPoints[$i + 1];
        if ($clamped <= $toRating) {
            $ratio = ($clamped - $fromRating) / ($toRating - $fromRating);
            return (int) round($fromOverall + (($toOverall - $fromOverall) * $ratio));
        }
    }

    return 98;
}

function render_player_card_rating(float $value, string $label = 'GEN'): string
{
    return '<span class="player-card-rating" title="Puntaje tarjeta"><strong>'
        . h((string) home_player_card_rating($value))
        . '</strong>'
        . ($label !== '' ? '<span>' . h(strtoupper($label)) . '</span>' : '')
        . '</span>';
}

function home_player_card_tier(float $value): string
{
    $overall = home_player_card_rating($value);
    if ($overall >= 90) {
        return 'elite';
    }
    if ($overall >= 80) {
        return 'gold';
    }
    if ($overall >= 65) {
        return 'silver';
    }
    return 'bronze';
}

function home_player_card_stat_value(array $player, string $field): int
{
    return home_player_card_rating(player_effective_stat($player, $field));
}

function home_player_card_regularity_form(array $player): array
{
    $rating = normalize_player_stat(player_effective_stat($player, 'regularity'), 3.5);
    if ($rating >= 4.5) {
        return ['up', 'Regularidad alta'];
    }
    if ($rating < 3.0) {
        return ['down', 'Regularidad baja'];
    }
    return ['right', 'Regularidad normal'];
}

function home_player_card_stats(array $player, string $position): array
{
    if ($position === 'ARQ') {
        return [
            'ARQ' => home_player_card_stat_value($player, 'goalkeeper_skill'),
            'RIT' => home_player_card_stat_value($player, 'rhythm'),
            'DEF' => home_player_card_stat_value($player, 'defense_physical'),
            'TEC' => home_player_card_stat_value($player, 'technique'),
            'EQU' => home_player_card_stat_value($player, 'teamwork'),
            'MEN' => home_player_card_stat_value($player, 'mentality'),
        ];
    }

    return [
        'TEC' => home_player_card_stat_value($player, 'technique'),
        'RIT' => home_player_card_stat_value($player, 'rhythm'),
        'DEF' => home_player_card_stat_value($player, 'defense_physical'),
        'ATA' => home_player_card_stat_value($player, 'attack'),
        'EQU' => home_player_card_stat_value($player, 'teamwork'),
        'MEN' => home_player_card_stat_value($player, 'mentality'),
    ];
}

function render_home_player_card_stats(array $player, string $position): string
{
    $html = '<span class="formation-card-stats" aria-label="Stats del jugador">';
    foreach (home_player_card_stats($player, $position) as $label => $value) {
        $html .= '<span class="formation-card-stat"><span>' . h($label) . '</span><strong>' . h((string) $value) . '</strong></span>';
    }
    $html .= '</span>';
    return $html;
}

function render_home_player_card_regularity(array $player): string
{
    [$form, $label] = home_player_card_regularity_form($player);
    return '<span class="formation-card-regularity is-' . h($form) . '" title="' . h($label) . '" aria-label="' . h($label) . '"></span>';
}

function home_position_base_rating(array $player, string $position): float
{
    $position = strtoupper($position);
    if ($position === 'ARQ') {
        $goalkeeperSkill = in_array('ARQ', parse_positions_csv((string) ($player['positions'] ?? '')), true)
            ? player_effective_stat($player, 'goalkeeper_skill')
            : 2.0;
        return player_apply_regularity_adjustment(
            ($goalkeeperSkill * 0.42)
            + (player_effective_stat($player, 'defense_physical') * 0.14)
            + (player_effective_stat($player, 'rhythm') * 0.10)
            + (player_effective_stat($player, 'technique') * 0.10)
            + (player_effective_stat($player, 'teamwork') * 0.14)
            + (player_effective_stat($player, 'mentality') * 0.10),
            $player
        );
    }
    if ($position === 'DEF') {
        return player_apply_regularity_adjustment(array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('DEF')),
            player_field_stat_weights('DEF')
        )), $player);
    }
    if ($position === 'LAT') {
        return player_apply_regularity_adjustment(array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('LAT')),
            player_field_stat_weights('LAT')
        )), $player);
    }
    if ($position === 'MED') {
        return player_apply_regularity_adjustment(array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('MED')),
            player_field_stat_weights('MED')
        )), $player);
    }
    if ($position === 'DEL') {
        return player_apply_regularity_adjustment(array_sum(array_map(
            static fn(string $field, float $weight): float => player_effective_stat($player, $field) * $weight,
            array_keys(player_field_stat_weights('DEL')),
            player_field_stat_weights('DEL')
        )), $player);
    }

    return player_overall_rating($player);
}

function home_adjusted_position_rating(array $player, string $position): float
{
    $position = strtoupper($position);
    if ($position === '') {
        return player_overall_rating($player);
    }

    return max(1.0, min(6.0, home_position_base_rating($player, $position)));
}

$pdo = db();
$matches = $pdo->query(
    "SELECT m.*,
            (SELECT COUNT(*) FROM match_players mp WHERE mp.match_id = m.id) AS participants_count
     FROM matches m
     ORDER BY
       CASE WHEN m.match_date >= NOW() AND m.status <> 'finalizado' THEN 0 ELSE 1 END ASC,
       CASE WHEN m.match_date >= NOW() AND m.status <> 'finalizado' THEN m.match_date END ASC,
       CASE WHEN m.match_date < NOW() OR m.status = 'finalizado' THEN m.match_date END DESC"
)->fetchAll();

$historyMatches = $matches;
usort($historyMatches, static function (array $a, array $b): int {
    $dateComparison = strtotime((string) $b['match_date']) <=> strtotime((string) $a['match_date']);
    return $dateComparison ?: ((int) $b['id'] <=> (int) $a['id']);
});

$nextMatchId = 0;
$futureMatches = array_values(array_filter($matches, static function (array $match): bool {
    return (string) $match['status'] !== 'finalizado'
        && strtotime((string) $match['match_date']) >= time();
}));
usort($futureMatches, static function (array $a, array $b): int {
    $dateComparison = strtotime((string) $a['match_date']) <=> strtotime((string) $b['match_date']);
    return $dateComparison ?: ((int) $a['id'] <=> (int) $b['id']);
});
if ($futureMatches) {
    $nextMatchId = (int) $futureMatches[0]['id'];
}

$historyTeamsByMatch = [];
$historyCaptainNames = [];
$historyAwardCounts = [];
$historyRatingCounts = [];
$historyMatchIds = array_map(static fn(array $match): int => (int) $match['id'], $matches);
if ($historyMatchIds) {
    $in = implode(',', array_fill(0, count($historyMatchIds), '?'));
    $stmtHistoryTeams = $pdo->prepare(
        "SELECT *
         FROM match_teams
         WHERE match_id IN ($in)
         ORDER BY match_id ASC, team_number ASC"
    );
    $stmtHistoryTeams->execute($historyMatchIds);
    $historyCaptainIds = [];
    foreach ($stmtHistoryTeams->fetchAll() as $teamRow) {
        $historyTeamsByMatch[(int) $teamRow['match_id']][] = $teamRow;
        if (!empty($teamRow['captain_player_id'])) {
            $historyCaptainIds[(int) $teamRow['captain_player_id']] = true;
        }
    }
    if ($historyCaptainIds) {
        $captainIds = array_keys($historyCaptainIds);
        $captainIn = implode(',', array_fill(0, count($captainIds), '?'));
        $stmtCaptains = $pdo->prepare("SELECT id, name FROM players WHERE id IN ($captainIn)");
        $stmtCaptains->execute($captainIds);
        foreach ($stmtCaptains->fetchAll() as $captainRow) {
            $historyCaptainNames[(int) $captainRow['id']] = (string) $captainRow['name'];
        }
    }

    $stmtAwardCounts = $pdo->prepare(
        "SELECT match_id, COUNT(*) AS award_count
         FROM match_awards
         WHERE match_id IN ($in)
         GROUP BY match_id"
    );
    $stmtAwardCounts->execute($historyMatchIds);
    foreach ($stmtAwardCounts->fetchAll() as $awardRow) {
        $historyAwardCounts[(int) $awardRow['match_id']] = (int) $awardRow['award_count'];
    }

    $stmtRatingCounts = $pdo->prepare(
        "SELECT match_id,
                COUNT(*) AS player_count,
                SUM(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) AS rated_count
         FROM match_players
         WHERE match_id IN ($in)
         GROUP BY match_id"
    );
    $stmtRatingCounts->execute($historyMatchIds);
    foreach ($stmtRatingCounts->fetchAll() as $ratingRow) {
        $historyRatingCounts[(int) $ratingRow['match_id']] = [
            'player_count' => (int) $ratingRow['player_count'],
            'rated_count' => (int) $ratingRow['rated_count'],
        ];
    }
}

$requestedMatchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$selectedMatch = null;
if ($requestedMatchId > 0) {
    $selectedMatch = repo_match_by_id($requestedMatchId);
}
if (!$showHistoryPage && !$selectedMatch && $futureMatches) {
    $selectedMatch = repo_match_by_id((int) $futureMatches[0]['id']);
}
if (!$selectedMatch && $matches) {
    $selectedMatch = repo_match_by_id((int) $matches[0]['id']);
}

$latestFinalizedMatch = null;
foreach ($historyMatches as $historyMatch) {
    $historyTeams = $historyTeamsByMatch[(int) ($historyMatch['id'] ?? 0)] ?? [];
    if (repo_match_has_saved_result($historyMatch, $historyTeams)) {
        $latestFinalizedMatch = $historyMatch;
        break;
    }
}

$selectedMatchId = $selectedMatch ? (int) $selectedMatch['id'] : 0;
$participants = $selectedMatchId > 0 ? repo_match_participants($selectedMatchId) : [];
$resultParticipants = $participants;
usort($resultParticipants, static function (array $a, array $b): int {
    $ratingA = $a['rating'] !== null ? (float) $a['rating'] : -1.0;
    $ratingB = $b['rating'] !== null ? (float) $b['rating'] : -1.0;
    return ($ratingB <=> $ratingA)
        ?: ((int) ($b['goals'] ?? 0) <=> (int) ($a['goals'] ?? 0))
        ?: strcasecmp((string) $a['name'], (string) $b['name']);
});
$groupedTeams = $selectedMatchId > 0 ? repo_grouped_team_players($selectedMatchId) : [];
$teamTotals = $selectedMatchId > 0 ? repo_team_totals($selectedMatchId) : [];
$matchTeams = $selectedMatchId > 0 ? repo_match_teams($selectedMatchId) : [];
$teamLabels = $selectedMatch && $matchTeams ? repo_match_team_labels($selectedMatch, $matchTeams) : [];
$roundRobinResults = $selectedMatchId > 0 && count($matchTeams) > 2 ? public_round_robin_results($selectedMatchId) : [];
$teamGoals = [];
$matchAwards = [];
$matchAverageRating = null;
$awardDefinitions = award_definitions();
$awardDescriptions = [
    'player_of_match' => 'Jugador de la fecha.',
    'goal_of_week' => 'Mejor gol de la fecha.',
    'lyrical' => 'Jugada fantastica o recurso tecnico destacado.',
    'wall' => 'Mejor defensor de la fecha.',
    'capocannoniere' => 'Goleador destacado de la fecha.',
    'terminator' => 'Jugador mas bruto o jugada mas fuerte.',
    'tractor' => 'Jugador mas aguerrido e intenso.',
    'guinda' => 'Mejor pase o asistencia.',
    'putita' => 'Jugador no comprometido o problematico.',
    'ghost' => 'Jugador que erro mucho o participo poco.',
    'keeper' => 'Mejor arquero de la fecha.',
    'goodfellas' => 'Mejor actitud y buen compañero.',
];
$savedMatchAwards = $selectedMatchId > 0 ? repo_match_awards($selectedMatchId) : [];
$playerAwardIcons = [];
foreach ($savedMatchAwards as $awardCode => $awardRow) {
    $awardPlayerId = (int) ($awardRow['player_id'] ?? 0);
    if ($awardPlayerId <= 0 || !isset($awardDefinitions[$awardCode])) {
        continue;
    }
    $playerAwardIcons[$awardPlayerId][] = [
        'icon' => (string) $awardDefinitions[$awardCode]['icon'],
        'label' => (string) $awardDefinitions[$awardCode]['label'],
    ];
}

foreach ($matchTeams as $team) {
    $teamNumber = (int) $team['team_number'];
    $teamGoals[$teamNumber] = (int) ($team['goals'] ?? 0);
}
ksort($teamGoals);

if ($selectedMatch && (string) $selectedMatch['status'] === 'finalizado' && $participants) {
    $ratedPlayers = array_values(array_filter($participants, static fn(array $p): bool => $p['rating'] !== null));
    if ($ratedPlayers) {
        $matchAverageRating = array_sum(array_map(static fn(array $p): float => (float) $p['rating'], $ratedPlayers)) / count($ratedPlayers);
    }
    usort($ratedPlayers, static fn(array $a, array $b): int => ((float) $b['rating'] <=> (float) $a['rating']) ?: strcasecmp((string) $a['name'], (string) $b['name']));
    if (!$savedMatchAwards && $ratedPlayers) {
        $matchAwards[] = ['label' => 'Figura', 'value' => (string) $ratedPlayers[0]['name'] . ' (' . number_format((float) $ratedPlayers[0]['rating'], 1) . ')'];
    }

    $goalPlayers = array_values(array_filter($participants, static fn(array $p): bool => (int) ($p['goals'] ?? 0) > 0));
    usort($goalPlayers, static fn(array $a, array $b): int => ((int) $b['goals'] <=> (int) $a['goals']) ?: strcasecmp((string) $a['name'], (string) $b['name']));
    if (!$savedMatchAwards && $goalPlayers) {
        $matchAwards[] = ['label' => 'Goleador', 'value' => (string) $goalPlayers[0]['name'] . ' (' . (int) $goalPlayers[0]['goals'] . ')'];
    }

    if (!$savedMatchAwards && $teamGoals) {
        $maxGoals = max($teamGoals);
        $winningTeams = array_keys(array_filter($teamGoals, static fn(int $goals): bool => $goals === $maxGoals));
        $matchAwards[] = [
            'label' => count($winningTeams) === 1 ? 'Ganador' : 'Resultado',
            'value' => count($winningTeams) === 1 ? ($teamLabels[(int) $winningTeams[0]] ?? ('Equipo ' . (int) $winningTeams[0])) : 'Empate',
        ];
    }

    foreach ($awardDefinitions as $code => $award) {
        if (!isset($savedMatchAwards[$code])) {
            continue;
        }
        $matchAwards[] = [
            'label' => (string) $award['icon'] . ' ' . (string) $award['label'],
            'value' => (string) $savedMatchAwards[$code]['name'],
        ];
    }
}

function team_score_line(array $teamGoals, array $teamLabels = []): string
{
    if (!$teamGoals) {
        return 'Sin resultado cargado';
    }
    $parts = [];
    foreach ($teamGoals as $team => $goals) {
        $label = $teamLabels[(int) $team] ?? ('Equipo ' . (int) $team);
        $parts[] = $label . ' ' . (int) $goals;
    }
    return implode(' - ', $parts);
}

function render_match_scoreboard(array $teamGoals, array $teamLabels = [], bool $showMultiGoals = true): string
{
    if (!$teamGoals) {
        return h('Sin resultado cargado');
    }

    $items = [];
    foreach ($teamGoals as $team => $goals) {
        $label = $teamLabels[(int) $team] ?? ('Equipo ' . (int) $team);
        $items[] = [
            'label' => $label,
            'goals' => (int) $goals,
        ];
    }

    if (count($items) !== 2) {
        $parts = [];
        foreach ($items as $item) {
            $parts[] = '<span class="scoreboard-team">' . render_team_label((string) $item['label']) . '</span>';
        }
        return '<span class="match-scoreboard match-scoreboard-multi">' . implode('<span class="scoreboard-vs">vs</span>', $parts) . '</span>';
    }

    return '<span class="match-scoreboard">' .
        '<span class="scoreboard-team">' . render_team_label($items[0]['label']) . '</span>' .
        '<strong class="scoreboard-score">' . h((string) $items[0]['goals']) . ' - ' . h((string) $items[1]['goals']) . '</strong>' .
        '<span class="scoreboard-team scoreboard-team-away">' . render_team_label($items[1]['label']) . '</span>' .
        '</span>';
}

function public_round_robin_results(int $matchId): array
{
    if (!schema_table_exists(db(), 'match_round_robin_results')) {
        return [];
    }
    $stmt = db()->prepare(
        'SELECT *
         FROM match_round_robin_results
         WHERE match_id = :mid
           AND home_goals IS NOT NULL
           AND away_goals IS NOT NULL
         ORDER BY leg ASC, home_team_number ASC, away_team_number ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    return $stmt->fetchAll();
}

function render_public_round_robin_results(array $roundRobinResults, array $teamLabels): string
{
    if (!$roundRobinResults) {
        return '';
    }

    ob_start();
    ?>
    <section class="public-round-robin-results">
      <h3>Cruces parciales</h3>
      <div class="public-round-robin-grid">
        <?php foreach ($roundRobinResults as $result): ?>
          <?php
            $homeTeam = (int) $result['home_team_number'];
            $awayTeam = (int) $result['away_team_number'];
            $homeLabel = $teamLabels[$homeTeam] ?? ('Equipo ' . $homeTeam);
            $awayLabel = $teamLabels[$awayTeam] ?? ('Equipo ' . $awayTeam);
          ?>
          <article class="public-round-robin-card">
            <span class="public-round-robin-leg"><?= ((int) $result['leg']) === 1 ? 'Ida' : 'Vuelta' ?></span>
            <div class="public-round-robin-score">
              <span><?= render_team_label($homeLabel) ?></span>
              <strong><?= h((string) ((int) $result['home_goals'])) ?> - <?= h((string) ((int) $result['away_goals'])) ?></strong>
              <span><?= render_team_label($awayLabel) ?></span>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
    </section>
    <?php
    return (string) ob_get_clean();
}

function team_color_from_label(string $label): string
{
    if (preg_match('/\(([^)]+)\)\s*$/i', $label, $matches) !== 1) {
        return '';
    }

    $color = mb_strtoupper(trim($matches[1]), 'UTF-8');
    $knownColors = ['ROSA', 'AZUL', 'VERDE', 'NEGRO', 'NARANJA', 'CAMISADO', 'DESCAMISADO'];
    return in_array($color, $knownColors, true) ? $color : '';
}

function team_heart_color(string $color): string
{
    return match ($color) {
        'ROSA' => '#ec4899',
        'AZUL' => '#2563eb',
        'VERDE' => '#16a34a',
        'NEGRO' => '#111827',
        'NARANJA' => '#f97316',
        'CAMISADO' => '#f8fafc',
        'DESCAMISADO' => '#d6d3d1',
        'BLANCO' => '#f8fafc',
        default => '#047857',
    };
}

function render_team_label(string $label, ?int $goals = null): string
{
    $color = team_color_from_label($label);
    $score = $goals !== null ? ' (' . (int) $goals . ')' : '';
    if ($color === '') {
        return h($label . $score);
    }

    $name = trim((string) preg_replace('/\s*\([^)]+\)\s*$/', '', $label));
    if ($name === '') {
        $name = 'Equipo';
    }
    $heartColor = team_heart_color($color);
    return '<span class="team-label-with-heart" title="' . h($label) . '">' .
        '<span>' . h($name) . '</span>' .
        '<svg class="team-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="' . h($heartColor) . '" style="--team-heart-fill: ' . h($heartColor) . '" stroke="#0f172a" stroke-width="1.2">' .
        '<path fill="' . h($heartColor) . '" style="fill: var(--team-heart-fill, ' . h($heartColor) . ')" d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" />' .
        '</svg>' .
        '<span class="team-label-score">' . h($score) . '</span>' .
        '</span>';
}

function history_team_label(array $match, array $team, array $captainNames): string
{
    $teamNumber = (int) ($team['team_number'] ?? 0);
    if (!empty($team['captain_player_id'])) {
        return $captainNames[(int) $team['captain_player_id']] ?? ('Capitan ' . $teamNumber);
    }

    $teamName = trim((string) ($team['team_name'] ?? ''));
    $genericTeamName = $teamName === '' || preg_match('/^equipo\s+\d+$/i', $teamName) === 1;
    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color !== '') {
        return $genericTeamName ? ('Equipo ' . strtolower($color)) : $teamName;
    }

    if (!$genericTeamName) {
        return $teamName;
    }

    if (($match['draw_mode'] ?? '') !== 'captains') {
        $defaultColors = [1 => 'rosa', 2 => 'azul', 3 => 'naranja', 4 => 'negro', 5 => 'verde'];
        if (isset($defaultColors[$teamNumber])) {
            return 'Equipo ' . $defaultColors[$teamNumber];
        }
    }

    return trim((string) ($team['team_name'] ?? '')) ?: ('Equipo ' . $teamNumber);
}

function history_team_label_short(array $match, array $team, array $captainNames): string
{
    if (!empty($team['captain_player_id'])) {
        $captainName = $captainNames[(int) $team['captain_player_id']] ?? ('Capitan ' . (int) ($team['team_number'] ?? 0));
        return mb_strtoupper(trim($captainName), 'UTF-8');
    }

    $teamNumber = (int) ($team['team_number'] ?? 0);
    $teamName = trim((string) ($team['team_name'] ?? ''));
    $genericTeamName = $teamName === '' || preg_match('/^equipo\s+\d+$/i', $teamName) === 1;
    if (!$genericTeamName) {
        return mb_strtoupper($teamName, 'UTF-8');
    }

    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color === '' && (($match['draw_mode'] ?? '') !== 'captains')) {
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
        $color = $defaultColors[$teamNumber] ?? '';
    }

    $heartByColor = [
        'ROSA' => '💗',
        'AZUL' => '💙',
        'VERDE' => '💚',
        'NEGRO' => '🖤',
        'NARANJA' => '🧡',
        'CAMISADO' => 'C',
        'DESCAMISADO' => 'D',
    ];
    $normalizedColor = mb_strtoupper($color, 'UTF-8');
    if (isset($heartByColor[$normalizedColor])) {
        return 'EQUIPO ' . $heartByColor[$normalizedColor];
    }

    $label = history_team_label($match, $team, $captainNames);
    return mb_strtoupper(trim($label), 'UTF-8');
}

function history_match_score_line(array $match, array $teams, array $captainNames): string
{
    if (!$teams) {
        return '';
    }

    $showGoals = count($teams) === 2
        && (
            (string) ($match['status'] ?? '') === 'finalizado'
            || array_sum(array_map(static fn(array $team): int => (int) ($team['goals'] ?? 0), $teams)) > 0
        );

    $parts = [];
    foreach ($teams as $team) {
        $label = history_team_label_short($match, $team, $captainNames);
        $parts[] = $showGoals ? ($label . ' ( ' . (int) ($team['goals'] ?? 0) . ' )') : $label;
    }

    return implode(' VS ', $parts);
}

function history_team_scoreboard_label(array $match, array $team, array $captainNames): string
{
    $teamNumber = (int) ($team['team_number'] ?? 0);
    if (!empty($team['captain_player_id'])) {
        $captainName = $captainNames[(int) $team['captain_player_id']] ?? ('Capitan ' . $teamNumber);
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
        $color = trim((string) ($team['color_name'] ?? '')) ?: ($defaultColors[$teamNumber] ?? '');
        return $color !== '' ? ($captainName . ' (' . $color . ')') : $captainName;
    }

    $teamName = trim((string) ($team['team_name'] ?? ''));
    $genericTeamName = $teamName === '' || preg_match('/^equipo\s+\d+$/i', $teamName) === 1;
    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color !== '') {
        $baseLabel = $genericTeamName ? 'Equipo' : $teamName;
        return $baseLabel . ' (' . mb_strtoupper($color, 'UTF-8') . ')';
    }

    if (!$genericTeamName) {
        return $teamName;
    }

    if (($match['draw_mode'] ?? '') !== 'captains') {
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
        if (isset($defaultColors[$teamNumber])) {
            return 'Equipo (' . $defaultColors[$teamNumber] . ')';
        }
    }

    return trim((string) ($team['team_name'] ?? '')) ?: ('Equipo ' . $teamNumber);
}

function render_history_match_scoreboard(array $match, array $teams, array $captainNames): string
{
    if (!$teams) {
        return '';
    }

    $teamGoals = [];
    $teamLabels = [];
    foreach ($teams as $team) {
        $teamNumber = (int) ($team['team_number'] ?? 0);
        if ($teamNumber <= 0) {
            continue;
        }
        $teamGoals[$teamNumber] = (int) ($team['goals'] ?? 0);
        $teamLabels[$teamNumber] = history_team_scoreboard_label($match, $team, $captainNames);
    }

    if (!$teamGoals) {
        return '';
    }

    ksort($teamGoals);
    ksort($teamLabels);
    return render_match_scoreboard($teamGoals, $teamLabels, (string) ($match['status'] ?? '') === 'finalizado');
}

function match_player_award_icons(array $savedMatchAwards, array $awardDefinitions): array
{
    $icons = [];
    foreach ($savedMatchAwards as $awardCode => $awardRow) {
        $awardPlayerId = (int) ($awardRow['player_id'] ?? 0);
        if ($awardPlayerId <= 0 || !isset($awardDefinitions[$awardCode])) {
            continue;
        }
        $icons[$awardPlayerId][] = [
            'code' => (string) $awardCode,
            'icon' => (string) $awardDefinitions[$awardCode]['icon'],
            'label' => (string) $awardDefinitions[$awardCode]['label'],
        ];
    }
    return $icons;
}

function public_team_players_from_lines(array $lines): array
{
    $players = [];
    foreach (player_formation_lines() as $line) {
        foreach (($lines[$line] ?? []) as $player) {
            $players[] = $player;
        }
    }
    return $players;
}

function public_base_display_position(array $player): string
{
    $assigned = strtoupper(trim((string) ($player['assigned_position'] ?? '')));
    if ($assigned !== '' && in_array($assigned, allowed_positions(), true)) {
        return $assigned;
    }

    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    if ((int) ($player['is_goalkeeper'] ?? 0) === 1 || ($positions[0] ?? '') === 'ARQ') {
        return 'ARQ';
    }
    if (in_array('LAT', $positions, true)) {
        return 'LAT';
    }

    return $positions[0] ?? 'MED';
}

function public_base_display_lines(array $lines): array
{
    $displayLines = array_fill_keys(player_formation_lines(), []);
    foreach (public_team_players_from_lines($lines) as $player) {
        $position = public_base_display_position($player);
        $player['assigned_position'] = $position;
        $displayLines[$position][] = $player;
    }

    foreach ($displayLines as &$linePlayers) {
        usort($linePlayers, static function (array $a, array $b): int {
            $formationOrderA = $a['formation_line_order'] !== null ? (int) $a['formation_line_order'] : 999;
            $formationOrderB = $b['formation_line_order'] !== null ? (int) $b['formation_line_order'] : 999;
            $lineupOrderA = $a['lineup_order'] !== null ? (int) $a['lineup_order'] : 999;
            $lineupOrderB = $b['lineup_order'] !== null ? (int) $b['lineup_order'] : 999;
            return ($formationOrderA <=> $formationOrderB)
                ?: ($lineupOrderA <=> $lineupOrderB)
                ?: strcasecmp((string) $a['name'], (string) $b['name']);
        });
    }
    unset($linePlayers);

    return $displayLines;
}

function public_team_tactic_label(array $lines): string
{
    $counts = [];
    foreach (player_field_lines() as $line) {
        $counts[] = (string) count($lines[$line] ?? []);
    }
    return 'TACTICA ' . implode('-', $counts);
}

function public_team_characteristics_summary(array $players): array
{
    $count = count($players);
    $average = static function (string $field) use ($players, $count): float {
        if ($count === 0) {
            return 0.0;
        }
        return array_sum(array_map(static fn(array $player): float => player_effective_stat($player, $field), $players)) / $count;
    };
    $goalkeeperSkill = 0.0;
    foreach ($players as $player) {
        if (player_has_goalkeeper_position($player)) {
            $goalkeeperSkill = max($goalkeeperSkill, player_effective_stat($player, 'goalkeeper_skill'));
        }
    }

    return [
        'total' => array_sum(array_map(static fn(array $player): float => player_overall_rating($player), $players)),
        'attack' => $average('attack'),
        'defense_physical' => $average('defense_physical'),
        'rhythm' => $average('rhythm'),
        'technique' => $average('technique'),
        'teamwork' => $average('teamwork'),
        'mentality' => $average('mentality'),
        'regularity' => $average('regularity'),
        'goalkeeper_skill' => $goalkeeperSkill,
        'fast' => count(array_filter($players, static fn(array $player): bool => !player_is_low_rhythm($player))),
        'slow' => count(array_filter($players, static fn(array $player): bool => player_is_low_rhythm($player))),
    ];
}

function render_public_team_characteristics(array $players): string
{
    if (!$players) {
        return '';
    }
    $summary = public_team_characteristics_summary($players);
    ob_start();
    ?>
    <div class="public-team-characteristics">
      <div class="team-characteristics-main">
        <span>General <?= h(number_format((float) $summary['total'], 1)) ?></span>
        <span><?= h((string) $summary['fast']) ?> rapidos / <?= h((string) $summary['slow']) ?> lentos</span>
      </div>
      <div class="team-characteristics-stats">
        <?php if ((float) $summary['goalkeeper_skill'] > 0): ?>
          <span>Arquero <?= h(number_format((float) $summary['goalkeeper_skill'], 1)) ?></span>
        <?php else: ?>
          <span>Ataque <?= h(number_format((float) $summary['attack'], 1)) ?></span>
        <?php endif; ?>
        <span>Solidez <?= h(number_format((float) $summary['defense_physical'], 1)) ?></span>
        <span>Ritmo <?= h(number_format((float) $summary['rhythm'], 1)) ?></span>
        <span>Tecnica <?= h(number_format((float) $summary['technique'], 1)) ?></span>
        <span>Juego en equipo <?= h(number_format((float) $summary['teamwork'], 1)) ?></span>
        <span>Mentalidad <?= h(number_format((float) $summary['mentality'], 1)) ?></span>
        <span>Regularidad <?= h(number_format((float) $summary['regularity'], 1)) ?></span>
      </div>
    </div>
    <?php
    return trim((string) ob_get_clean());
}

function render_formation_total_title(float $total, string $label = 'Base'): string
{
    ob_start();
    ?>
    <div class="formation-total-title" data-formation-total-title>
      <span><?= h($label) ?></span>
      <strong><?= h(number_format($total, 1)) ?> pts</strong>
    </div>
    <?php
    return trim((string) ob_get_clean());
}

function render_formation_title_row(float $total, string $tactic): string
{
    ob_start();
    ?>
    <div class="formation-title-row">
      <?= render_formation_total_title($total) ?>
      <div class="formation-total-title formation-tactic-title"><span>TACTICA</span><strong data-formation-tactic><?= h(str_replace('TACTICA ', '', $tactic)) ?></strong></div>
    </div>
    <?php
    return trim((string) ob_get_clean());
}

function render_public_match_detail_content(array $match, array $awardDefinitions, array $awardDescriptions): string
{
    $matchId = (int) $match['id'];
    $participants = repo_match_participants($matchId);
    $isFinalized = (string) $match['status'] === 'finalizado';
    $ratedPlayers = array_values(array_filter($participants, static fn(array $p): bool => $p['rating'] !== null));
    $showResultFormation = $isFinalized && $ratedPlayers !== [];
    $resultParticipants = $participants;
    usort($resultParticipants, static function (array $a, array $b): int {
        $ratingA = $a['rating'] !== null ? (float) $a['rating'] : -1.0;
        $ratingB = $b['rating'] !== null ? (float) $b['rating'] : -1.0;
        return ($ratingB <=> $ratingA)
            ?: ((int) ($b['goals'] ?? 0) <=> (int) ($a['goals'] ?? 0))
            ?: strcasecmp((string) $a['name'], (string) $b['name']);
    });

    $groupedTeams = repo_grouped_team_players($matchId);
    $teamTotals = repo_team_totals($matchId);
    $matchTeams = repo_match_teams($matchId);
    $teamLabels = $matchTeams ? repo_match_team_labels($match, $matchTeams) : [];
    $roundRobinResults = count($matchTeams) > 2 ? public_round_robin_results($matchId) : [];
    $teamGoals = [];
    foreach ($matchTeams as $team) {
        $teamGoals[(int) $team['team_number']] = (int) ($team['goals'] ?? 0);
    }
    ksort($teamGoals);

    $savedMatchAwards = repo_match_awards($matchId);
    $playerAwardIcons = match_player_award_icons($savedMatchAwards, $awardDefinitions);
    $matchAwards = [];

    if ($isFinalized) {
        usort($ratedPlayers, static fn(array $a, array $b): int => ((float) $b['rating'] <=> (float) $a['rating']) ?: strcasecmp((string) $a['name'], (string) $b['name']));
        if (!$savedMatchAwards && $ratedPlayers) {
            $matchAwards[] = ['label' => 'Figura', 'value' => (string) $ratedPlayers[0]['name'] . ' (' . number_format((float) $ratedPlayers[0]['rating'], 1) . ')'];
        }

        $goalPlayers = array_values(array_filter($participants, static fn(array $p): bool => (int) ($p['goals'] ?? 0) > 0));
        usort($goalPlayers, static fn(array $a, array $b): int => ((int) $b['goals'] <=> (int) $a['goals']) ?: strcasecmp((string) $a['name'], (string) $b['name']));
        if (!$savedMatchAwards && $goalPlayers) {
            $matchAwards[] = ['label' => 'Goleador', 'value' => (string) $goalPlayers[0]['name'] . ' (' . (int) $goalPlayers[0]['goals'] . ')'];
        }

        if (!$savedMatchAwards && $teamGoals) {
            $maxGoals = max($teamGoals);
            $winningTeams = array_keys(array_filter($teamGoals, static fn(int $goals): bool => $goals === $maxGoals));
            $matchAwards[] = [
                'label' => count($winningTeams) === 1 ? 'Ganador' : 'Resultado',
                'value' => count($winningTeams) === 1 ? ($teamLabels[(int) $winningTeams[0]] ?? ('Equipo ' . (int) $winningTeams[0])) : 'Empate',
            ];
        }

        foreach ($awardDefinitions as $code => $award) {
            if (!isset($savedMatchAwards[$code])) {
                continue;
            }
            $matchAwards[] = [
                'label' => (string) $award['icon'] . ' ' . (string) $award['label'],
                'value' => (string) $savedMatchAwards[$code]['name'],
            ];
        }
    }

    ob_start();
    ?>
    <?php if (!$groupedTeams): ?>
      <p>Los equipos todavía no fueron formados. Cuando estén sorteados o elegidos por capitanes, se mostrará la formación acá.</p>
      <?php if ($participants): ?>
        <div class="selected-player-list public-player-list">
          <?php foreach ($participants as $player): ?>
            <div class="selected-player-item">
              <span>
                <strong><?= h((string) $player['name']) ?></strong>
                <small><?= h((string) $player['positions']) ?> | <?= h(pace_label((string) $player['pace'])) ?> | <?= h(skill_label((float) $player['skill'])) ?></small>
              </span>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
      <?php if ($isFinalized && $matchAwards): ?>
        <section class="match-results">
          <h3>Resumen de la fecha</h3>
          <h4 class="match-awards-title">Premios</h4>
          <div class="grid cols-3 match-awards">
            <?php foreach ($matchAwards as $award): ?>
              <article class="stat-box">
                <div class="label"><?= h($award['label']) ?></div>
                <div class="value"><?= h($award['value']) ?></div>
              </article>
            <?php endforeach; ?>
          </div>

          <section class="award-legend-section match-award-legend">
            <h4>Referencia de premios</h4>
            <div class="award-legend-grid">
              <?php foreach ($awardDefinitions as $code => $award): ?>
                <article class="award-legend-item">
                  <span class="award-legend-icon"><?= h((string) $award['icon']) ?></span>
                  <span>
                    <strong><?= h((string) $award['label']) ?></strong>
                    <small><?= h($awardDescriptions[$code] ?? 'Premio destacado de la fecha.') ?></small>
                  </span>
                </article>
              <?php endforeach; ?>
            </div>
          </section>
        </section>
      <?php endif; ?>
    <?php else: ?>
      <div class="grid cols-2 public-teams">
        <?php foreach ($groupedTeams as $teamNumber => $lines): ?>
          <?php
            $displayLines = $showResultFormation ? $lines : public_base_display_lines($lines);
            $teamPlayersForCharacteristics = public_team_players_from_lines($displayLines);
            $teamTacticLabel = public_team_tactic_label($displayLines);
          ?>
          <article class="team-card">
            <div class="team-head">
              <h4>
                <?= render_team_label(
                    $teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber),
                    $isFinalized ? (int) ($teamGoals[(int) $teamNumber] ?? 0) : null
                ) ?>
              </h4>
              <span class="small-muted">
                <?php if ($isFinalized): ?>
                  <?= h((string) ($teamGoals[$teamNumber] ?? 0)) ?> goles
                <?php else: ?>
                  Formacion base
                <?php endif; ?>
              </span>
            </div>
            <?= render_formation_title_row((float) ($teamTotals[$teamNumber]['total_skill'] ?? 0), $teamTacticLabel) ?>
            <?php $formationPitchClass = $showResultFormation ? 'is-result-formation' : 'is-base-formation'; ?>
            <div class="team-formation <?= h($formationPitchClass) ?>" data-static-team-formation data-static-formation-locked="1" data-team-number="<?= h((string) $teamNumber) ?>">
              <?php foreach (player_pitch_lines() as $line): ?>
                <?php
                  $linePlayers = $line === 'DEF'
                      ? array_merge(array_slice($displayLines['LAT'] ?? [], 0, 1), $displayLines['DEF'] ?? [], array_slice($displayLines['LAT'] ?? [], 1))
                      : ($displayLines[$line] ?? []);
                  $lineLabel = $line === 'DEF' && !empty($displayLines['LAT']) ? 'DEF/LAT' : $line;
                ?>
                <div class="formation-line">
                  <div class="line-label"><?= h($lineLabel) ?></div>
                  <div class="line-players">
                    <?php if (empty($linePlayers)): ?>
                      <span class="formation-player empty-slot">-</span>
                    <?php else: ?>
                      <?php foreach ($linePlayers as $player): ?>
                        <?php
                          $assignedLine = strtoupper((string) ($player['assigned_position'] ?? $line));
                          $formationGoals = (int) ($player['goals'] ?? 0);
                          $formationRating = $player['rating'] !== null ? number_format((float) $player['rating'], 1) : '-';
                          $formationAwards = $playerAwardIcons[(int) $player['id']] ?? [];
                          $isPlayerOfMatch = (bool) array_filter($formationAwards, static fn(array $award): bool => ($award['code'] ?? '') === 'player_of_match');
                          $formationOverall = player_overall_rating($player);
                          $formationBaseRating = home_adjusted_position_rating($player, $assignedLine);
                          $naturalPositions = parse_positions_csv((string) ($player['positions'] ?? ''));
                          $primaryPosition = $naturalPositions[0] ?? '';
                          $isPositionChanged = $primaryPosition !== '' && $assignedLine !== $primaryPosition;
                          $formationPhotoPath = player_photo_path($player);
                          $formationPhotoClass = player_has_custom_photo($player) ? ' is-custom' : ' is-default';
                          $formationCardClass = ' captain-formation-player card-pro-relieve formation-card-sin-stat formation-card-compacta formation-card-tier-' . home_player_card_tier($formationBaseRating)
                              . ($isPositionChanged ? ' is-position-changed' : '');
                        ?>
                        <div
                          class="formation-player<?= h($formationCardClass) ?> <?= $showResultFormation && $formationGoals > 0 ? 'scored-player' : '' ?> <?= $showResultFormation && $isPlayerOfMatch ? 'is-player-of-match' : '' ?>"
                          draggable="false"
                          data-static-formation-player
                          data-static-player-key="<?= h((string) $player['id']) ?>"
                          data-assigned-position="<?= h($assignedLine) ?>"
                          data-player-skill="<?= h(number_format($formationOverall, 1, '.', '')) ?>"
                          data-player-positions="<?= h((string) ($player['positions'] ?? '')) ?>"
                          data-player-technique="<?= h(number_format(player_effective_stat($player, 'technique'), 1, '.', '')) ?>"
                          data-player-rhythm="<?= h(number_format(player_effective_stat($player, 'rhythm'), 1, '.', '')) ?>"
                          data-player-defense-physical="<?= h(number_format(player_effective_stat($player, 'defense_physical'), 1, '.', '')) ?>"
                          data-player-attack="<?= h(number_format(player_effective_stat($player, 'attack'), 1, '.', '')) ?>"
                          data-player-teamwork="<?= h(number_format(player_effective_stat($player, 'teamwork'), 1, '.', '')) ?>"
                          data-player-mentality="<?= h(number_format(player_effective_stat($player, 'mentality'), 1, '.', '')) ?>"
                          data-player-regularity="<?= h(number_format(player_effective_stat($player, 'regularity'), 1, '.', '')) ?>"
                          data-player-goalkeeper-skill="<?= h(number_format(player_effective_stat($player, 'goalkeeper_skill'), 1, '.', '')) ?>"
                        >
                          <?= render_player_card_rating($formationBaseRating, 'GEN') ?>
                          <span class="formation-card-photo<?= h($formationPhotoClass) ?>" aria-hidden="true"><img src="<?= h($formationPhotoPath) ?>" alt=""></span>
                          <strong class="formation-player-name"><?= h((string) $player['name']) ?></strong>
                          <span class="formation-player-meta formation-player-position formation-card-position" title="Posicion asignada"><?= h($assignedLine) ?></span>
                          <?= render_home_player_card_regularity($player) ?>
                          <?php if ($showResultFormation): ?>
                            <span class="formation-player-match-rating" title="Nota del partido"><?= h($formationRating) ?></span>
                            <?php if ($formationGoals > 0 || $formationAwards): ?>
                              <span class="formation-result-badges">
                                <?php if ($formationGoals > 0): ?>
                                  <span class="formation-goals-badge"><?= h((string) $formationGoals) ?> <?= $formationGoals === 1 ? 'gol' : 'goles' ?></span>
                                <?php endif; ?>
                                <?php if ($formationGoals > 0 && $formationAwards): ?>
                                  <span class="formation-detail-separator">-</span>
                                <?php endif; ?>
                                <?php if ($formationAwards): ?>
                                  <span class="formation-award-icons">
                                    <?php foreach ($formationAwards as $awardIcon): ?>
                                      <span title="<?= h($awardIcon['label']) ?>"><?= h($awardIcon['icon']) ?></span>
                                    <?php endforeach; ?>
                                  </span>
                                <?php endif; ?>
                              </span>
                            <?php endif; ?>
                          <?php endif; ?>
                        </div>
                      <?php endforeach; ?>
                    <?php endif; ?>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
            <?= render_public_team_characteristics($teamPlayersForCharacteristics) ?>
          </article>
        <?php endforeach; ?>
      </div>

      <?php if ($isFinalized): ?>
        <?= render_public_round_robin_results($roundRobinResults, $teamLabels) ?>
        <section class="match-results">
          <h3>Resumen de la fecha</h3>
          <div class="match-result-mobile-groups">
            <?php foreach ($teamLabels as $teamNumber => $teamLabel): ?>
              <?php
                $teamPlayers = array_values(array_filter(
                    $resultParticipants,
                    static fn(array $player): bool => (int) ($player['team_number'] ?? 0) === (int) $teamNumber
                ));
                if (!$teamPlayers) {
                    continue;
                }
              ?>
              <section class="mobile-result-team">
                <h4><?= render_team_label($teamLabel, (int) ($teamGoals[(int) $teamNumber] ?? 0)) ?></h4>
                <div class="mobile-result-grid mobile-result-head">
                  <span>Jugador</span>
                  <span>Goles</span>
                  <span>Puntaje</span>
                  <span>Premios</span>
                </div>
                <?php foreach ($teamPlayers as $player): ?>
                  <?php $playerGoals = (int) ($player['goals'] ?? 0); ?>
                  <div class="mobile-result-grid <?= $playerGoals > 0 ? 'scored-row' : '' ?>">
                    <span class="mobile-result-player">
                      <?php if ($playerGoals > 0): ?>
                        <strong><?= h((string) $player['name']) ?></strong>
                      <?php else: ?>
                        <?= h((string) $player['name']) ?>
                      <?php endif; ?>
                    </span>
                    <span class="mobile-result-goals"><?= $playerGoals > 0 ? h((string) $playerGoals) : '' ?></span>
                    <span class="mobile-result-rating">
                      <?= $player['rating'] !== null ? h(number_format((float) $player['rating'], 1)) : '-' ?>
                    </span>
                    <span class="mobile-result-awards">
                      <?php if (empty($playerAwardIcons[(int) $player['id']])): ?>
                        <span class="award-empty">-</span>
                      <?php else: ?>
                        <?php foreach ($playerAwardIcons[(int) $player['id']] as $awardIcon): ?>
                          <span class="award-count-chip award-icon-only" title="<?= h($awardIcon['label']) ?>">
                            <span class="award-count-icon"><?= h($awardIcon['icon']) ?></span>
                          </span>
                        <?php endforeach; ?>
                      <?php endif; ?>
                    </span>
                  </div>
                <?php endforeach; ?>
              </section>
            <?php endforeach; ?>
          </div>

          <?php if ($matchAwards): ?>
            <h4 class="match-awards-title">Premios</h4>
            <div class="grid cols-3 match-awards">
              <?php foreach ($matchAwards as $award): ?>
                <article class="stat-box">
                  <div class="label"><?= h($award['label']) ?></div>
                  <div class="value"><?= h($award['value']) ?></div>
                </article>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>

          <section class="award-legend-section match-award-legend">
            <h4>Referencia de premios</h4>
            <div class="award-legend-grid">
              <?php foreach ($awardDefinitions as $code => $award): ?>
                <article class="award-legend-item">
                  <span class="award-legend-icon"><?= h((string) $award['icon']) ?></span>
                  <span>
                    <strong><?= h((string) $award['label']) ?></strong>
                    <small><?= h($awardDescriptions[$code] ?? 'Premio destacado de la fecha.') ?></small>
                  </span>
                </article>
              <?php endforeach; ?>
            </div>
          </section>
        </section>
      <?php endif; ?>
    <?php endif; ?>
    <?php
    return (string) ob_get_clean();
}

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1><?= $showHistoryPage ? 'Historial de fechas' : 'GOODFELLAS' ?></h1>
    <p class="small-muted"><?= $showHistoryPage ? 'Consulta fechas por dia, capitan o resultado.' : 'Gestion de fechas, equipos, jugadores y rendimiento del grupo.' ?></p>
  </div>
  <div class="home-page-actions">
    <?php if (!$showHistoryPage): ?>
      <a class="btn btn-primary home-app-download" href="goodfellas.apk" download>Descarga la app</a>
    <?php endif; ?>
    <?php if (is_admin()): ?>
      <a class="btn btn-primary" href="editar_partidos.php">Panel admin</a>
    <?php endif; ?>
  </div>
</section>

<?php if (!$showHistoryPage && $matches): ?>
  <?php
    $topMatch = $matches[0];
    $headerMatch = $showHistoryPage
        ? ($selectedMatch ?: $topMatch)
        : (($requestedMatchId > 0 && $selectedMatch) ? $selectedMatch : ($futureMatches[0] ?? $topMatch));
    $headerTeams = repo_match_teams((int) $headerMatch['id']);
    $headerTeamLabels = $headerTeams ? repo_match_team_labels($headerMatch, $headerTeams) : [];
    $headerGoals = [];
    foreach ($headerTeams as $team) {
        $headerGoals[(int) $team['team_number']] = (int) ($team['goals'] ?? 0);
    }
    ksort($headerGoals);
    $headerParticipantsCount = isset($headerMatch['participants_count'])
        ? (int) $headerMatch['participants_count']
        : count(repo_match_participants((int) $headerMatch['id']));
    $headerHasSavedResult = repo_match_has_saved_result($headerMatch, $headerTeams);
    $headerHasCaptains = (string) ($headerMatch['draw_mode'] ?? '') === 'captains'
        && !$headerHasSavedResult;
    $headerCaptainDraftStatus = '';
    if ($headerHasCaptains) {
        $stmtHeaderDraft = $pdo->prepare('SELECT status FROM captain_drafts WHERE match_id = :mid LIMIT 1');
        $stmtHeaderDraft->execute(['mid' => (int) $headerMatch['id']]);
        $headerCaptainDraftStatus = (string) ($stmtHeaderDraft->fetchColumn() ?: '');
    }
    $headerShowCaptainLive = $headerHasCaptains && $headerCaptainDraftStatus !== 'completed';
    $headerCaptainSavedToken = '';
    if ($headerHasCaptains) {
        $headerMatchId = (int) $headerMatch['id'];
        $storedCaptainAccess = $_SESSION['captain_access'][$headerMatchId] ?? null;
        if (is_array($storedCaptainAccess)) {
            $headerCaptainSavedToken = trim((string) ($storedCaptainAccess['token'] ?? ''));
        }
        if ($headerCaptainSavedToken === '') {
            $storedCaptainCookie = (string) ($_COOKIE['captain_access_' . $headerMatchId] ?? '');
            if ($storedCaptainCookie !== '' && str_contains($storedCaptainCookie, '|')) {
                [, $storedCaptainToken] = explode('|', $storedCaptainCookie, 2);
                $headerCaptainSavedToken = trim($storedCaptainToken);
            }
        }
    }
    $headerHasDetailPanel = !$showHistoryPage
        && $selectedMatch
        && !($headerShowCaptainLive && (int) $selectedMatchId === (int) $headerMatch['id']);
    multiple_draw_finalize_if_due($headerMatch);
    $headerMatch = repo_match_by_id((int) $headerMatch['id']) ?: $headerMatch;
    $headerHasSavedResult = repo_match_has_saved_result($headerMatch, $headerTeams);
    $headerMultiDrawOptions = multiple_draw_options((int) $headerMatch['id']);
    $headerMultiDrawWinnerId = (int) ($headerMatch['multi_draw_winner_option_id'] ?? 0);
    $headerShowMultiDrawVote = $headerMultiDrawOptions
        && $headerMultiDrawWinnerId <= 0
        && (string) ($headerMatch['status'] ?? '') === 'programado';
    $headerMultiDrawCanVote = $headerShowMultiDrawVote && multiple_draw_user_can_vote($headerMatch);
    $headerMultiDrawSelectedOptionId = current_user_id() > 0 ? multiple_draw_vote_for_user((int) $headerMatch['id'], current_user_id()) : 0;
    $headerMultiDrawDeadline = multiple_draw_deadline($headerMatch);
    $headerMultiDrawParticipantCount = count(multiple_draw_participant_ids((int) $headerMatch['id']));
  ?>
  <section class="card home-next-card <?= $headerHasSavedResult ? 'home-next-card-with-result' : ($headerHasCaptains ? 'home-next-card-with-captain' : '') ?>">
    <div class="home-next-main">
      <span class="home-kicker"><?= $headerHasSavedResult ? 'Datos de la ultima fecha jugada' : 'Proxima fecha' ?></span>
      <h2><?= h((string) ($headerMatch['title'] ?: ('Fecha #' . $headerMatch['id']))) ?></h2>
      <p class="small-muted">
        Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $headerMatch['match_date']))) ?>
        | <?= h((string) $headerParticipantsCount) ?> jugadores
        | <?= h(match_status_label((string) $headerMatch['status'])) ?>
      </p>
    </div>
    <?php if ($headerHasSavedResult): ?>
      <div class="home-result-line">
        <span>Resultado final</span>
        <?= render_match_scoreboard($headerGoals, $headerTeamLabels) ?>
      </div>
    <?php elseif ($headerHasCaptains): ?>
      <form class="home-captain-access" method="post" action="capitanes.php">
        <input type="hidden" name="action" value="captain_token_login">
        <label for="homeCaptainToken">Token de capitan</label>
        <div>
          <input id="homeCaptainToken" type="text" name="captain_token" placeholder="Pegar token" autocomplete="off" inputmode="numeric" maxlength="4" value="<?= h($headerCaptainSavedToken) ?>" required>
          <button class="btn btn-primary" type="submit">Soy capitan</button>
        </div>
      </form>
    <?php endif; ?>
    <?php if ($showHistoryPage): ?>
      <a class="btn btn-primary match-detail-toggle-btn" href="historial.php?match_id=<?= (int) $headerMatch['id'] ?>" data-match-detail-toggle aria-label="Ver detalles de la fecha">
        <span class="match-detail-toggle-symbol" data-match-detail-symbol>+</span>
        <span>Detalles</span>
      </a>
    <?php elseif ($headerHasDetailPanel): ?>
      <button class="btn btn-primary match-detail-toggle-btn" type="button" data-match-detail-toggle aria-expanded="false" aria-controls="homeMatchDetail">
        <span class="match-detail-toggle-symbol" data-match-detail-symbol>+</span>
        <span>Detalles</span>
      </button>
    <?php endif; ?>
  </section>

  <?php if (
      !$showHistoryPage
      && $latestFinalizedMatch
      && (int) $latestFinalizedMatch['id'] !== (int) $headerMatch['id']
  ): ?>
    <?php
      $latestResultTeams = repo_match_teams((int) $latestFinalizedMatch['id']);
      $latestResultLabels = $latestResultTeams ? repo_match_team_labels($latestFinalizedMatch, $latestResultTeams) : [];
      $latestResultGoals = [];
      foreach ($latestResultTeams as $team) {
          $latestResultGoals[(int) $team['team_number']] = (int) ($team['goals'] ?? 0);
      }
      ksort($latestResultGoals);
    ?>
    <section class="card home-next-card home-next-card-with-result">
      <div class="home-next-main">
        <span class="home-kicker">Ultima fecha jugada</span>
        <h2><?= h((string) ($latestFinalizedMatch['title'] ?: ('Fecha #' . $latestFinalizedMatch['id']))) ?></h2>
        <p class="small-muted">
          Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $latestFinalizedMatch['match_date']))) ?>
          | <?= h(match_status_label((string) $latestFinalizedMatch['status'])) ?>
        </p>
      </div>
      <div class="home-result-line">
        <span>Resultado final</span>
        <?= render_match_scoreboard($latestResultGoals, $latestResultLabels) ?>
      </div>
      <a class="btn btn-primary match-detail-toggle-btn" href="historial.php?match_id=<?= (int) $latestFinalizedMatch['id'] ?>" aria-label="Ver detalles de la ultima fecha">
        <span>Detalles</span>
      </a>
    </section>
  <?php endif; ?>

  <?php if ($headerShowMultiDrawVote): ?>
    <section class="card home-multi-draw-card">
      <div class="section-toolbar home-multi-draw-head">
        <div>
          <span class="home-kicker">Votacion abierta</span>
          <h3>Elegir sorteo de la fecha</h3>
          <p class="small-muted">
            <?= h((string) count($headerMultiDrawOptions)) ?> variantes publicadas.
            Votan solo los <?= h((string) $headerMultiDrawParticipantCount) ?> jugadores convocados hasta <?= h(date('d/m/Y H:i', $headerMultiDrawDeadline)) ?>.
          </p>
        </div>
        <?php if ($headerMultiDrawCanVote): ?>
          <a class="btn btn-primary" href="votar_sorteo.php?match_id=<?= (int) $headerMatch['id'] ?>">
            <?= $headerMultiDrawSelectedOptionId > 0 ? 'Cambiar mi voto' : 'Votar ahora' ?>
          </a>
        <?php elseif (!is_player_user()): ?>
          <a class="btn btn-muted" href="login.php?next=<?= h(rawurlencode('votar_sorteo.php?match_id=' . (int) $headerMatch['id'])) ?>">Ingresar para votar</a>
        <?php else: ?>
          <span class="badge pending">Solo convocados</span>
        <?php endif; ?>
      </div>

      <?php if ($headerMultiDrawSelectedOptionId > 0): ?>
        <p class="small-muted home-multi-draw-vote-status">Tu voto esta guardado. Podes cambiarlo mientras la votacion siga abierta.</p>
      <?php else: ?>
        <p class="small-muted home-multi-draw-vote-status">Esperando votos de los jugadores logueados convocados para completar la eleccion.</p>
      <?php endif; ?>

      <div class="home-multi-draw-options grid gap-3 lg:grid-cols-3">
        <?php foreach ($headerMultiDrawOptions as $option): ?>
          <?= multiple_draw_render_option($option, $headerMultiDrawSelectedOptionId === (int) $option['id'], true) ?>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>
<?php endif; ?>

<?php if (!$showHistoryPage && !empty($headerShowCaptainLive) && !empty($headerMatch)): ?>
  <section class="card home-captain-live" data-public-captain-live data-match-id="<?= (int) $headerMatch['id'] ?>">
    <div class="home-captain-live-head">
      <div>
        <span class="home-kicker">Sorteo en vivo</span>
        <h3>Equipos por capitanes</h3>
      </div>
      <span class="home-captain-live-status" data-public-captain-status>Actualizando...</span>
    </div>
    <div class="home-captain-live-teams" data-public-captain-teams>
      <article>
        <h4>Equipo 1</h4>
        <p class="small-muted">Esperando datos...</p>
      </article>
      <article>
        <h4>Equipo 2</h4>
        <p class="small-muted">Esperando datos...</p>
      </article>
    </div>
  </section>
<?php endif; ?>

<section class="home-layout <?= $showHistoryPage ? '' : 'home-layout-single' ?>">
  <?php if ($showHistoryPage): ?>
    <article class="card match-history">
      <h3>Historial de fechas</h3>
      <?php if ($historyMatches): ?>
        <div
          data-react-root
          data-react-island="home_history_search"
          data-total="<?= h((string) count($historyMatches)) ?>"
          data-input-id="homeHistorySearch"
        ></div>
        <p class="small-muted history-search-empty" data-home-history-empty hidden>No hay fechas que coincidan con la busqueda.</p>
      <?php endif; ?>
      <div class="match-list">
        <?php if (!$historyMatches): ?>
          <p>No hay fechas cargadas.</p>
        <?php else: ?>
          <?php foreach ($historyMatches as $match): ?>
            <?php
              $isSelected = $requestedMatchId > 0 && $selectedMatchId === (int) $match['id'];
              $isNext = $nextMatchId === (int) $match['id'];
              $isFinalizedHistory = (string) $match['status'] === 'finalizado';
              $ratingStatus = $historyRatingCounts[(int) $match['id']] ?? ['player_count' => (int) $match['participants_count'], 'rated_count' => 0];
              $missingAwards = $isFinalizedHistory && (($historyAwardCounts[(int) $match['id']] ?? 0) === 0);
              $missingRating = $isFinalizedHistory && (int) $ratingStatus['player_count'] > 0 && (int) $ratingStatus['rated_count'] < (int) $ratingStatus['player_count'];
              $historyTeams = $historyTeamsByMatch[(int) $match['id']] ?? [];
              $historyScoreboard = render_history_match_scoreboard($match, $historyTeams, $historyCaptainNames);
              $historyCaptainSearch = [];
              foreach ($historyTeams as $historyTeam) {
                  if (!empty($historyTeam['captain_player_id'])) {
                      $historyCaptainSearch[] = $historyCaptainNames[(int) $historyTeam['captain_player_id']] ?? '';
                  }
              }
              $historySearchText = implode(' ', array_filter([
                  (string) ($match['title'] ?: 'Fecha #' . $match['id']),
                  (string) $match['id'],
                  date('d/m/Y', strtotime((string) $match['match_date'])),
                  date('Y-m-d', strtotime((string) $match['match_date'])),
                  date('d/m/Y H:i', strtotime((string) $match['match_date'])),
                  match_status_label((string) $match['status']),
                  implode(' ', $historyCaptainSearch),
                  history_match_score_line($match, $historyTeams, $historyCaptainNames),
              ]));
            ?>
            <details
              class="match-list-item history-match-accordion <?= $isSelected ? 'active' : '' ?>"
              id="partido-<?= (int) $match['id'] ?>"
              data-home-history-card
              data-search="<?= h(mb_strtolower($historySearchText, 'UTF-8')) ?>"
              <?= $isSelected ? 'open' : '' ?>
            >
              <summary class="history-match-summary">
                <span>
                  <strong>
                    <?= h((string) ($match['title'] ?: ('Fecha #' . $match['id']))) ?>
                    <?php if ($historyScoreboard !== ''): ?>
                      <span class="match-list-title-score"><?= $historyScoreboard ?></span>
                    <?php endif; ?>
                  </strong>
                  <small><?= h(date('d/m/Y H:i', strtotime((string) $match['match_date']))) ?></small>
                </span>
                <span class="match-list-side">
                  <?php if ($isNext): ?><em>Proximo</em><?php endif; ?>
                  <span class="badge <?= $match['status'] === 'finalizado' ? 'done' : 'warn' ?>"><?= h(match_status_label((string) $match['status'])) ?></span>
                  <?php if ($missingAwards): ?><span class="badge pending">Sin premios</span><?php endif; ?>
                  <?php if ($missingRating): ?><span class="badge pending">Sin puntaje</span><?php endif; ?>
                  <span class="btn btn-muted history-match-toggle" aria-hidden="true">
                    <span class="match-detail-toggle-symbol"></span>
                    <span>Ver detalles</span>
                  </span>
                </span>
              </summary>
              <div class="history-match-body">
                <?= render_public_match_detail_content($match, $awardDefinitions, $awardDescriptions) ?>
              </div>
            </details>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </article>
  <?php endif; ?>

  <?php if (!$showHistoryPage): ?>
  <?php
    $hideDuplicateLiveCaptainDetail = isset($headerShowCaptainLive, $headerMatch)
        && $headerShowCaptainLive
        && (int) $selectedMatchId === (int) $headerMatch['id'];
  ?>
  <?php if (!$hideDuplicateLiveCaptainDetail): ?>
  <article class="card match-detail match-history" id="homeMatchDetail" data-match-detail-panel hidden>
    <?php if (!$selectedMatch): ?>
      <h3>Detalle</h3>
      <p>No hay fechas para mostrar.</p>
    <?php else: ?>
      <?php
        $showDynamicCaptainDetail = isset($headerShowCaptainLive, $headerMatch)
            && $headerShowCaptainLive
            && (int) $selectedMatch['id'] === (int) $headerMatch['id'];
      ?>
      <?php if ($showDynamicCaptainDetail): ?>
        <div class="grid cols-2 public-teams" data-public-captain-formation>
          <article class="team-card">
            <div class="team-head">
              <h4>Equipo 1</h4>
              <span class="small-muted">Esperando datos...</span>
            </div>
            <div class="team-formation is-base-formation" data-static-team-formation data-static-formation-locked="1" data-team-number="1"></div>
          </article>
          <article class="team-card">
            <div class="team-head">
              <h4>Equipo 2</h4>
              <span class="small-muted">Esperando datos...</span>
            </div>
            <div class="team-formation is-base-formation" data-static-team-formation data-static-formation-locked="1" data-team-number="2"></div>
          </article>
        </div>
      <?php else: ?>
        <?= render_public_match_detail_content($selectedMatch, $awardDefinitions, $awardDescriptions) ?>
      <?php endif; ?>
    <?php endif; ?>
  </article>
  <?php endif; ?>
  <?php endif; ?>
</section>

<?php if (!$showHistoryPage): ?>
  <section class="home-welcome">
    <div class="home-section-grid" aria-label="Secciones principales">
      <a class="home-section-card" href="jugadores2.php">
        <span class="home-section-visual">
          <img src="assets/home/home-jugadores.png" alt="Panel visual de gestion de jugadores" loading="lazy" width="1672" height="941">
        </span>
        <strong>Jugadores</strong>
        <small>Plantel, posiciones, puntajes y perfiles para equilibrar mejor cada partido.</small>
      </a>
      <a class="home-section-card" href="historial.php" aria-label="Ver fechas jugadas">
        <span class="home-section-visual">
          <img src="assets/home/home-fechas.png" alt="Panel visual de fechas jugadas y resultados" loading="lazy" width="1672" height="941">
        </span>
        <strong>Fechas jugadas</strong>
        <small>Fechas jugadas, equipos, resultados, premios y detalles de cada encuentro.</small>
      </a>
      <a class="home-section-card" href="estadisticas.php">
        <span class="home-section-visual">
          <img src="assets/home/home-estadisticas.png" alt="Panel visual de estadisticas y rankings" loading="lazy" width="1672" height="941">
        </span>
        <strong>Estadisticas</strong>
        <small>Ranking de jugadores, goles, promedios, capitanes y rendimiento acumulado.</small>
      </a>
      <a class="home-section-card" href="<?= is_admin() ? 'editar_partidos.php' : 'login.php' ?>">
        <span class="home-section-visual">
          <img src="assets/home/home-admin.png" alt="Panel visual de administracion de fechas y sorteos" loading="lazy" width="1672" height="941">
        </span>
        <strong>Admin</strong>
        <small>Crear fechas, cargar convocados, sortear equipos y cerrar resultados.</small>
      </a>
    </div>
  </section>
<?php endif; ?>

<?php if (!$showHistoryPage && !empty($headerHasCaptains)): ?>
<script src="assets/home-captains.js"></script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>

