<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/awards.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/directivos.php';

$pdo = db();
ensure_control_schema();
ensure_match_awards_schema();
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
    'goodfellas' => 'Mejor actitud y buen compañero.',
];

$dateFrom = trim((string) ($_GET['date_from'] ?? ''));
$dateTo = trim((string) ($_GET['date_to'] ?? ''));
$minMatches = 1;

$where = ["m.status = 'finalizado'"];
$params = [];

if ($dateFrom !== '') {
    $where[] = 'm.match_date >= :date_from';
    $params['date_from'] = date('Y-m-d 00:00:00', strtotime($dateFrom));
}
if ($dateTo !== '') {
    $where[] = 'm.match_date <= :date_to';
    $params['date_to'] = date('Y-m-d 23:59:59', strtotime($dateTo));
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
if ($dateFrom !== '') {
    $matchStatsJoin[] = 'm.match_date >= :date_from';
}
if ($dateTo !== '') {
    $matchStatsJoin[] = 'm.match_date <= :date_to';
}
$matchStatsJoinSql = implode(' AND ', $matchStatsJoin);

$awardWhere = ["am.status = 'finalizado'"];
$awardParams = [];
if ($dateFrom !== '') {
    $awardWhere[] = 'am.match_date >= :award_date_from';
    $awardParams['award_date_from'] = date('Y-m-d 00:00:00', strtotime($dateFrom));
}
if ($dateTo !== '') {
    $awardWhere[] = 'am.match_date <= :award_date_to';
    $awardParams['award_date_to'] = date('Y-m-d 23:59:59', strtotime($dateTo));
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
ORDER BY partidos DESC, rating_promedio DESC, indice_rendimiento DESC, p.name ASC
LIMIT 100";

$stmtRatings = $pdo->prepare($ratingSql);
$stmtRatings->execute($params + $awardParams + ['min_matches' => $minMatches]);
$ratings = $stmtRatings->fetchAll();

$playerMatchDetails = [];
$playerMatchDetailsSql = "SELECT
  p.id AS player_id,
  m.id AS match_id,
  m.title,
  m.match_date,
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
if ($dateFrom !== '') {
    $captainWhere[] = 'm.match_date >= :date_from';
    $captainParams['date_from'] = date('Y-m-d 00:00:00', strtotime($dateFrom));
}
if ($dateTo !== '') {
    $captainWhere[] = 'm.match_date <= :date_to';
    $captainParams['date_to'] = date('Y-m-d 23:59:59', strtotime($dateTo));
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
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Estadisticas</h1>
    <p class="small-muted">Rendimiento por jugador, capitanes y goleadores de fechas finalizadas.</p>
  </div>
</section>

<nav class="visual-tab-nav stats-tab-nav" aria-label="Secciones de estadisticas">
  <a href="#stats-jugadores">Jugadores</a>
  <a href="#stats-goleadores">Goleadores</a>
  <a href="#stats-capitanes">Capitanes</a>
  <a href="#stats-premios">Premios</a>
</nav>

<details class="card stats-filter-menu mb-3.5">
  <summary>Filtros</summary>
  <form method="get" class="stats-filter-grid" data-partial-form data-partial-target="main.content">
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
</details>

<section class="card stats-search-card">
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
    ], $playerSearchRows), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
  ></div>
  <datalist id="statsPlayerList">
    <?php foreach ($playerSearchRows as $row): ?>
      <option value="<?= h((string) $row['name']) ?>"></option>
    <?php endforeach; ?>
  </datalist>
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
</section>

<section class="stats-summary">
  <span><?= h((string) ((int) $summary['partidos'])) ?> fechas</span>
  <span><?= h((string) ((int) $summary['jugadores'])) ?> jugadores</span>
  <span><?= h((string) ((int) $summary['goles_totales'])) ?> goles</span>
  <span>Promedio <?= $summary['promedio_general'] !== null ? h(number_format((float) $summary['promedio_general'], 2)) : '-' ?></span>
</section>

<details id="stats-jugadores" class="card stats-section stats-collapsible scroll-mt-20" open data-mobile-collapsed>
  <summary>
    <span>Tabla de jugadores</span>
    <small><?= h((string) count($ratings)) ?> jugadores</small>
  </summary>
  <div class="table-wrap">
    <div class="stats-player-grid">
      <div class="stats-player-grid-head" aria-hidden="true">
        <span>Jugador</span>
        <span>PJ</span>
        <span>Goles</span>
        <span>Prom</span>
        <span>Detalles</span>
      </div>
      <?php if (!$ratings): ?>
        <p class="empty-state stats-empty-state"><strong>Sin datos</strong><span>No hay jugadores con estadisticas para este filtro.</span></p>
      <?php else: ?>
        <?php foreach ($ratings as $row): ?>
          <div class="stats-player-grid-row" data-stats-player-row
              data-player-name="<?= h((string) $row['name']) ?>"
              data-matches="<?= h((string) $row['partidos']) ?>"
              data-goals="<?= h((string) $row['goles']) ?>"
              data-rating="<?= $row['rating_promedio'] !== null ? h(number_format((float) $row['rating_promedio'], 2)) : '-' ?>"
              data-pg="<?= h((string) ((int) ($row['pg'] ?? 0))) ?>"
              data-pe="<?= h((string) ((int) ($row['pe'] ?? 0))) ?>"
              data-pp="<?= h((string) ((int) ($row['pp'] ?? 0))) ?>">
            <span class="stats-player-name"><?= h((string) $row['name']) ?></span>
            <span><?= h((string) $row['partidos']) ?></span>
            <span><?= h((string) $row['goles']) ?></span>
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
                        <div class="award-popover-item">
                          <span class="award-popover-icon"><?= h($awardItem['icon']) ?></span>
                          <span>
                            <strong><?= h($awardItem['label']) ?> x<?= h((string) $awardItem['count']) ?></strong>
                            <small><?= h($awardItem['description']) ?></small>
                          </span>
                        </div>
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
                        <div class="award-popover-item">
                          <span class="award-popover-icon"><?= h($awardItem['icon']) ?></span>
                          <span>
                            <strong><?= h($awardItem['label']) ?> x<?= h((string) $awardItem['count']) ?></strong>
                            <small><?= h($awardItem['description']) ?></small>
                          </span>
                        </div>
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
          <div class="stats-compact-grid-row" data-stats-player-filter-row data-player-name="<?= h((string) $row['name']) ?>">
            <span class="stats-compact-name"><?= h((string) $row['name']) ?></span>
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
          <div class="stats-compact-grid-row" data-stats-player-filter-row data-player-name="<?= h((string) $row['name']) ?>">
            <span class="stats-compact-name"><?= h((string) $row['name']) ?></span>
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
  <?= award_legend_details_html($awardDefinitions, $awardDescriptions) ?>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
