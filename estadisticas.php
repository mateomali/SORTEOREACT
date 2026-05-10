<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/awards.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/directivos.php';
require_once __DIR__ . '/lib/admin_config.php';
require_once __DIR__ . '/lib/player_profile_visual.php';

$pdo = db();
ensure_auth_schema();
ensure_control_schema();
ensure_match_awards_schema();
ensure_admin_config_schema();
directive_publish_due_results();
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
    'goodfellas' => 'Mejor actitud y buen companero.',
];
$awardLegendDefinitions = $awardDefinitions + ['monthly_player' => monthly_player_award_definition()];
$awardLegendDescriptions = $awardDescriptions + ['monthly_player' => monthly_player_award_description()];

$dateFrom = trim((string) ($_GET['date_from'] ?? ''));
$dateTo = trim((string) ($_GET['date_to'] ?? ''));
$availableYears = $pdo->query(
    "SELECT DISTINCT YEAR(match_date) AS year_value
     FROM matches
     WHERE status = 'finalizado'
     ORDER BY year_value DESC"
)->fetchAll(PDO::FETCH_COLUMN);
$availableYears = array_values(array_filter(array_map('intval', $availableYears), static fn(int $year): bool => $year > 0));
if (!in_array(2026, $availableYears, true)) {
    $availableYears[] = 2026;
    rsort($availableYears, SORT_NUMERIC);
}
$selectedYearRaw = array_key_exists('year', $_GET) ? trim((string) ($_GET['year'] ?? 'all')) : 'all';
$selectedYear = $selectedYearRaw === 'all' ? 'all' : (string) max(1900, min(2100, (int) $selectedYearRaw));
$hasCourtRequest = array_key_exists('court_id', $_GET);
$courtId = $hasCourtRequest ? max(0, (int) ($_GET['court_id'] ?? 0)) : 0;
$currentUserId = current_user_id();
$courts = rental_courts(false);
$selectedCourt = null;
foreach ($courts as $court) {
    if ((int) $court['id'] === $courtId) {
        $selectedCourt = $court;
        break;
    }
}
if ($courtId > 0 && !$selectedCourt) {
    $courtId = 0;
}
if ($hasCourtRequest && $currentUserId > 0) {
    $savePreferenceStmt = $pdo->prepare('UPDATE site_users SET preferred_stats_court_id = :court_id WHERE id = :id');
    $savePreferenceStmt->execute([
        'court_id' => $courtId > 0 ? $courtId : null,
        'id' => $currentUserId,
    ]);
}
$selectedCourtLabel = $selectedCourt
    ? ((string) $selectedCourt['place'] . ' - ' . (string) $selectedCourt['court_key'])
    : 'General';
$minMatches = 1;
$currentPlayerId = current_player_id();

$where = ["m.status = 'finalizado'"];
$params = [];

if ($selectedYear !== 'all') {
    $where[] = 'm.match_date >= :year_from';
    $where[] = 'm.match_date <= :year_to';
    $params['year_from'] = $selectedYear . '-01-01 00:00:00';
    $params['year_to'] = $selectedYear . '-12-31 23:59:59';
}
if ($dateFrom !== '') {
    $where[] = 'm.match_date >= :date_from';
    $params['date_from'] = date('Y-m-d 00:00:00', strtotime($dateFrom));
}
if ($dateTo !== '') {
    $where[] = 'm.match_date <= :date_to';
    $params['date_to'] = date('Y-m-d 23:59:59', strtotime($dateTo));
}
if ($courtId > 0) {
    $where[] = 'm.rental_court_id = :court_id';
    $params['court_id'] = $courtId;
}

$whereSql = implode(' AND ', $where);

$summarySql = "SELECT
  COUNT(DISTINCT m.id) AS partidos,
  COUNT(DISTINCT p.id) AS jugadores,
  COALESCE(SUM(mp.goals), 0) AS goles_totales,
  ROUND(AVG(mp.rating), 2) AS promedio_general
FROM match_players mp
INNER JOIN players p ON p.id = mp.player_id
INNER JOIN matches m ON m.id = mp.match_id
WHERE {$whereSql}";

$stmtSummary = $pdo->prepare($summarySql);
$stmtSummary->execute($params);
$summary = $stmtSummary->fetch() ?: ['partidos' => 0, 'jugadores' => 0, 'goles_totales' => 0, 'promedio_general' => null];

$scorersSql = "SELECT
  p.id,
  p.name,
  p.positions,
  p.pace,
  COUNT(mp.id) AS partidos,
  COALESCE(SUM(mp.goals), 0) AS goles,
  ROUND(COALESCE(SUM(mp.goals), 0) / NULLIF(COUNT(mp.id), 0), 2) AS gol_por_partido
FROM match_players mp
INNER JOIN players p ON p.id = mp.player_id
INNER JOIN matches m ON m.id = mp.match_id
WHERE {$whereSql}
GROUP BY p.id, p.name, p.positions, p.pace
HAVING COUNT(mp.id) >= :min_matches
ORDER BY goles DESC, gol_por_partido DESC, p.name ASC
LIMIT 100";

$stmtScorers = $pdo->prepare($scorersSql);
$stmtScorers->execute($params + ['min_matches' => $minMatches]);
$scorers = $stmtScorers->fetchAll();

$matchStatsJoin = ["m.id = mp.match_id", "m.status = 'finalizado'"];
if ($selectedYear !== 'all') {
    $matchStatsJoin[] = 'm.match_date >= :year_from';
    $matchStatsJoin[] = 'm.match_date <= :year_to';
}
if ($dateFrom !== '') {
    $matchStatsJoin[] = 'm.match_date >= :date_from';
}
if ($dateTo !== '') {
    $matchStatsJoin[] = 'm.match_date <= :date_to';
}
if ($courtId > 0) {
    $matchStatsJoin[] = 'm.rental_court_id = :court_id';
}
$matchStatsJoinSql = implode(' AND ', $matchStatsJoin);

