<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';

require_admin();

$pdo = db();
ensure_match_awards_schema();
$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$detailFormError = '';
$forceEditDetails = false;
$postedTeamGoalsData = [];
$postedGoalsData = [];
$postedRatingData = [];
$postedAwardData = [];

function valuations_locked_after_deadline(array $match): bool
{
    if ((string) ($match['status'] ?? '') !== 'finalizado') {
        return false;
    }

    $finalizedAt = trim((string) ($match['finalized_at'] ?? ''));
    if ($finalizedAt === '') {
        $finalizedAt = trim((string) ($match['updated_at'] ?? $match['match_date'] ?? ''));
    }
    $finalizedTimestamp = strtotime($finalizedAt);
    if ($finalizedTimestamp === false) {
        return false;
    }

    return time() >= ($finalizedTimestamp + (7 * 24 * 60 * 60));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_result') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $teamGoalsData = $_POST['team_goals'] ?? [];
    $goalsData = $_POST['goals'] ?? [];
    $ratingData = $_POST['rating'] ?? [];
    $awardData = $_POST['awards'] ?? [];
    $postedTeamGoalsData = is_array($teamGoalsData) ? $teamGoalsData : [];
    $postedGoalsData = is_array($goalsData) ? $goalsData : [];
    $postedRatingData = is_array($ratingData) ? $ratingData : [];
    $postedAwardData = is_array($awardData) ? $awardData : [];

    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        flash('error', 'Partido invalido.');
        redirect('finalizar_partido.php');
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        flash('error', 'Solo se puede finalizar un partido con equipos ya sorteados o capitanes completos.');
        redirect('finalizar_partido.php?match_id=' . $matchId . '&edit_details=1#valoraciones');
    }
    if (valuations_locked_after_deadline($match)) {
        flash('error', 'Las valoraciones ya no se pueden editar porque pasaron mas de 7 dias desde la finalizacion del partido.');
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
        flash('error', 'El partido no tiene todos los jugadores asignados a equipos.');
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
            $detailFormError = "{$teamLabel}: el resultado indica {$expectedGoals} goles y los jugadores suman {$loadedGoals}; {$detail}. Corrige los goles por jugador antes de guardar.";
            $forceEditDetails = true;
            break;
        }
    }

    if ($detailFormError === '') {
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
                throw new RuntimeException('Selecciona los premios desde la lista de jugadores del partido.');
            }
            repo_save_match_awards($matchId, $parsedAwards, $allowedAwardPlayerIds);

            $stmt = $pdo->prepare('UPDATE matches SET status = :status, finalized_at = NOW() WHERE id = :id');
            $stmt->execute(['status' => 'finalizado', 'id' => $matchId]);

            $pdo->commit();
            flash('success', 'Datos del partido guardados. Partido finalizado.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            flash('error', 'No se pudo guardar: ' . $e->getMessage());
        }
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_score') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $teamGoalsData = $_POST['team_goals'] ?? [];

    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        flash('error', 'Partido invalido.');
        redirect('finalizar_partido.php');
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        flash('error', 'Solo se puede cargar resultado de un partido con equipos ya formados.');
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
    redirect('finalizar_partido.php?match_id=' . $matchId . '&edit_details=1#valoraciones');
}

$matches = repo_matches("status IN ('sorteado','finalizado')");
$selectedMatch = $matchId > 0 ? repo_match_by_id($matchId) : null;
$participants = $selectedMatch ? repo_match_participants((int) $selectedMatch['id']) : [];
$groupedTeams = $selectedMatch ? repo_grouped_team_players((int) $selectedMatch['id']) : [];
$awardDefinitions = award_definitions();
$savedAwards = $selectedMatch ? repo_match_awards((int) $selectedMatch['id']) : [];
$valuationsLocked = $selectedMatch ? valuations_locked_after_deadline($selectedMatch) : false;
$editDetails = !$valuationsLocked && ($forceEditDetails || (isset($_GET['edit_details']) && $_GET['edit_details'] === '1'));

$title = 'Finalizar partido | ' . APP_NAME;
$activePage = 'finalizar_partido.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Finalizar partido</h1>
    <p class="small-muted">Carga goles y calificacion por jugador para cerrar el partido y sumar estadisticas.</p>
  </div>
</section>

