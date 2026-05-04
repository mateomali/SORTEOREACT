<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';

$showHistoryPage = defined('SHOW_HISTORY_PAGE') && SHOW_HISTORY_PAGE;
$title = ($showHistoryPage ? 'Historial' : 'Inicio') . ' | ' . APP_NAME;
$activePage = $showHistoryPage ? 'historial.php' : 'index.php';

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
if (!$showHistoryPage && $futureMatches) {
    $selectedMatch = repo_match_by_id((int) $futureMatches[0]['id']);
}
if (!$selectedMatch && $matches) {
    $selectedMatch = repo_match_by_id((int) $matches[0]['id']);
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
$teamGoals = [];
$matchAwards = [];
$matchAverageRating = null;
$awardDefinitions = award_definitions();
$awardDescriptions = [
    'player_of_match' => 'Jugador del partido.',
    'goal_of_week' => 'Mejor gol de la fecha.',
    'lyrical' => 'Jugada fantastica o recurso tecnico destacado.',
    'wall' => 'Mejor defensor del partido.',
    'capocannoniere' => 'Goleador destacado de la fecha.',
    'terminator' => 'Jugador mas bruto o jugada mas fuerte.',
    'tractor' => 'Jugador mas aguerrido e intenso.',
    'guinda' => 'Mejor pase o asistencia.',
    'putita' => 'Jugador no comprometido o problematico.',
    'ghost' => 'Jugador que erro mucho o participo poco.',
    'keeper' => 'Mejor arquero del partido.',
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

function match_status_label(string $status): string
{
    return match ($status) {
        'finalizado' => 'Finalizado',
        'sorteado' => 'Equipos formados',
        default => 'Programado',
    };
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

function render_match_scoreboard(array $teamGoals, array $teamLabels = []): string
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
        return h(team_score_line($teamGoals, $teamLabels));
    }

    return '<span class="match-scoreboard">' .
        '<span class="scoreboard-team">' . render_team_label($items[0]['label']) . '</span>' .
        '<strong class="scoreboard-score">' . h((string) $items[0]['goals']) . ' - ' . h((string) $items[1]['goals']) . '</strong>' .
        '<span class="scoreboard-team scoreboard-team-away">' . render_team_label($items[1]['label']) . '</span>' .
        '</span>';
}

function team_color_from_label(string $label): string
{
    if (preg_match('/\(([^)]+)\)\s*$/i', $label, $matches) !== 1) {
        return '';
    }

    $color = mb_strtoupper(trim($matches[1]), 'UTF-8');
    $knownColors = ['ROSA', 'AZUL', 'VERDE', 'NEGRO', 'NARANJA'];
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
        '<svg class="team-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="--team-heart-fill: ' . h($heartColor) . '">' .
        '<path d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" />' .
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

    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color !== '') {
        return 'Equipo ' . strtolower($color);
    }

    if (($match['draw_mode'] ?? '') !== 'captains') {
        $defaultColors = [1 => 'rosa', 2 => 'azul'];
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
    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color === '' && (($match['draw_mode'] ?? '') !== 'captains')) {
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL'];
        $color = $defaultColors[$teamNumber] ?? '';
    }

    $heartByColor = [
        'ROSA' => '💗',
        'AZUL' => '💙',
        'VERDE' => '💚',
        'NEGRO' => '🖤',
        'NARANJA' => '🧡',
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

    $showGoals = (string) ($match['status'] ?? '') === 'finalizado'
        || array_sum(array_map(static fn(array $team): int => (int) ($team['goals'] ?? 0), $teams)) > 0;

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
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL'];
        $color = trim((string) ($team['color_name'] ?? '')) ?: ($defaultColors[$teamNumber] ?? '');
        return $color !== '' ? ($captainName . ' (' . $color . ')') : $captainName;
    }

    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color !== '') {
        return 'Equipo (' . mb_strtoupper($color, 'UTF-8') . ')';
    }

    if (($match['draw_mode'] ?? '') !== 'captains') {
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL'];
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
    return render_match_scoreboard($teamGoals, $teamLabels);
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
            'icon' => (string) $awardDefinitions[$awardCode]['icon'],
            'label' => (string) $awardDefinitions[$awardCode]['label'],
        ];
    }
    return $icons;
}