$awardWhere = ["am.status = 'finalizado'"];
$awardParams = [];
if ($selectedYear !== 'all') {
    $awardWhere[] = 'am.match_date >= :award_year_from';
    $awardWhere[] = 'am.match_date <= :award_year_to';
    $awardParams['award_year_from'] = $selectedYear . '-01-01 00:00:00';
    $awardParams['award_year_to'] = $selectedYear . '-12-31 23:59:59';
}
if ($dateFrom !== '') {
    $awardWhere[] = 'am.match_date >= :award_date_from';
    $awardParams['award_date_from'] = date('Y-m-d 00:00:00', strtotime($dateFrom));
}
if ($dateTo !== '') {
    $awardWhere[] = 'am.match_date <= :award_date_to';
    $awardParams['award_date_to'] = date('Y-m-d 23:59:59', strtotime($dateTo));
}
if ($courtId > 0) {
    $awardWhere[] = 'am.rental_court_id = :award_court_id';
    $awardParams['award_court_id'] = $courtId;
}
$awardWhereSql = implode(' AND ', $awardWhere);
$awardColumns = [];
$awardSelects = [];
foreach ($awardDefinitions as $code => $_definition) {
    $alias = 'award_' . $code;
    $awardColumns[] = "SUM(CASE WHEN ma.award_code = " . $pdo->quote($code) . " THEN 1 ELSE 0 END) AS {$alias}";
    $awardSelects[] = "MAX(COALESCE(ac.{$alias}, 0)) AS {$alias}";
}
$awardColumnsSql = implode(",\n    ", $awardColumns);
$awardSelectsSql = implode(",\n  ", $awardSelects);

$ratingSql = "SELECT
  p.id,
  p.name,
  p.positions,
  COUNT(DISTINCT mp.match_id) AS partidos,
  ROUND(AVG(mp.rating), 2) AS rating_promedio,
  COALESCE(SUM(mp.goals), 0) AS goles,
  COALESCE(SUM(CASE
    WHEN mt.goals IS NOT NULL
      AND mt.goals > COALESCE((SELECT MAX(mt2.goals) FROM match_teams mt2 WHERE mt2.match_id = mp.match_id AND mt2.team_number <> mp.team_number), mt.goals)
    THEN 1 ELSE 0 END), 0) AS pg,
  COALESCE(SUM(CASE
    WHEN mt.goals IS NOT NULL
      AND mt.goals = COALESCE((SELECT MAX(mt2.goals) FROM match_teams mt2 WHERE mt2.match_id = mp.match_id AND mt2.team_number <> mp.team_number), mt.goals)
      AND EXISTS (SELECT 1 FROM match_teams mt3 WHERE mt3.match_id = mp.match_id AND mt3.team_number <> mp.team_number)
    THEN 1 ELSE 0 END), 0) AS pe,
  COALESCE(SUM(CASE
    WHEN mt.goals IS NOT NULL
      AND mt.goals < COALESCE((SELECT MAX(mt2.goals) FROM match_teams mt2 WHERE mt2.match_id = mp.match_id AND mt2.team_number <> mp.team_number), mt.goals)
    THEN 1 ELSE 0 END), 0) AS pp,
  ROUND(
    (COALESCE(AVG(mp.rating), 0) * 0.7)
    + (COALESCE((COALESCE(SUM(mp.goals), 0) / NULLIF(COUNT(DISTINCT mp.match_id), 0)), 0) * 3),
    2
  ) AS indice_rendimiento,
  {$awardSelectsSql}
FROM match_players mp
INNER JOIN players p ON p.id = mp.player_id
INNER JOIN matches m ON {$matchStatsJoinSql}
LEFT JOIN match_teams mt ON mt.match_id = mp.match_id AND mt.team_number = mp.team_number
LEFT JOIN (
  SELECT
    ma.player_id,
    {$awardColumnsSql}
  FROM match_awards ma
  INNER JOIN matches am ON am.id = ma.match_id
  WHERE {$awardWhereSql}
  GROUP BY ma.player_id
) ac ON ac.player_id = p.id
GROUP BY p.id, p.name, p.positions
HAVING COUNT(DISTINCT mp.match_id) >= :min_matches
ORDER BY CASE WHEN p.id = :current_player_id THEN 0 ELSE 1 END, partidos DESC, rating_promedio DESC, indice_rendimiento DESC, p.name ASC
LIMIT 100";

$stmtRatings = $pdo->prepare($ratingSql);
$stmtRatings->execute($params + $awardParams + ['min_matches' => $minMatches, 'current_player_id' => $currentPlayerId]);
$ratings = $stmtRatings->fetchAll();

$profileStatLabels = shared_profile_stat_labels();
$profileStatHelp = shared_profile_stat_help();
$statsProfilePlayersById = [];
$statsProfileIds = array_values(array_unique(array_map(static fn(array $row): int => (int) $row['id'], $ratings)));
if ($statsProfileIds) {
    $profileIn = implode(',', array_fill(0, count($statsProfileIds), '?'));
    $stmtProfilePlayers = $pdo->prepare("SELECT * FROM players WHERE id IN ($profileIn)");
    $stmtProfilePlayers->execute($statsProfileIds);
    foreach ($stmtProfilePlayers->fetchAll() as $profilePlayer) {
        $statsProfilePlayersById[(int) $profilePlayer['id']] = $profilePlayer;
    }
}

$playerAwardDates = [];
$awardDatesSql = "SELECT
  ma.player_id,
  ma.award_code,
  am.id AS match_id,
  am.title,
  am.match_date
