<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';

$title = 'Inicio | ' . APP_NAME;
$activePage = 'index.php';

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
}

$requestedMatchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$selectedMatch = null;
if ($requestedMatchId > 0) {
    $selectedMatch = repo_match_by_id($requestedMatchId);
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
    if (preg_match('/Equipo\s*\(([^)]+)\)/i', $label, $matches) !== 1) {
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

    $heartColor = team_heart_color($color);
    return '<span class="team-label-with-heart" title="' . h($label) . '">' .
        '<span>Equipo</span>' .
        '<svg class="team-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="--team-heart-fill: ' . h($heartColor) . '">' .
        '<path d="M12 21s-7.2-4.6-9.6-9C.4 8.4 2.3 4 6.5 4c2 0 3.7 1.1 4.6 2.7C12 5.1 13.7 4 15.7 4c4.2 0 6.1 4.4 4.1 8-2.4 4.4-9.8 9-9.8 9z" />' .
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
        'ROSA' => '🩷',
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
        return 'Equipo (' . $captainName . ')';
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

require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Partidos</h1>
    <p class="small-muted">Proximo partido, detalle de equipos e historial completo.</p>
  </div>
  <?php if (is_admin()): ?>
    <a class="btn btn-primary" href="encuentros.php">Panel admin</a>
  <?php endif; ?>
</section>

<?php if ($matches): ?>
  <?php
    $topMatch = $matches[0];
    $headerMatch = $selectedMatch ?: $topMatch;
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
  ?>
  <section class="card home-next-card">
    <div>
      <span class="home-kicker"><?= (string) $headerMatch['status'] === 'finalizado' ? 'Partido finalizado' : 'Proximo partido' ?></span>
      <h2><?= h((string) ($headerMatch['title'] ?: ('Partido #' . $headerMatch['id']))) ?></h2>
      <p class="small-muted">
        Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $headerMatch['match_date']))) ?>
        | <?= h((string) $headerParticipantsCount) ?> jugadores
        | <?= h(match_status_label((string) $headerMatch['status'])) ?>
      </p>
      <?php if ((string) $headerMatch['status'] === 'finalizado'): ?>
        <div class="home-result-line">Resultado: <?= render_match_scoreboard($headerGoals, $headerTeamLabels) ?></div>
      <?php endif; ?>
    </div>
    <a class="btn btn-primary" href="index.php?match_id=<?= (int) $headerMatch['id'] ?>" data-match-detail-toggle data-match-detail-label>Detalles ↑</a>
  </section>
<?php endif; ?>

<section class="home-layout">
  <article class="card match-history">
    <h3>Historial de partidos</h3>
    <div class="match-list">
      <?php if (!$historyMatches): ?>
        <p>No hay partidos cargados.</p>
      <?php else: ?>
        <?php foreach ($historyMatches as $match): ?>
          <?php
            $isSelected = $selectedMatchId === (int) $match['id'];
            $isNext = $nextMatchId === (int) $match['id'];
            $historyScoreboard = render_history_match_scoreboard($match, $historyTeamsByMatch[(int) $match['id']] ?? [], $historyCaptainNames);
          ?>
          <a
            class="match-list-item <?= $isSelected ? 'active' : '' ?>"
            href="index.php?match_id=<?= (int) $match['id'] ?>"
            <?= $isSelected ? 'data-match-detail-toggle' : '' ?>
          >
            <span>
              <strong>
                <?= h((string) ($match['title'] ?: ('Partido #' . $match['id']))) ?>
                <?php if ($historyScoreboard !== ''): ?>
                  <span class="match-list-title-score"><?= $historyScoreboard ?></span>
                <?php endif; ?>
              </strong>
              <small><?= h(date('d/m/Y H:i', strtotime((string) $match['match_date']))) ?> | <?= h((string) $match['participants_count']) ?> jugadores</small>
            </span>
            <span class="match-list-side">
              <?php if ($isNext): ?><em>Proximo</em><?php endif; ?>
              <span class="badge <?= $match['status'] === 'finalizado' ? 'done' : 'warn' ?>"><?= h(match_status_label((string) $match['status'])) ?></span>
              <span class="btn btn-muted" data-match-detail-label>Detalles ↑</span>
            </span>
          </a>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </article>

  <article class="card match-detail" data-match-detail-panel>
    <?php if (!$selectedMatch): ?>
      <h3>Detalle</h3>
      <p>No hay partidos para mostrar.</p>
    <?php else: ?>
      <div class="match-detail-head">
        <div>
          <h3><?= h((string) ($selectedMatch['title'] ?: ('Partido #' . $selectedMatch['id']))) ?></h3>
          <p class="small-muted"><?= h(date('d/m/Y H:i', strtotime((string) $selectedMatch['match_date']))) ?> | <?= h(match_status_label((string) $selectedMatch['status'])) ?></p>
        </div>
        <?php if ((string) $selectedMatch['status'] === 'finalizado'): ?>
          <div class="score-pill"><?= render_match_scoreboard($teamGoals, $teamLabels) ?></div>
        <?php endif; ?>
      </div>

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
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