function render_public_match_detail_content(array $match, array $awardDefinitions, array $awardDescriptions): string
{
    $matchId = (int) $match['id'];
    $participants = repo_match_participants($matchId);
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
    $teamGoals = [];
    foreach ($matchTeams as $team) {
        $teamGoals[(int) $team['team_number']] = (int) ($team['goals'] ?? 0);
    }
    ksort($teamGoals);

    $savedMatchAwards = repo_match_awards($matchId);
    $playerAwardIcons = match_player_award_icons($savedMatchAwards, $awardDefinitions);
    $matchAwards = [];

    if ((string) $match['status'] === 'finalizado' && $participants) {
        $ratedPlayers = array_values(array_filter($participants, static fn(array $p): bool => $p['rating'] !== null));
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
      <p>Los equipos todavia no fueron formados. Cuando esten sorteados o elegidos por capitanes, se mostrara la formacion aca.</p>
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
    <?php else: ?>
      <div class="grid cols-2 public-teams">
        <?php foreach ($groupedTeams as $teamNumber => $lines): ?>
          <article class="team-card">
            <div class="team-head">
              <h4>
                <?= render_team_label(
                    $teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber),
                    (string) $match['status'] === 'finalizado' ? (int) ($teamGoals[(int) $teamNumber] ?? 0) : null
                ) ?>
              </h4>
              <span class="small-muted">
                <?= h(number_format((float) ($teamTotals[$teamNumber]['total_skill'] ?? 0), 1)) ?> pts
                <?php if ((string) $match['status'] === 'finalizado'): ?>
                  | <?= h((string) ($teamGoals[$teamNumber] ?? 0)) ?> goles
                <?php endif; ?>
              </span>
            </div>
            <div class="team-formation">
              <?php foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line): ?>
                <div class="formation-line">
                  <div class="line-label"><?= h($line) ?></div>
                  <div class="line-players">
                    <?php if (empty($lines[$line])): ?>
                      <span class="formation-player empty-slot">-</span>
                    <?php else: ?>
                      <?php foreach ($lines[$line] as $player): ?>
                        <?php
                          $formationGoals = (int) ($player['goals'] ?? 0);
                          $formationRating = $player['rating'] !== null ? number_format((float) $player['rating'], 1) : '-';
                          $formationAwards = $playerAwardIcons[(int) $player['id']] ?? [];
                        ?>
                        <div class="formation-player <?= $formationGoals > 0 ? 'scored-player' : '' ?>">
                          <strong><?= h((string) $player['name']) ?><?php if ((string) $match['status'] === 'finalizado'): ?> (<?= h($formationRating) ?>)<?php endif; ?></strong>
                          <?php if ((string) $match['status'] === 'finalizado'): ?>
                            <?php if ($formationGoals > 0 || $formationAwards): ?>
                              <span>
                                <?php if ($formationGoals > 0): ?>
                                  <span class="formation-goals-badge"><?= h((string) $formationGoals) ?> goles</span>
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
                          <?php else: ?>
                            <span><?= h(skill_label((float) $player['skill'])) ?></span>
                          <?php endif; ?>
                        </div>
                      <?php endforeach; ?>
                    <?php endif; ?>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
          </article>
        <?php endforeach; ?>
      </div>

      <?php if ((string) $match['status'] === 'finalizado'): ?>
        <section class="match-results">
          <h3>Resumen del partido</h3>
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
                    <small><?= h($awardDescriptions[$code] ?? 'Premio destacado del partido.') ?></small>
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
    <h1><?= $showHistoryPage ? 'Historial de partidos' : 'Inicio' ?></h1>
    <p class="small-muted"><?= $showHistoryPage ? 'Consulta partidos por fecha, capitan o resultado.' : 'Proximo partido a jugarse.' ?></p>
  </div>
  <?php if (is_admin()): ?>
    <a class="btn btn-primary" href="editar_partidos.php">Panel admin</a>
  <?php endif; ?>
</section>

<?php if (!$showHistoryPage && $matches): ?>
  <?php
    $topMatch = $matches[0];
    $headerMatch = $showHistoryPage ? ($selectedMatch ?: $topMatch) : ($futureMatches[0] ?? $topMatch);
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
    $headerHasCaptains = (string) ($headerMatch['draw_mode'] ?? '') === 'captains'
        && (string) ($headerMatch['status'] ?? '') !== 'finalizado';
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
  ?>
  <section class="card home-next-card <?= (string) $headerMatch['status'] === 'finalizado' ? 'home-next-card-with-result' : ($headerHasCaptains ? 'home-next-card-with-captain' : '') ?>">
    <div class="home-next-main">
      <span class="home-kicker"><?= (string) $headerMatch['status'] === 'finalizado' ? 'Datos del ultimo partido jugado' : 'Proximo partido' ?></span>
      <h2><?= h((string) ($headerMatch['title'] ?: ('Partido #' . $headerMatch['id']))) ?></h2>
      <p class="small-muted">
        Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $headerMatch['match_date']))) ?>
        | <?= h((string) $headerParticipantsCount) ?> jugadores
        | <?= h(match_status_label((string) $headerMatch['status'])) ?>
      </p>
    </div>
    <?php if ((string) $headerMatch['status'] === 'finalizado'): ?>
      <div class="home-result-line">
        <span>Resultado</span>
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
      <a class="btn btn-primary match-detail-toggle-btn" href="historial.php?match_id=<?= (int) $headerMatch['id'] ?>" data-match-detail-toggle aria-label="Ver detalles del partido">
        <span class="match-detail-toggle-symbol" data-match-detail-symbol>+</span>
        <span>Detalles</span>
      </a>
    <?php endif; ?>
  </section>
  <?php if ($headerShowCaptainLive): ?>
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
<?php endif; ?>