FROM match_awards ma
INNER JOIN matches am ON am.id = ma.match_id
WHERE {$awardWhereSql}
ORDER BY ma.player_id ASC, ma.award_code ASC, am.match_date DESC, am.id DESC";
$stmtAwardDates = $pdo->prepare($awardDatesSql);
$stmtAwardDates->execute($awardParams);
foreach ($stmtAwardDates->fetchAll() as $awardDateRow) {
    $playerId = (int) $awardDateRow['player_id'];
    $awardCode = (string) $awardDateRow['award_code'];
    $playerAwardDates[$playerId][$awardCode][] = [
        'title' => (string) ($awardDateRow['title'] ?: ('Fecha #' . $awardDateRow['match_id'])),
        'date' => date('d/m/Y H:i', strtotime((string) $awardDateRow['match_date'])),
    ];
}

$playerMatchDetails = [];
$playerAppearanceDetails = [];
$playerGoalDetails = [];
$playerMatchDetailsSql = "SELECT
  p.id AS player_id,
  m.id AS match_id,
  m.title,
  m.match_date,
  COALESCE(mp.goals, 0) AS player_goals,
  COALESCE(mt.goals, 0) AS team_goals,
  (SELECT MAX(mt2.goals) FROM match_teams mt2 WHERE mt2.match_id = mp.match_id AND mt2.team_number <> mp.team_number) AS opponent_goals
FROM match_players mp
INNER JOIN players p ON p.id = mp.player_id
INNER JOIN matches m ON {$matchStatsJoinSql}
LEFT JOIN match_teams mt ON mt.match_id = mp.match_id AND mt.team_number = mp.team_number
ORDER BY p.id ASC, m.match_date DESC, m.id DESC";

$stmtPlayerMatchDetails = $pdo->prepare($playerMatchDetailsSql);
$stmtPlayerMatchDetails->execute($params);
foreach ($stmtPlayerMatchDetails->fetchAll() as $detailRow) {
    $playerId = (int) $detailRow['player_id'];
    $dateIso = date('Y-m-d', strtotime((string) $detailRow['match_date']));
    $titleLabel = (string) ($detailRow['title'] ?: ('Fecha #' . $detailRow['match_id']));
    $playerAppearanceDetails[$playerId][] = [
        'date_iso' => $dateIso,
        'title' => $titleLabel,
    ];
    $playerGoals = (int) ($detailRow['player_goals'] ?? 0);
    if ($playerGoals > 0) {
        $playerGoalDetails[$playerId][] = [
            'date_iso' => $dateIso,
            'title' => $titleLabel,
            'goals' => $playerGoals,
        ];
    }
    $teamGoals = (int) ($detailRow['team_goals'] ?? 0);
    $opponentGoals = $detailRow['opponent_goals'] !== null ? (int) $detailRow['opponent_goals'] : null;
    if ($opponentGoals === null) {
        continue;
    }
    $resultKey = 'drawn';
    if ($teamGoals > $opponentGoals) {
        $resultKey = 'won';
    } elseif ($teamGoals < $opponentGoals) {
        $resultKey = 'lost';
    }
    $playerMatchDetails[$playerId][$resultKey][] = [
        'title' => (string) ($detailRow['title'] ?: ('Fecha #' . $detailRow['match_id'])),
        'date' => date('d/m/Y H:i', strtotime((string) $detailRow['match_date'])),
        'score' => $teamGoals . ' vs ' . $opponentGoals,
    ];
}

$captainWhere = ["m.status = 'finalizado'", "d.status = 'completed'"];
$captainParams = [];
if ($selectedYear !== 'all') {
    $captainWhere[] = 'm.match_date >= :year_from';
    $captainWhere[] = 'm.match_date <= :year_to';
    $captainParams['year_from'] = $selectedYear . '-01-01 00:00:00';
    $captainParams['year_to'] = $selectedYear . '-12-31 23:59:59';
}
if ($dateFrom !== '') {
    $captainWhere[] = 'm.match_date >= :date_from';
    $captainParams['date_from'] = date('Y-m-d 00:00:00', strtotime($dateFrom));
}
if ($dateTo !== '') {
    $captainWhere[] = 'm.match_date <= :date_to';
    $captainParams['date_to'] = date('Y-m-d 23:59:59', strtotime($dateTo));
}
if ($courtId > 0) {
    $captainWhere[] = 'm.rental_court_id = :court_id';
    $captainParams['court_id'] = $courtId;
}
$captainWhereSql = implode(' AND ', $captainWhere);

$captainsSql = "SELECT
  p.id,
  p.name,
  COUNT(*) AS partidos,
  SUM(
    CASE
      WHEN c.team_number = 1 AND scores.g1 > scores.g2 THEN 3
      WHEN c.team_number = 2 AND scores.g2 > scores.g1 THEN 3
      WHEN scores.g1 = scores.g2 THEN 1
      ELSE 0
    END
  ) AS puntos,
  SUM(CASE WHEN (c.team_number = 1 AND scores.g1 > scores.g2) OR (c.team_number = 2 AND scores.g2 > scores.g1) THEN 1 ELSE 0 END) AS ganados,
  SUM(CASE WHEN scores.g1 = scores.g2 THEN 1 ELSE 0 END) AS empatados,
  SUM(CASE WHEN (c.team_number = 1 AND scores.g1 < scores.g2) OR (c.team_number = 2 AND scores.g2 < scores.g1) THEN 1 ELSE 0 END) AS perdidos,
  SUM(CASE WHEN c.team_number = 1 THEN scores.g1 ELSE scores.g2 END) AS goles_favor,
  SUM(CASE WHEN c.team_number = 1 THEN scores.g2 ELSE scores.g1 END) AS goles_contra,
  SUM(CASE WHEN c.team_number = 1 THEN scores.g1 - scores.g2 ELSE scores.g2 - scores.g1 END) AS diferencia_gol