<section class="card mb-3.5">
  <form method="get" class="form-grid">
    <div class="form-row">
      <label>Seleccionar partido</label>
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
      <p>No hay equipos sorteados todavia para este partido.</p>
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
              <p class="small-muted">Primero guarda como salio el partido.</p>
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
            <?php if ($scoreSaved && !$valuationsLocked): ?>
              <a class="btn <?= $editDetails ? 'btn-primary' : 'btn-muted' ?> finish-edit-btn" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>&edit_details=<?= $editDetails ? '0' : '1' ?><?= $editDetails ? '' : '#valoraciones' ?>" title="<?= $editDetails ? 'Ocultar puntajes y premios' : 'Editar puntajes y premios' ?>"><span class="finish-edit-icon"><?= $editDetails ? '-' : '+' ?></span><span><?= $editDetails ? 'Ocultar valoraciones' : 'Abrir valoraciones' ?></span></a>
            <?php elseif ($scoreSaved && $valuationsLocked): ?>
              <span class="btn btn-disabled finish-edit-btn" title="Pasaron mas de 7 dias desde la finalizacion del partido"><span class="finish-edit-icon">&#9999;</span><span>Valoraciones bloqueadas</span></span>
            <?php else: ?>
              <span class="btn btn-disabled finish-edit-btn" title="Guarda el resultado para habilitar puntajes y premios"><span class="finish-edit-icon">&#9999;</span><span>Valoraciones</span></span>
            <?php endif; ?>
          </div>
        </form>
      </section>

      <?php if ($scoreSaved && $valuationsLocked): ?>
        <p class="flash flash-info">Las valoraciones quedaron bloqueadas porque pasaron mas de 7 dias desde la finalizacion del partido.</p>
      <?php endif; ?>

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
          <?php
            $hiddenTeamNumber = (int) $team['team_number'];
            $hiddenTeamGoals = $detailFormError !== ''
                ? (string) max(0, (int) ($postedTeamGoalsData[$hiddenTeamNumber] ?? 0))
                : (string) ((int) ($team['goals'] ?? 0));
          ?>
          <input type="hidden" name="team_goals[<?= $hiddenTeamNumber ?>]" value="<?= h($hiddenTeamGoals) ?>">
        <?php endforeach; ?>

        <details class="card finish-collapse finish-valuations" id="valoraciones" open>
          <summary>
            <span>Valoraciones</span>
            <small>Goles y puntajes</small>
          </summary>
          <div class="finish-valuations-body">
            <?php foreach ($groupedTeams as $teamNumber => $lines): ?>
              <article class="finish-rating-team">
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
                        <?php
                          $playerId = (int) $p['id'];
                          $goalsValue = $detailFormError !== ''
                              ? (string) max(0, (int) ($postedGoalsData[$playerId] ?? 0))
                              : (string) ((int) ($p['goals'] ?? 0));
                          $ratingValue = $detailFormError !== ''
                              ? (string) ($postedRatingData[$playerId] ?? '5')
                              : ($p['rating'] !== null && $p['rating'] !== '' ? (string) $p['rating'] : '5');
                        ?>
                        <tr>
                          <td data-label="Jugador">
                            <strong><?= h((string) $p['name']) ?></strong>
                            <small><?= h((string) $line) ?></small>
                          </td>
                          <td data-label="Goles">
                            <input class="finish-number-input" type="number" min="0" step="1" name="goals[<?= $playerId ?>]" value="<?= h($goalsValue) ?>">
                          </td>
                          <td data-label="Puntuacion">
                            <input class="finish-number-input" type="number" min="1" max="10" step="0.5" name="rating[<?= $playerId ?>]" value="<?= h($ratingValue) ?>">
                          </td>
                        </tr>
                      <?php endforeach; ?>
                    <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </article>
            <?php endforeach; ?>
          </div>
        </details>

        <details class="card finish-collapse finish-awards">
          <summary>
            <span>Premios</span>
            <small>Opcional</small>
          </summary>
          <p class="small-muted">Busca y elige un jugador convocado para cada premio.</p>
          <div class="award-grid">
            <?php foreach ($awardDefinitions as $code => $award): ?>
              <?php
                $savedAward = $savedAwards[$code] ?? null;
                $savedValue = $detailFormError !== ''
                    ? (string) ($postedAwardData[$code] ?? '')
                    : ($savedAward ? (string) $savedAward['name'] . ' (#' . (int) $savedAward['player_id'] . ')' : '');
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
          <button class="btn btn-primary" type="submit">GUARDAR VALORACIONES</button>
        </div>
      </form>
      <?php if ($detailFormError !== ''): ?>
        <div class="floating-form-alert" role="alert" aria-live="assertive" data-dismissible-alert>
          <button type="button" class="floating-form-alert-close" aria-label="Cerrar aviso" data-dismissible-alert-close>x</button>
          <span><?= h($detailFormError) ?></span>
        </div>
      <?php endif; ?>
      <?php elseif (!$scoreSaved): ?>
        <p class="flash flash-info">Guarda el resultado para habilitar la carga de puntajes y premios.</p>
      <?php endif; ?>
    <?php endif; ?>
  </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