<section class="home-layout <?= $showHistoryPage ? '' : 'home-layout-single' ?>">
  <?php if ($showHistoryPage): ?>
    <article class="card match-history">
      <h3>Historial de partidos</h3>
      <?php if ($historyMatches): ?>
        <div class="history-search" role="search">
          <label for="homeHistorySearch">Buscar historial</label>
          <input id="homeHistorySearch" type="search" placeholder="Fecha, partido o capitan..." autocomplete="off" data-home-history-search>
          <span data-home-history-count><?= h((string) count($historyMatches)) ?> partidos</span>
        </div>
        <p class="small-muted history-search-empty" data-home-history-empty hidden>No hay partidos que coincidan con la busqueda.</p>
      <?php endif; ?>
      <div class="match-list">
        <?php if (!$historyMatches): ?>
          <p>No hay partidos cargados.</p>
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
                  (string) ($match['title'] ?: 'Partido #' . $match['id']),
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
                    <?= h((string) ($match['title'] ?: ('Partido #' . $match['id']))) ?>
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
                    <span>Ver partido</span>
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
  <article class="card match-detail">
    <?php if (!$selectedMatch): ?>
      <h3>Detalle</h3>
      <p>No hay partidos para mostrar.</p>
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
            <div class="team-formation"></div>
          </article>
          <article class="team-card">
            <div class="team-head">
              <h4>Equipo 2</h4>
              <span class="small-muted">Esperando datos...</span>
            </div>
            <div class="team-formation"></div>
          </article>
        </div>
      <?php elseif (!$groupedTeams): ?>
        <p>Los equipos todavia no fueron formados. Cuando esten sorteados o elegidos por capitanes, se mostrara la formacion aca.</p>
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
      <?php else: ?>
        <div class="grid cols-2 public-teams">
          <?php foreach ($groupedTeams as $teamNumber => $lines): ?>
            <article class="team-card">
              <div class="team-head">
                <h4>
                  <?= render_team_label(
                      $teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber),
                      (string) $selectedMatch['status'] === 'finalizado' ? (int) ($teamGoals[(int) $teamNumber] ?? 0) : null
                  ) ?>
                </h4>
                <span class="small-muted">
                  <?= h(number_format((float) ($teamTotals[$teamNumber]['total_skill'] ?? 0), 1)) ?> pts
                  <?php if ((string) $selectedMatch['status'] === 'finalizado'): ?>
                    | <?= h((string) ($teamGoals[$teamNumber] ?? 0)) ?> goles
                  <?php endif; ?>
                </span>
              </div>
              <div class="team-formation">
                <?php foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line): ?>
                  <div class="formation-line">
                    <div class="line-label"><?= h($line) ?></div>
                    <div class="line-players">
                      <?php if (empty($lines[$line])): ?>
                        <span class="formation-player empty-slot">-</span>
                      <?php else: ?>
                        <?php foreach ($lines[$line] as $player): ?>
                          <?php
                            $formationGoals = (int) ($player['goals'] ?? 0);
                            $formationRating = $player['rating'] !== null ? number_format((float) $player['rating'], 1) : '-';
                            $formationAwards = $playerAwardIcons[(int) $player['id']] ?? [];
                          ?>
                          <div class="formation-player <?= (int) ($player['goals'] ?? 0) > 0 ? 'scored-player' : '' ?>">
                            <strong><?= h((string) $player['name']) ?><?php if ((string) $selectedMatch['status'] === 'finalizado'): ?> (<?= h($formationRating) ?>)<?php endif; ?></strong>
                            <?php if ((string) $selectedMatch['status'] === 'finalizado'): ?>
                              <?php if ($formationGoals > 0 || $formationAwards): ?>
                                <span>
                                  <?php if ($formationGoals > 0): ?>
                                    <span class="formation-goals-badge"><?= h((string) $formationGoals) ?> ⚽</span>
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
                            <?php else: ?>
                              <span>
                                <?= h(skill_label((float) $player['skill'])) ?>
                              </span>
                            <?php endif; ?>
                          </div>
                        <?php endforeach; ?>
                      <?php endif; ?>
                    </div>
                  </div>
                <?php endforeach; ?>
              </div>
            </article>
          <?php endforeach; ?>
        </div>

        <?php if ((string) $selectedMatch['status'] === 'finalizado'): ?>
          <section class="match-results">
            <h3>Resumen del partido</h3>
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
                      <small><?= h($awardDescriptions[$code] ?? 'Premio destacado del partido.') ?></small>
                    </span>
                  </article>
                <?php endforeach; ?>
              </div>
            </section>
          </section>
        <?php endif; ?>
      <?php endif; ?>
    <?php endif; ?>
  </article>
  <?php endif; ?>