FROM matches m
INNER JOIN captain_drafts d ON d.match_id = m.id
INNER JOIN (
  SELECT 1 AS team_number
  UNION ALL
  SELECT 2 AS team_number
) c
INNER JOIN players p ON p.id = CASE WHEN c.team_number = 1 THEN d.captain1_player_id ELSE d.captain2_player_id END
INNER JOIN (
  SELECT
    match_id,
    COALESCE(SUM(CASE WHEN team_number = 1 THEN goals ELSE 0 END), 0) AS g1,
    COALESCE(SUM(CASE WHEN team_number = 2 THEN goals ELSE 0 END), 0) AS g2
  FROM match_players
  GROUP BY match_id
) scores ON scores.match_id = m.id
WHERE {$captainWhereSql}
GROUP BY p.id, p.name
HAVING COUNT(*) >= :min_matches
ORDER BY puntos DESC, diferencia_gol DESC, goles_favor DESC, p.name ASC";

$stmtCaptains = $pdo->prepare($captainsSql);
$stmtCaptains->execute($captainParams + ['min_matches' => $minMatches]);
$captains = $stmtCaptains->fetchAll();

$playerSearchRows = $ratings;
usort($playerSearchRows, static fn(array $a, array $b): int => strcasecmp((string) $a['name'], (string) $b['name']));

$title = 'Estadisticas | ' . APP_NAME;
$activePage = 'estadisticas.php';
$bodyClass = 'page-estadisticas';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Estadisticas</h1>
    <p class="small-muted">Rendimiento por jugador, capitanes y goleadores de fechas finalizadas. Vista: <?= h($selectedCourtLabel) ?> | <?= $selectedYear === 'all' ? 'Todos los aÃ±os' : h($selectedYear) ?>.</p>
    <div class="stats-head-summary" aria-label="Resumen de estadisticas">
      <span><?= h($selectedCourtLabel) ?></span>
      <span><?= h((string) ((int) $summary['partidos'])) ?> fechas</span>
      <span><?= h((string) ((int) $summary['jugadores'])) ?> jugadores</span>
      <span><?= h((string) ((int) $summary['goles_totales'])) ?> goles</span>
    </div>
  </div>
</section>

<section class="card stats-control-bar stats-filter-hub mb-3.5">
  <div class="stats-filter-hub-body">
  <div class="stats-court-switcher">
  <div class="stats-year-switcher">
    <div class="stats-court-switcher-head">
      <div>
        <h3>AÃ±o</h3>
        <p class="small-muted">Filtrar tabla por temporada calendario.</p>
      </div>
    </div>
    <div class="stats-year-options">
      <?php
        $allYearsParams = [
            'year' => 'all',
            'court_id' => $courtId,
        ];
      ?>
      <a class="stats-court-option stats-year-option<?= $selectedYear === 'all' ? ' is-active' : '' ?>" href="estadisticas.php?<?= h(http_build_query($allYearsParams)) ?>" data-partial-link data-partial-scroll="none" data-partial-target="main.content">
        <strong>Todos</strong>
        <small>Historico completo</small>
      </a>
      <?php foreach ($availableYears as $yearOption): ?>
        <?php
          $yearParams = [
              'year' => $yearOption,
              'court_id' => $courtId,
          ];
        ?>
        <a class="stats-court-option stats-year-option<?= $selectedYear === (string) $yearOption ? ' is-active' : '' ?>" href="estadisticas.php?<?= h(http_build_query($yearParams)) ?>" data-partial-link data-partial-scroll="none" data-partial-target="main.content">
          <strong><?= h((string) $yearOption) ?></strong>
          <small>Temporada</small>
        </a>
      <?php endforeach; ?>
    </div>
  </div>

  <div class="stats-court-group">
    <div class="stats-court-switcher-head">
      <div>
        <h3>Cancha</h3>
        <p class="small-muted">Elegir tabla de estadisticas por cancha o vista general.</p>
      </div>
    </div>
    <div class="stats-court-options">
      <?php
        $generalParams = array_filter([
            'year' => $selectedYear,
            'court_id' => 0,
            'date_from' => $dateFrom !== '' ? $dateFrom : null,
            'date_to' => $dateTo !== '' ? $dateTo : null,
        ], static fn($value): bool => $value !== null);
      ?>
      <a class="stats-court-option<?= $courtId === 0 ? ' is-active' : '' ?>" href="estadisticas.php?<?= h(http_build_query($generalParams)) ?>" data-partial-link data-partial-scroll="none" data-partial-target="main.content">
        <strong>General</strong>
        <small>Todas las canchas</small>
      </a>
      <?php foreach ($courts as $court): ?>
        <?php
          $courtParams = array_filter([
              'year' => $selectedYear,
              'court_id' => (int) $court['id'],
              'date_from' => $dateFrom !== '' ? $dateFrom : null,
              'date_to' => $dateTo !== '' ? $dateTo : null,
          ], static fn($value): bool => $value !== null);
          $courtLabel = trim((string) $court['place']) . ' - ' . trim((string) $court['court_key']);
          $courtDetail = rental_weekday_label((int) $court['weekday']) . ' ' . substr((string) $court['time_value'], 0, 5);
        ?>
        <a class="stats-court-option<?= (int) $court['id'] === $courtId ? ' is-active' : '' ?>" href="estadisticas.php?<?= h(http_build_query($courtParams)) ?>" data-partial-link data-partial-scroll="none" data-partial-target="main.content">
          <strong><?= h($courtLabel) ?></strong>
          <small><?= h($courtDetail) ?></small>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<div class="stats-control-filter">
  <form method="get" class="stats-filter-grid stats-inline-filter" data-partial-form data-partial-scroll="none" data-partial-target="main.content">
    <input type="hidden" name="year" value="<?= h($selectedYear) ?>">
    <input type="hidden" name="court_id" value="<?= (int) $courtId ?>">
    <div class="form-row">
      <label>Desde</label>
      <input type="date" name="date_from" value="<?= h($dateFrom) ?>">
    </div>
    <div class="form-row">
      <label>Hasta</label>
      <input type="date" name="date_to" value="<?= h($dateTo) ?>">
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" type="submit">Aplicar</button>
      <a class="btn btn-muted" href="estadisticas.php" data-partial-link data-partial-target="main.content">Limpiar</a>
    </div>
  </form>
