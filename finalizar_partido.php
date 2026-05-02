<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';

require_admin();

$pdo = db();
ensure_match_awards_schema();
$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_result') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $teamGoalsData = $_POST['team_goals'] ?? [];
    $goalsData = $_POST['goals'] ?? [];
    $ratingData = $_POST['rating'] ?? [];
    $awardData = $_POST['awards'] ?? [];

    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        flash('error', 'Encuentro invalido.');
        redirect('finalizar_partido.php');
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        flash('error', 'Solo se puede finalizar un encuentro con equipos ya sorteados o capitanes completos.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $participants = repo_match_participants($matchId);
    $assignedCount = 0;
    $teamsSeen = [];
    foreach ($participants as $p) {
        if ($p['team_number'] !== null) {
            $assignedCount++;
            $teamsSeen[(int) $p['team_number']] = true;
        }
    }
    if (!$participants || $assignedCount !== count($participants) || count($teamsSeen) !== (int) $match['num_teams']) {
        flash('error', 'El encuentro no tiene todos los jugadores asignados a equipos.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $teams = repo_match_teams($matchId);
    if (count($teams) !== (int) $match['num_teams']) {
        flash('error', 'Faltan datos de equipos. Vuelve a generar el sorteo o completa capitanes.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        if (!isset($teamGoalsData[$teamNumber]) || trim((string) $teamGoalsData[$teamNumber]) === '') {
            flash('error', 'Primero carga el resultado del partido.');
            redirect('finalizar_partido.php?match_id=' . $matchId);
        }
    }

    $expectedTeamGoals = [];
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        $expectedTeamGoals[$teamNumber] = max(0, (int) ($teamGoalsData[$teamNumber] ?? 0));
    }

    $playerGoalsByTeam = [];
    foreach ($participants as $player) {
        if ($player['team_number'] === null) {
            continue;
        }
        $teamNumber = (int) $player['team_number'];
        $pid = (int) $player['id'];
        $playerGoalsByTeam[$teamNumber] = ($playerGoalsByTeam[$teamNumber] ?? 0) + max(0, (int) ($goalsData[$pid] ?? 0));
    }

    foreach ($expectedTeamGoals as $teamNumber => $expectedGoals) {
        $loadedGoals = (int) ($playerGoalsByTeam[$teamNumber] ?? 0);
        if ($loadedGoals !== $expectedGoals) {
            $matchTeams = repo_match_teams($matchId);
            $teamLabels = repo_match_team_labels($match, $matchTeams);
            $teamLabel = $teamLabels[$teamNumber] ?? ('Equipo ' . $teamNumber);
            $diff = $expectedGoals - $loadedGoals;
            $detail = $diff > 0
                ? 'faltan ' . $diff . ' gol' . ($diff === 1 ? '' : 'es')
                : 'sobran ' . abs($diff) . ' gol' . (abs($diff) === 1 ? '' : 'es');
            flash('error', "{$teamLabel}: el resultado indica {$expectedGoals} goles y los jugadores suman {$loadedGoals}; {$detail}. Corrige los goles por jugador antes de guardar.");
            redirect('finalizar_partido.php?match_id=' . $matchId . '&edit_details=1');
        }
    }

    $pdo->beginTransaction();
    try {
        $saveTeamGoals = $pdo->prepare(
            'UPDATE match_teams
             SET goals = :goals
             WHERE match_id = :mid AND team_number = :team_number'
        );
        foreach ($teams as $team) {
            $teamNumber = (int) $team['team_number'];
            $saveTeamGoals->execute([
                'mid' => $matchId,
                'team_number' => $teamNumber,
                'goals' => max(0, (int) ($teamGoalsData[$teamNumber] ?? 0)),
            ]);
        }

        $upd = $pdo->prepare(
            'UPDATE match_players
             SET goals = :goals, rating = :rating
             WHERE match_id = :mid AND player_id = :pid'
        );

        $allowedAwardPlayerIds = [];
        foreach ($participants as $player) {
            $pid = (int) $player['id'];
            if ($player['team_number'] === null) {
                continue;
            }
            $allowedAwardPlayerIds[] = $pid;
            $goals = max(0, (int) ($goalsData[$pid] ?? 0));
            $ratingRaw = $ratingData[$pid] ?? '';
            $rating = null;
            if ($ratingRaw !== '' && $ratingRaw !== null) {
                $rating = max(1.0, min(10.0, round(((float) $ratingRaw) * 2) / 2));
            }
            $upd->execute([
                'mid' => $matchId,
                'pid' => $pid,
                'goals' => $goals,
                'rating' => $rating,
            ]);
        }

        $parsedAwards = [];
        foreach (award_definitions() as $code => $_definition) {
            $rawAward = trim((string) ($awardData[$code] ?? ''));
            if ($rawAward === '') {
                $parsedAwards[$code] = 0;
                continue;
            }
            if (preg_match('/#(\d+)/', $rawAward, $matchAward)) {
                $parsedAwards[$code] = (int) $matchAward[1];
                continue;
            }
            throw new RuntimeException('Selecciona los premios desde la lista de jugadores del encuentro.');
        }
        repo_save_match_awards($matchId, $parsedAwards, $allowedAwardPlayerIds);

        $stmt = $pdo->prepare('UPDATE matches SET status = :status, finalized_at = NOW() WHERE id = :id');
        $stmt->execute(['status' => 'finalizado', 'id' => $matchId]);

        $pdo->commit();
        flash('success', 'Datos del encuentro guardados. Partido finalizado.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        flash('error', 'No se pudo guardar: ' . $e->getMessage());
    }
    redirect('finalizar_partido.php?match_id=' . $matchId);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_score') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $teamGoalsData = $_POST['team_goals'] ?? [];

    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        flash('error', 'Encuentro invalido.');
        redirect('finalizar_partido.php');
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        flash('error', 'Solo se puede cargar resultado de un encuentro con equipos ya formados.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $teams = repo_match_teams($matchId);
    if (!$teams) {
        flash('error', 'Faltan datos de equipos. Vuelve a generar el sorteo o completa capitanes.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        if (!isset($teamGoalsData[$teamNumber]) || trim((string) $teamGoalsData[$teamNumber]) === '') {
            flash('error', 'Carga el resultado del partido.');
            redirect('finalizar_partido.php?match_id=' . $matchId);
        }
    }

    $pdo->beginTransaction();
    try {
        $saveTeamGoals = $pdo->prepare(
            'UPDATE match_teams
             SET goals = :goals
             WHERE match_id = :mid AND team_number = :team_number'
        );
        foreach ($teams as $team) {
            $teamNumber = (int) $team['team_number'];
            $saveTeamGoals->execute([
                'mid' => $matchId,
                'team_number' => $teamNumber,
                'goals' => max(0, (int) ($teamGoalsData[$teamNumber] ?? 0)),
            ]);
        }
        $stmt = $pdo->prepare('UPDATE matches SET status = :status, finalized_at = COALESCE(finalized_at, NOW()) WHERE id = :id');
        $stmt->execute(['status' => 'finalizado', 'id' => $matchId]);
        $pdo->commit();
        flash('success', 'Resultado guardado. Ya puedes cargar puntajes y premios.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        flash('error', 'No se pudo guardar el resultado: ' . $e->getMessage());
    }
    redirect('finalizar_partido.php?match_id=' . $matchId);
}

$matches = repo_matches("status IN ('sorteado','finalizado')");
$selectedMatch = $matchId > 0 ? repo_match_by_id($matchId) : null;
$participants = $selectedMatch ? repo_match_participants((int) $selectedMatch['id']) : [];
$groupedTeams = $selectedMatch ? repo_grouped_team_players((int) $selectedMatch['id']) : [];
$awardDefinitions = award_definitions();
$savedAwards = $selectedMatch ? repo_match_awards((int) $selectedMatch['id']) : [];
$editDetails = isset($_GET['edit_details']) && $_GET['edit_details'] === '1';

$title = 'Finalizar encuentro | ' . APP_NAME;
$activePage = 'finalizar_partido.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Finalizar encuentro</h1>
    <p class="small-muted">Carga goles y calificacion por jugador para cerrar el partido y sumar estadisticas.</p>
  </div>
</section>

<section class="card mb-3.5">
  <form method="get" class="form-grid">
    <div class="form-row">
      <label>Seleccionar encuentro</label>
      <select name="match_id" onchange="this.form.submit()">
        <option value="">Elegir...</option>
        <?php foreach ($matches as $m): ?>
          <option value="<?= (int) $m['id'] ?>" <?= selected_attr($selectedMatch && (int) $selectedMatch['id'] === (int) $m['id']) ?>>
            <?= h(date('d/m H:i', strtotime((string) $m['match_date'])) . ' - ' . ($m['title'] ?: ('Partido #' . $m['id'])) . ' [' . $m['status'] . ']') ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
  </form>
</section>

<?php if ($selectedMatch): ?>
  <section class="card mb-3.5">
    <h3><?= h((string) ($selectedMatch['title'] ?: ('Partido #' . $selectedMatch['id']))) ?></h3>
    <p class="small-muted">Estado actual: <strong><?= h((string) $selectedMatch['status']) ?></strong></p>
    <?php if (!$groupedTeams): ?>
      <p>No hay equipos sorteados todavia para este encuentro.</p>
    <?php else: ?>
      <?php
        $matchTeams = repo_match_teams((int) $selectedMatch['id']);
        $teamLabels = repo_match_team_labels($selectedMatch, $matchTeams);
        $scoreSaved = (string) $selectedMatch['status'] === 'finalizado' || array_sum(array_map(static fn(array $team): int => (int) ($team['goals'] ?? 0), $matchTeams)) > 0;
      ?>
      <section class="card finish-score-shell">
        <form method="post">
          <input type="hidden" name="action" value="save_score">
          <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
          <div class="finish-score-head">
            <div>
              <h3>Resultado del partido</h3>
              <p class="small-muted">Primero guarda como salio el encuentro.</p>
            </div>
          </div>
          <div class="finish-result-grid">
            <?php foreach ($matchTeams as $team): ?>
              <div class="finish-result-team">
                <label><?= h($teamLabels[(int) $team['team_number']] ?? ('Equipo ' . (int) $team['team_number'])) ?></label>
                <input type="number" min="0" step="1" name="team_goals[<?= (int) $team['team_number'] ?>]" value="<?= h((string) ((int) ($team['goals'] ?? 0))) ?>" required>
              </div>
            <?php endforeach; ?>
          </div>
          <div class="btn-row finish-score-actions">
            <button class="btn btn-primary" type="submit">Guardar resultado</button>
            <?php if ($scoreSaved): ?>
              <a class="btn btn-muted finish-edit-btn" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>&edit_details=<?= $editDetails ? '0' : '1' ?>" title="Editar puntajes y premios"><span class="finish-edit-icon">&#9999;</span><span>Valoraciones</span></a>
            <?php else: ?>
              <span class="btn btn-disabled finish-edit-btn" title="Guarda el resultado para habilitar puntajes y premios"><span class="finish-edit-icon">&#9999;</span><span>Valoraciones</span></span>
            <?php endif; ?>
          </div>
        </form>
      </section>

      <?php if ($scoreSaved && $editDetails): ?>
      <form method="post">
        <input type="hidden" name="action" value="save_result">
        <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
        <datalist id="matchAwardPlayers">
          <?php foreach ($participants as $player): ?>
            <?php if ($player['team_number'] === null) continue; ?>
            <option value="<?= h((string) $player['name'] . ' (#' . (int) $player['id'] . ')') ?>"></option>
          <?php endforeach; ?>
        </datalist>
        <datalist id="matchAwardGoalkeepers">
          <?php foreach ($participants as $player): ?>
            <?php if ($player['team_number'] === null || !in_array('ARQ', parse_positions_csv((string) $player['positions']), true)) continue; ?>
            <option value="<?= h((string) $player['name'] . ' (#' . (int) $player['id'] . ')') ?>"></option>
          <?php endforeach; ?>
        </datalist>

        <?php foreach ($matchTeams as $team): ?>
          <input type="hidden" name="team_goals[<?= (int) $team['team_number'] ?>]" value="<?= h((string) ((int) ($team['goals'] ?? 0))) ?>">
        <?php endforeach; ?>

        <?php foreach ($groupedTeams as $teamNumber => $lines): ?>
          <article class="card mb-3">
            <h4><?= h($teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber)) ?></h4>
            <div class="table-wrap">
              <table class="finish-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Goles</th>
                    <th>Puntuacion</th>
                  </tr>
                </thead>
                <tbody>
                <?php foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line): ?>
                  <?php foreach ($lines[$line] as $p): ?>
                    <?php $ratingValue = $p['rating'] !== null && $p['rating'] !== '' ? (string) $p['rating'] : '5'; ?>
                    <tr>
                      <td data-label="Jugador">
                        <strong><?= h((string) $p['name']) ?></strong>
                        <small><?= h((string) $line) ?></small>
                      </td>
                      <td data-label="Goles">
                        <input class="finish-number-input" type="number" min="0" step="1" name="goals[<?= (int) $p['id'] ?>]" value="<?= h((string) ((int) ($p['goals'] ?? 0))) ?>">
                      </td>
                      <td data-label="Puntuacion">
                        <input class="finish-number-input" type="number" min="1" max="10" step="0.5" name="rating[<?= (int) $p['id'] ?>]" value="<?= h($ratingValue) ?>">
                      </td>
                    </tr>
                  <?php endforeach; ?>
                <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          </article>
        <?php endforeach; ?>

        <details class="card finish-awards">
          <summary>
            <span>Premios</span>
            <small>Opcional</small>
          </summary>
          <p class="small-muted">Busca y elige un jugador convocado para cada premio.</p>
          <div class="award-grid">
            <?php foreach ($awardDefinitions as $code => $award): ?>
              <?php
                $savedAward = $savedAwards[$code] ?? null;
                $savedValue = $savedAward ? (string) $savedAward['name'] . ' (#' . (int) $savedAward['player_id'] . ')' : '';
              ?>
              <div class="award-field">
                <label for="award-<?= h($code) ?>">
                  <span class="award-icon" title="<?= h($award['label']) ?>"><?= h($award['icon']) ?></span>
                  <span><?= h($award['label']) ?></span>
                </label>
                <input id="award-<?= h($code) ?>" type="text" list="<?= $code === 'keeper' ? 'matchAwardGoalkeepers' : 'matchAwardPlayers' ?>" name="awards[<?= h($code) ?>]" value="<?= h($savedValue) ?>" placeholder="Buscar jugador">
              </div>
            <?php endforeach; ?>
          </div>
        </details>

        <div class="btn-row">
          <button class="btn btn-primary" type="submit">Guardar puntajes y premios</button>
        </div>
      </form>
      <?php elseif (!$scoreSaved): ?>
        <p class="flash flash-info">Guarda el resultado para habilitar la carga de puntajes y premios.</p>
      <?php endif; ?>
    <?php endif; ?>
  </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