</section>

<?php if ($showHistoryPage): ?>
<script>
  (() => {
    const input = document.querySelector('[data-home-history-search]');
    if (!input) return;

    const cards = Array.from(document.querySelectorAll('[data-home-history-card]'));
    const empty = document.querySelector('[data-home-history-empty]');
    const count = document.querySelector('[data-home-history-count]');
    const total = cards.length;

    const normalize = (value) => String(value || '')
      .toLocaleLowerCase('es-AR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const applyFilter = () => {
      const query = normalize(input.value);
      let visible = 0;

      cards.forEach((card) => {
        const haystack = normalize(card.dataset.search || '');
        const matches = query === '' || haystack.includes(query);
        card.hidden = !matches;
        if (matches) visible++;
      });

      if (empty) {
        empty.hidden = visible !== 0;
      }
      if (count) {
        count.textContent = query === ''
          ? `${total} partidos`
          : `${visible} de ${total} partidos`;
      }
    };

    input.addEventListener('input', applyFilter);
    applyFilter();
  })();
</script>
<?php elseif (!empty($headerHasCaptains)): ?>
<script>
  (() => {
    const root = document.querySelector('[data-public-captain-live]');
    if (!root) return;

    const matchId = parseInt(root.dataset.matchId || '0', 10);
    const status = root.querySelector('[data-public-captain-status]');
    const teamsRoot = root.querySelector('[data-public-captain-teams]');
    const formationRoot = document.querySelector('[data-public-captain-formation]');
    let stopped = false;

    const escapeHtml = (value) => String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

    const formatSkill = (value) => {
      const number = Number(value || 0);
      return Number.isInteger(number) ? String(number) : number.toFixed(1);
    };

    const teamTotalSkill = (players) => players.reduce((total, player) => total + Number(player.skill || 0), 0);

    const renderFormation = (players) => {
      const positions = ['ARQ', 'DEF', 'MED', 'DEL'];
      return positions.map((position) => {
        const linePlayers = players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === position);
        const playerHtml = linePlayers.length
          ? linePlayers.map((player) => `
              <div class="formation-player">
                <strong>${escapeHtml(player.name)}</strong>
                <span>${escapeHtml(player.positions)} | ${escapeHtml(player.pace_label)} | ${formatSkill(player.skill)} pts</span>
              </div>
            `).join('')
          : '<span class="formation-player empty-slot">-</span>';

        return `
          <div class="formation-line">
            <div class="line-label">${position}</div>
            <div class="line-players">${playerHtml}</div>
          </div>
        `;
      }).join('');
    };

    const renderTeamCard = (state, teamNumber) => {
      const players = state.teams?.[teamNumber] || [];
      const captainName = state.draft?.captains?.[teamNumber]?.name || `Equipo ${teamNumber}`;
      const targetSize = Number(state.match?.target_team_size || 0);
      const totalSkill = teamTotalSkill(players);

      return `
        <article class="team-card">
          <div class="team-head">
            <h4>${escapeHtml(captainName)}</h4>
            <span class="small-muted">${players.length}/${targetSize} jugadores | ${totalSkill.toFixed(1)} pts</span>
          </div>
          <div class="team-formation">${renderFormation(players)}</div>
        </article>
      `;
    };

    const render = (state) => {
      if (!state.ok) {
        status.textContent = state.message || 'No se pudo cargar el sorteo.';
        return;
      }

      const teamsHtml = renderTeamCard(state, 1) + renderTeamCard(state, 2);
      teamsRoot.innerHTML = teamsHtml;
      if (formationRoot) {
        formationRoot.innerHTML = teamsHtml;
      }

      const availableCount = Array.isArray(state.available) ? state.available.length : 0;
      if (state.draft?.status === 'completed') {
        stopped = true;
        root.hidden = true;
        return;
      }

      if (state.draft?.current_captain) {
        status.textContent = `Turno de ${state.draft.current_captain} | ${availableCount} disponibles`;
      } else {
        status.textContent = `${availableCount} jugadores disponibles`;
      }

    };

    const loadState = async () => {
      if (stopped || !matchId) return;
      try {
        const response = await fetch(`capitanes_api.php?action=state&match_id=${matchId}`, { cache: 'no-store' });
        const state = await response.json();
        render(state);
      } catch (error) {
        status.textContent = 'Reintentando actualizacion...';
      }
    };

    loadState();
    const timer = window.setInterval(loadState, 3000);
    window.addEventListener('beforeunload', () => {
      stopped = true;
      window.clearInterval(timer);
    });
  })();
</script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