</div>

<div class="stats-control-search">
  <div
    data-react-root
    data-react-island="stats_player_search"
    data-players="<?= h(json_encode(array_map(static fn(array $row): array => [
        'name' => (string) $row['name'],
        'matches' => (string) $row['partidos'],
        'goals' => (string) $row['goles'],
        'rating' => $row['rating_promedio'] !== null ? number_format((float) $row['rating_promedio'], 2) : '-',
        'pg' => (string) ((int) ($row['pg'] ?? 0)),
        'pe' => (string) ((int) ($row['pe'] ?? 0)),
        'pp' => (string) ((int) ($row['pp'] ?? 0)),
        'profileId' => 'stats-player-profile-' . (int) $row['id'],
    ], $playerSearchRows), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
  ></div>
  <datalist id="statsPlayerList">
    <?php foreach ($playerSearchRows as $row): ?>
      <option value="<?= h((string) $row['name']) ?>"></option>
    <?php endforeach; ?>
  </datalist>
</div>
  </div>
</section>

<section class="stats-player-result" data-stats-player-result hidden>
  <article class="stat-box">
    <div class="label">Jugador</div>
    <div class="value" data-stats-player-name>-</div>
  </article>
  <article class="stat-box">
    <div class="label">Fechas jugadas</div>
    <div class="value" data-stats-player-matches>-</div>
  </article>
  <article class="stat-box">
    <div class="label">Goles</div>
    <div class="value" data-stats-player-goals>-</div>
  </article>
  <article class="stat-box">
    <div class="label">Puntuacion promedio</div>
    <div class="value" data-stats-player-rating>-</div>
  </article>
  <article class="stat-box">
    <div class="label">PG</div>
    <div class="value" data-stats-player-pg>-</div>
  </article>
  <article class="stat-box">
    <div class="label">PE</div>
    <div class="value" data-stats-player-pe>-</div>
  </article>
  <article class="stat-box">
    <div class="label">PP</div>
    <div class="value" data-stats-player-pp>-</div>
  </article>
  <article class="stats-selected-profile-card" data-stats-selected-profile-card hidden>
    <div data-stats-selected-profile></div>
  </article>
</section>

<div class="stats-profile-sources" hidden>
  <?php foreach ($ratings as $row): ?>
    <?php
      $profilePlayer = $statsProfilePlayersById[(int) $row['id']] ?? null;
      if (!$profilePlayer) {
          continue;
      }
    ?>
    <div id="stats-player-profile-<?= (int) $row['id'] ?>">
      <section class="card profile-player-card-section stats-profile-card-section">
        <div class="section-toolbar profile-section-toolbar">
          <div>
            <h3>Ficha de jugador</h3>
            <p class="small-muted">Stats actuales, radar y lectura del perfil.</p>
          </div>
        </div>
        <div class="profile-detail-layout grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
          <?= shared_profile_player_card($profilePlayer, $profileStatLabels, $profileStatHelp) ?>
          <article class="stat-box profile-description-card">
            <div class="label">Descripcion</div>
            <p class="profile-description-text mt-2 text-sm font-semibold leading-relaxed"><?= h(shared_profile_player_description($profilePlayer, $profileStatLabels)) ?></p>
            <div class="mt-3 flex flex-wrap gap-2">
              <?php foreach (parse_positions_csv((string) $profilePlayer['positions']) as $position): ?>
                <span class="chip"><?= h($position) ?></span>
              <?php endforeach; ?>
              <span class="chip">GEN <?= h((string) shared_profile_player_fifa_overall(player_overall_rating($profilePlayer))) ?></span>
            </div>
          </article>
        </div>
      </section>
    </div>
  <?php endforeach; ?>
</div>

<details id="stats-jugadores" class="card stats-section stats-collapsible scroll-mt-20" open data-mobile-collapsed>
  <summary>
    <span>Tabla de jugadores</span>
    <small><?= h((string) count($ratings)) ?> jugadores</small>
  </summary>
  <div class="table-wrap">
    <div class="stats-player-grid" data-stats-sortable-grid>
      <div class="stats-player-grid-head">
        <button type="button" class="stats-sort-button" data-stats-sort="name" data-sort-type="text" aria-label="Ordenar jugadores por nombre">
          <span>Jugador</span>
          <small aria-hidden="true"></small>
        </button>
        <button type="button" class="stats-sort-button" data-stats-sort="matches" data-sort-type="number" aria-label="Ordenar jugadores por partidos jugados">
          <span>PJ</span>
          <small aria-hidden="true"></small>
        </button>
        <button type="button" class="stats-sort-button" data-stats-sort="goals" data-sort-type="number" aria-label="Ordenar jugadores por goles">
          <span>Goles</span>
          <small aria-hidden="true"></small>
        </button>
        <button type="button" class="stats-sort-button" data-stats-sort="rating" data-sort-type="number" aria-label="Ordenar jugadores por promedio">
          <span>Prom</span>
          <small aria-hidden="true"></small>
        </button>
        <button type="button" class="stats-sort-button" data-stats-sort="awardsTotal" data-sort-type="number" aria-label="Ordenar jugadores por cantidad de premios">
          <span>Detalles</span>
          <small aria-hidden="true"></small>
        </button>
      </div>
      <?php if (!$ratings): ?>
        <p class="empty-state stats-empty-state"><strong>Sin datos</strong><span>No hay jugadores con estadisticas para este filtro.</span></p>
      <?php else: ?>
        <?php foreach ($ratings as $rowIndex => $row): ?>
          <?php
            $sortableAwardTotal = 0;
            foreach ($awardDefinitions as $code => $award) {
                $sortableAwardTotal += max(0, (int) ($row['award_' . $code] ?? 0));
            }
            $playerRowId = (int) $row['id'];
            $matchesPanelId = 'stats-row-matches-' . $playerRowId;
            $goalsPanelId = 'stats-row-goals-' . $playerRowId;
          ?>
          <div class="stats-player-grid-row <?= (int) $row['id'] === $currentPlayerId ? 'is-current-player-row is-highlighted' : '' ?>" data-stats-player-row
              data-sort-index="<?= h((string) $rowIndex) ?>"
              data-player-name="<?= h((string) $row['name']) ?>"
              data-matches="<?= h((string) $row['partidos']) ?>"
              data-goals="<?= h((string) $row['goles']) ?>"
              data-rating="<?= $row['rating_promedio'] !== null ? h(number_format((float) $row['rating_promedio'], 2)) : '-' ?>"
              data-rating-sort="<?= $row['rating_promedio'] !== null ? h((string) (float) $row['rating_promedio']) : '' ?>"
              data-awards-total="<?= h((string) $sortableAwardTotal) ?>"
              data-profile-id="stats-player-profile-<?= (int) $row['id'] ?>"
              data-pg="<?= h((string) ((int) ($row['pg'] ?? 0))) ?>"
              data-pe="<?= h((string) ((int) ($row['pe'] ?? 0))) ?>"
              data-pp="<?= h((string) ((int) ($row['pp'] ?? 0))) ?>">
            <span class="stats-player-name"><?= h((string) $row['name']) ?><?= (int) $row['id'] === $currentPlayerId ? ' - Mi perfil' : '' ?></span>
            <span>
              <button
                type="button"
                class="stats-cell-detail-trigger"
                data-awards-trigger
                data-awards-target="<?= h($matchesPanelId) ?>"
                data-awards-player="<?= h((string) $row['name']) ?>"
                data-awards-title="Partidos jugados - <?= h((string) $row['name']) ?>"
                title="Ver partidos de <?= h((string) $row['name']) ?>"
              ><?= h((string) $row['partidos']) ?></button>
            </span>
            <span>
              <button
                type="button"
                class="stats-cell-detail-trigger"
                data-awards-trigger
                data-awards-target="<?= h($goalsPanelId) ?>"
                data-awards-player="<?= h((string) $row['name']) ?>"
                data-awards-title="Goles - <?= h((string) $row['name']) ?>"
                title="Ver goles de <?= h((string) $row['name']) ?>"
              ><?= h((string) $row['goles']) ?></button>
            </span>
            <span><?= $row['rating_promedio'] !== null ? h(number_format((float) $row['rating_promedio'], 2)) : '-' ?></span>
            <span class="award-stat-cell">
                <?php
                  $playerAwardItems = [];
                  $playerGoodAwardItems = [];
                  $playerBadAwardItems = [];
                  $playerGoodAwardTotal = 0;
                  $playerBadAwardTotal = 0;
                  foreach ($awardDefinitions as $code => $award) {
                      $awardCount = (int) ($row['award_' . $code] ?? 0);
                      if ($awardCount <= 0) {
                          continue;
                      }
                      $awardType = (string) ($award['type'] ?? 'good');
                      if ($awardType === 'bad') {
                          $playerBadAwardTotal += $awardCount;
                      } else {
                          $playerGoodAwardTotal += $awardCount;
                      }
                      $playerAwardItems[] = [
                          'icon' => (string) $award['icon'],
                          'label' => (string) $award['label'],
                          'description' => (string) ($award['description'] ?? $awardDescriptions[$code] ?? ''),
                          'count' => $awardCount,
                          'type' => $awardType,
                          'dates' => $playerAwardDates[(int) $row['id']][$code] ?? [],
                      ];
                      if ($awardType === 'bad') {
                          $playerBadAwardItems[] = $playerAwardItems[array_key_last($playerAwardItems)];
                      } else {
                          $playerGoodAwardItems[] = $playerAwardItems[array_key_last($playerAwardItems)];
                      }
                  }
                  $awardPanelId = 'awards-player-' . (int) $row['id'];
                  $goodAwardPanelId = $awardPanelId . '-good';
                  $badAwardPanelId = $awardPanelId . '-bad';
                  $performancePanelId = 'performance-player-' . (int) $row['id'];
                  $performanceDetails = $playerMatchDetails[(int) $row['id']] ?? [];
                  $performanceGroups = [
                      'won' => ['label' => 'GANADOS', 'items' => $performanceDetails['won'] ?? []],
                      'drawn' => ['label' => 'EMPATADOS', 'items' => $performanceDetails['drawn'] ?? []],
                      'lost' => ['label' => 'PERDIDOS', 'items' => $performanceDetails['lost'] ?? []],
                  ];
                ?>
                <button
                  type="button"
                  class="award-summary-button award-icon-only"
                  data-awards-trigger
                  data-awards-target="<?= h($performancePanelId) ?>"
                  data-awards-player="<?= h((string) $row['name']) ?>"
                  data-awards-title="Rendimiento - <?= h((string) $row['name']) ?>"
                  aria-label="Ver rendimiento de <?= h((string) $row['name']) ?>"
                  title="Rendimiento"
                >
                  <span class="award-count-icon">&#128200;</span>
                </button>
                <?php if ($playerAwardItems): ?>
                  <?php if ($playerGoodAwardTotal > 0): ?>
                    <button
                      type="button"
                      class="award-summary-button"
                      data-awards-trigger
                      data-awards-target="<?= h($goodAwardPanelId) ?>"
                      data-awards-player="<?= h((string) $row['name']) ?>"
                      aria-label="Ver premios buenos de <?= h((string) $row['name']) ?>"
                      title="Premios buenos"
                    >
                      <span>&#127941;</span><strong>x<?= h((string) $playerGoodAwardTotal) ?></strong>
                    </button>
                  <?php endif; ?>
                  <?php if ($playerBadAwardTotal > 0): ?>
                    <button
                      type="button"
                      class="award-summary-button"
                      data-awards-trigger
                      data-awards-target="<?= h($badAwardPanelId) ?>"
                      data-awards-player="<?= h((string) $row['name']) ?>"
                      aria-label="Ver premios malos de <?= h((string) $row['name']) ?>"
                      title="Premios malos"
                    >
                      <span>&#129313;</span><strong>x<?= h((string) $playerBadAwardTotal) ?></strong>
                    </button>
                  <?php endif; ?>
                <?php else: ?>
                  <button
                    type="button"
                    class="award-summary-button"
                    data-awards-trigger
                    data-awards-target="<?= h($awardPanelId) ?>"
                    data-awards-player="<?= h((string) $row['name']) ?>"
                    aria-label="Ver detalle estadistico de <?= h((string) $row['name']) ?>"
                  >
                    <span>+</span>
                    <strong>ver</strong>
                  </button>
                <?php endif; ?>
                <?php foreach ([
                    $goodAwardPanelId => $playerGoodAwardItems,
                    $badAwardPanelId => $playerBadAwardItems,
                ] as $categoryPanelId => $categoryAwardItems): ?>
                  <div id="<?= h($categoryPanelId) ?>" class="award-popover-source" hidden>
                    <div class="award-popover-list">
                      <?php foreach ($categoryAwardItems as $awardItem): ?>
                        <details class="award-popover-item award-popover-detail">
                          <summary>
                            <span class="award-popover-icon"><?= h($awardItem['icon']) ?></span>
                            <span>
                              <strong><?= h($awardItem['label']) ?> x<?= h((string) $awardItem['count']) ?></strong>
                              <small><?= h($awardItem['description']) ?></small>
                            </span>
                          </summary>
                          <div class="award-popover-dates">
                            <?php if (!empty($awardItem['dates'])): ?>
                              <?php foreach ($awardItem['dates'] as $awardDate): ?>
                                <span><?= h($awardDate['title']) ?> | <?= h($awardDate['date']) ?></span>
                              <?php endforeach; ?>
                            <?php else: ?>
                              <span>Sin fechas registradas para este filtro.</span>
                            <?php endif; ?>
                          </div>
                        </details>
                      <?php endforeach; ?>
                    </div>
                  </div>
                <?php endforeach; ?>
                <div id="<?= h($performancePanelId) ?>" class="award-popover-source" hidden>
                  <div class="award-popover-list">
                    <?php foreach ($performanceGroups as $performanceGroup): ?>
                      <div class="award-popover-item performance-popover-item">
                        <span class="award-popover-icon"><?= h((string) count($performanceGroup['items'])) ?></span>
                        <span>
                          <strong><?= h($performanceGroup['label']) ?></strong>
                          <?php if ($performanceGroup['items']): ?>
                            <?php foreach ($performanceGroup['items'] as $matchDetail): ?>
                              <small><?= h($matchDetail['title']) ?> | <?= h($matchDetail['date']) ?> | <?= h($matchDetail['score']) ?></small>
                            <?php endforeach; ?>
                          <?php else: ?>
                            <small>Sin fechas en esta categoria.</small>
                          <?php endif; ?>
                        </span>
                      </div>
                    <?php endforeach; ?>
                  </div>
                </div>
                <div id="<?= h($awardPanelId) ?>" class="award-popover-source" hidden>
                  <div class="award-popover-list">
                    <?php if ($playerAwardItems): ?>
                      <?php foreach ($playerAwardItems as $awardItem): ?>
                        <details class="award-popover-item award-popover-detail">
                          <summary>
                            <span class="award-popover-icon"><?= h($awardItem['icon']) ?></span>
                            <span>
                              <strong><?= h($awardItem['label']) ?> x<?= h((string) $awardItem['count']) ?></strong>
                              <small><?= h($awardItem['description']) ?></small>
                            </span>
                          </summary>
                          <div class="award-popover-dates">
                            <?php if (!empty($awardItem['dates'])): ?>
                              <?php foreach ($awardItem['dates'] as $awardDate): ?>
                                <span><?= h($awardDate['title']) ?> | <?= h($awardDate['date']) ?></span>
                              <?php endforeach; ?>
                            <?php else: ?>
                              <span>Sin fechas registradas para este filtro.</span>
                            <?php endif; ?>
                          </div>
                        </details>
                      <?php endforeach; ?>
                    <?php else: ?>
                      <div class="award-popover-item">
                        <span class="award-popover-icon">-</span>
                        <span>
                          <strong>Sin premios acumulados</strong>
                          <small>Todavia no tiene premios cargados en el filtro actual.</small>
                        </span>
                      </div>
                    <?php endif; ?>
                    <div class="award-popover-item player-record-item">
                      <span class="award-popover-icon">PJ</span>
                      <span>
                        <strong>Rendimiento por resultado</strong>
                        <small>PG <?= h((string) ((int) ($row['pg'] ?? 0))) ?> | PE <?= h((string) ((int) ($row['pe'] ?? 0))) ?> | PP <?= h((string) ((int) ($row['pp'] ?? 0))) ?></small>
                      </span>
                    </div>
                  </div>
                </div>
                <div id="<?= h($matchesPanelId) ?>" class="stats-row-detail-source" hidden>
                  <div class="award-popover-list stats-bottom-detail-list">
                    <div class="award-popover-item player-record-item">
                      <span class="award-popover-icon">PJ</span>
                      <span>
                        <strong><?= h((string) count($playerAppearanceDetails[$playerRowId] ?? [])) ?> partidos jugados</strong>
                        <small>Detalle cronologico del filtro actual.</small>
                      </span>
                    </div>
                      <?php foreach (($playerAppearanceDetails[$playerRowId] ?? []) as $matchDetail): ?>
                        <div class="award-popover-item stats-bottom-detail-item">
                          <span class="award-popover-icon"><?= h(date('d/m', strtotime((string) $matchDetail['date_iso']))) ?></span>
                          <span>
                            <strong><?= h((string) $matchDetail['date_iso']) ?></strong>
                            <small><?= h((string) $matchDetail['title']) ?></small>
                          </span>
                        </div>
                      <?php endforeach; ?>
                  </div>
                </div>
                <div id="<?= h($goalsPanelId) ?>" class="stats-row-detail-source" hidden>
                  <div class="award-popover-list stats-bottom-detail-list">
                    <div class="award-popover-item player-record-item">
                      <span class="award-popover-icon">G</span>
                      <span>
                        <strong><?= h((string) (int) $row['goles']) ?> goles</strong>
                        <small>Fechas donde convirtio en el filtro actual.</small>
                      </span>
                    </div>
                      <?php if (!empty($playerGoalDetails[$playerRowId])): ?>
                        <?php foreach ($playerGoalDetails[$playerRowId] as $goalDetail): ?>
                          <div class="award-popover-item stats-bottom-detail-item stats-bottom-detail-item-with-value">
                            <span class="award-popover-icon"><?= h((string) $goalDetail['goals']) ?></span>
                            <span>
                              <strong><?= h((string) $goalDetail['date_iso']) ?></strong>
                              <small><?= h((string) $goalDetail['title']) ?></small>
                            </span>
                          </div>
                        <?php endforeach; ?>
                      <?php else: ?>
                        <div class="award-popover-item">
                          <span class="award-popover-icon">0</span>
                          <span>
                            <strong>Sin goles registrados</strong>
                            <small>No tiene goles en el filtro actual.</small>
                          </span>
                        </div>
                      <?php endif; ?>
                  </div>
                </div>
            </span>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </div>
</details>

<div class="award-floating-panel" data-awards-popover hidden>
  <div class="award-floating-card" role="dialog" aria-modal="true" aria-labelledby="awardFloatingTitle">
    <div class="award-floating-head">
      <strong id="awardFloatingTitle" data-awards-popover-title>Premios</strong>
      <button type="button" class="award-floating-close" data-awards-popover-close aria-label="Cerrar">x</button>
    </div>
    <div data-awards-popover-body></div>
  </div>
</div>

<details id="stats-goleadores" class="card stats-section stats-collapsible scroll-mt-20" open data-mobile-collapsed>
  <summary>
    <span>Ranking de goleadores</span>
    <small><?= h((string) count($scorers)) ?> jugadores</small>
  </summary>
  <div class="table-wrap">
    <div class="stats-compact-grid stats-scorers-grid">
      <div class="stats-compact-grid-head" aria-hidden="true">
        <span>Jugador</span>
        <span>PJ</span>
        <span>Goles</span>
        <span>G/P</span>
      </div>
      <?php if (!$scorers): ?>
        <p class="empty-state stats-compact-empty"><strong>Sin goles</strong><span>No hay datos para este filtro.</span></p>
      <?php else: ?>
        <?php foreach ($scorers as $row): ?>
          <div class="stats-compact-grid-row <?= (int) $row['id'] === $currentPlayerId ? 'is-current-player-row is-highlighted' : '' ?>" data-stats-player-filter-row data-player-name="<?= h((string) $row['name']) ?>">
            <span class="stats-compact-name"><?= h((string) $row['name']) ?><?= (int) $row['id'] === $currentPlayerId ? ' - Mi perfil' : '' ?></span>
            <span><?= h((string) $row['partidos']) ?></span>
            <span><strong><?= h((string) $row['goles']) ?></strong></span>
            <span><?= h(number_format((float) $row['gol_por_partido'], 2)) ?></span>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </div>
</details>

<details id="stats-capitanes" class="card stats-section stats-collapsible scroll-mt-20" open data-mobile-collapsed>
  <summary>
    <span>Tabla de capitanes</span>
    <small><?= h((string) count($captains)) ?> capitanes</small>
  </summary>
  <p class="small-muted">Victoria 3 puntos, empate 1 punto.</p>
  <div class="table-wrap">
    <div class="stats-compact-grid stats-captains-grid">
      <div class="stats-compact-grid-head" aria-hidden="true">
        <span>Capitan</span>
        <span>Pts</span>
        <span>PJ</span>
        <span>G</span>
        <span>E</span>
        <span>P</span>
        <span>GF</span>
        <span>GC</span>
        <span>DG</span>
      </div>
      <?php if (!$captains): ?>
        <p class="empty-state stats-compact-empty"><strong>Sin capitanes</strong><span>No hay fechas finalizadas en modo capitanes para este filtro.</span></p>
      <?php else: ?>
        <?php foreach ($captains as $row): ?>
          <div class="stats-compact-grid-row <?= (int) $row['id'] === $currentPlayerId ? 'is-current-player-row is-highlighted' : '' ?>" data-stats-player-filter-row data-player-name="<?= h((string) $row['name']) ?>">
            <span class="stats-compact-name"><?= h((string) $row['name']) ?><?= (int) $row['id'] === $currentPlayerId ? ' - Mi perfil' : '' ?></span>
            <span><strong><?= h((string) $row['puntos']) ?></strong></span>
            <span><?= h((string) $row['partidos']) ?></span>
            <span><?= h((string) $row['ganados']) ?></span>
            <span><?= h((string) $row['empatados']) ?></span>
            <span><?= h((string) $row['perdidos']) ?></span>
            <span><?= h((string) $row['goles_favor']) ?></span>
            <span><?= h((string) $row['goles_contra']) ?></span>
            <span><?= h((string) $row['diferencia_gol']) ?></span>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </div>
</details>

<div id="stats-premios" class="scroll-mt-20">
  <?= award_legend_details_html($awardLegendDefinitions, $awardLegendDescriptions) ?>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>


