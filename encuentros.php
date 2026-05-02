<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();

$pdo = db();

function clear_match_draw_data(PDO $pdo, int $matchId): void
{
    $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare(
        'UPDATE match_players
         SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0, lineup_order = NULL, formation_line_order = NULL, goals = 0, rating = NULL
         WHERE match_id = :mid'
    )->execute(['mid' => $matchId]);
    $pdo->prepare(
        'UPDATE matches
         SET draw_mode = "none", draw_started_at = NULL, draw_completed_at = NULL, finalized_at = NULL, formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
         WHERE id = :mid'
    )->execute(['mid' => $matchId]);
}

function delete_match_cascade(PDO $pdo, int $matchId): void
{
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_awards WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_players WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $stmt = $pdo->prepare('DELETE FROM matches WHERE id = :id');
        $stmt->execute(['id' => $matchId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'delete_match') {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id > 0) {
            try {
                delete_match_cascade($pdo, $id);
                flash('success', 'Partido eliminado junto con convocados, equipos, capitanes, puntajes y premios.');
            } catch (Throwable $e) {
                flash('error', 'No se pudo eliminar el partido: ' . $e->getMessage());
            }
        }
        redirect('encuentros.php');
    }

    if ($action === 'save_match') {
        $id = (int) ($_POST['id'] ?? 0);
        $titleTxt = trim((string) ($_POST['title'] ?? ''));
        $matchDate = trim((string) ($_POST['match_date'] ?? ''));
        $numTeams = max(2, min(6, (int) ($_POST['num_teams'] ?? 2)));
        $playersPerTeam = max(1, min(12, (int) ($_POST['players_per_team'] ?? 9)));
        $maxDiff = 0.5;
        $notes = '';
        $participants = array_map('intval', $_POST['participants'] ?? []);
        $participants = array_values(array_unique(array_filter($participants, static fn(int $id): bool => $id > 0)));
        $targetPlayers = $numTeams * $playersPerTeam;

        if ($matchDate === '') {
            flash('error', 'La fecha del partido es obligatoria.');
            redirect($id ? 'encuentros.php?edit=' . $id : 'encuentros.php');
        }
        if (count($participants) !== $targetPlayers) {
            flash('error', "Debes seleccionar exactamente {$targetPlayers} jugadores ({$playersPerTeam} por equipo x {$numTeams} equipos).");
            redirect($id ? 'encuentros.php?edit=' . $id : 'encuentros.php');
        }
        if ($participants) {
            $in = implode(',', array_fill(0, count($participants), '?'));
            $activeStmt = $pdo->prepare("SELECT COUNT(*) FROM players WHERE active = 1 AND id IN ($in)");
            $activeStmt->execute($participants);
            if ((int) $activeStmt->fetchColumn() !== count($participants)) {
                flash('error', 'Solo se pueden convocar jugadores con estado activo.');
                redirect($id ? 'encuentros.php?edit=' . $id : 'encuentros.php');
            }
        }

        if ($id > 0) {
            $existing = repo_match_by_id($id);
            if (!$existing) {
                flash('error', 'El partido a editar no existe.');
                redirect('encuentros.php');
            }
            if ($existing['status'] === 'finalizado') {
                flash('error', 'No se puede editar un partido finalizado.');
                redirect('encuentros.php');
            }
            $stmt = $pdo->prepare(
                'UPDATE matches
                 SET title = :title, match_date = :match_date, num_teams = :num_teams, players_per_team = :players_per_team, max_diff = :max_diff, notes = :notes, status = :status,
                     draw_mode = "none", draw_started_at = NULL, draw_completed_at = NULL, finalized_at = NULL, formation_edit_deadline = :formation_edit_deadline
                 WHERE id = :id'
            );
            $savedMatchDate = date('Y-m-d H:00:00', strtotime($matchDate));
            $stmt->execute([
                'id' => $id,
                'title' => $titleTxt === '' ? null : $titleTxt,
                'match_date' => $savedMatchDate,
                'num_teams' => $numTeams,
                'players_per_team' => $playersPerTeam,
                'max_diff' => $maxDiff,
                'notes' => $notes === '' ? null : $notes,
                'status' => 'programado',
                'formation_edit_deadline' => date('Y-m-d H:i:s', strtotime($savedMatchDate . ' -1 hour')),
            ]);
            clear_match_draw_data($pdo, $id);
            repo_save_match_participants($id, $participants);
            flash('success', 'Partido actualizado.');
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO matches (title, match_date, num_teams, players_per_team, max_diff, status, draw_mode, formation_edit_deadline, notes)
                 VALUES (:title, :match_date, :num_teams, :players_per_team, :max_diff, :status, :draw_mode, :formation_edit_deadline, :notes)'
            );
            $savedMatchDate = date('Y-m-d H:00:00', strtotime($matchDate));
            $stmt->execute([
                'title' => $titleTxt === '' ? null : $titleTxt,
                'match_date' => $savedMatchDate,
                'num_teams' => $numTeams,
                'players_per_team' => $playersPerTeam,
                'max_diff' => $maxDiff,
                'status' => 'programado',
                'draw_mode' => 'none',
                'formation_edit_deadline' => date('Y-m-d H:i:s', strtotime($savedMatchDate . ' -1 hour')),
                'notes' => $notes === '' ? null : $notes,
            ]);
            $newId = (int) $pdo->lastInsertId();
            repo_save_match_participants($newId, $participants);
            flash('success', 'Partido creado.');
        }
        redirect('encuentros.php');
    }
}

$activePlayers = repo_all_players(true);
$matches = repo_matches();
$matchesPerPage = 10;
$totalMatches = count($matches);
$totalPages = max(1, (int) ceil($totalMatches / $matchesPerPage));
$currentPage = max(1, min($totalPages, (int) ($_GET['page'] ?? 1)));
$pageOffset = ($currentPage - 1) * $matchesPerPage;
$pagedMatches = array_slice($matches, $pageOffset, $matchesPerPage);
$historyTeamsByMatch = [];
$historyCaptainNames = [];
$pagedMatchIds = array_map(static fn(array $match): int => (int) $match['id'], $pagedMatches);
if ($pagedMatchIds) {
    $in = implode(',', array_fill(0, count($pagedMatchIds), '?'));
    $stmtHistoryTeams = $pdo->prepare(
        "SELECT *
         FROM match_teams
         WHERE match_id IN ($in)
         ORDER BY match_id ASC, team_number ASC"
    );
    $stmtHistoryTeams->execute($pagedMatchIds);
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

$editId = isset($_GET['edit']) ? (int) $_GET['edit'] : 0;
$editing = $editId > 0 ? repo_match_by_id($editId) : null;
$editingParticipants = [];
if ($editing) {
    foreach (repo_match_participants($editId) as $row) {
        $editingParticipants[] = (int) $row['id'];
    }
}

$form = $editing ?: [
    'id' => 0,
    'title' => '',
    'match_date' => date('Y-m-d H:i'),
    'num_teams' => 2,
    'players_per_team' => 9,
    'max_diff' => 0.5,
    'status' => 'programado',
    'notes' => '',
];
$form['players_per_team'] = $form['players_per_team'] ?? 9;
$targetSelection = (int) $form['num_teams'] * (int) $form['players_per_team'];

function admin_match_status_label(string $status): string
{
    return match ($status) {
        'finalizado' => 'Finalizado',
        'sorteado' => 'Equipos listos',
        default => 'Programado',
    };
}

function admin_history_team_label(array $match, array $team, array $captainNames): string
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

    $label = trim((string) ($team['team_name'] ?? '')) ?: ('Equipo ' . $teamNumber);
    return mb_strtoupper($label, 'UTF-8');
}

function admin_history_match_score_line(array $match, array $teams, array $captainNames): string
{
    if (!$teams) {
        return '';
    }

    $showGoals = (string) ($match['status'] ?? '') === 'finalizado'
        || array_sum(array_map(static fn(array $team): int => (int) ($team['goals'] ?? 0), $teams)) > 0;

    $parts = [];
    foreach ($teams as $team) {
        $label = admin_history_team_label($match, $team, $captainNames);
        $parts[] = $showGoals ? ($label . ' ( ' . (int) ($team['goals'] ?? 0) . ' )') : $label;
    }

    return implode(' VS ', $parts);
}

$scheduledCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'programado'));
$readyCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'sorteado'));
$finishedCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'finalizado'));

$title = 'Partidos | ' . APP_NAME;
$activePage = 'encuentros.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Partidos</h1>
    <p class="small-muted">Administra partidos, convocados, sorteo, capitanes y cierre de resultados.</p>
  </div>
</section>

<section class="encounters-overview">
  <article class="stat-box">
    <div class="label">Programados</div>
    <div class="value"><?= h((string) $scheduledCount) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">Listos para finalizar</div>
    <div class="value"><?= h((string) $readyCount) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">Finalizados</div>
    <div class="value"><?= h((string) $finishedCount) ?></div>
  </article>
</section>

<details class="encounter-drawer <?= $form['id'] ? 'is-editing' : 'is-new' ?>" <?= $form['id'] ? 'open' : '' ?>>
  <summary class="encounter-drawer-tab">
    <span><?= $form['id'] ? 'Editar partido' : 'CREAR NUEVO PARTIDO' ?></span>
    <small><?= $targetSelection ?> convocados requeridos</small>
  </summary>
  <section class="card encounter-drawer-body">
  <h3><?= $form['id'] ? 'Editar partido' : 'CREAR NUEVO PARTIDO' ?></h3>
  <form method="post">
    <input type="hidden" name="action" value="save_match">
    <input type="hidden" name="id" value="<?= (int) $form['id'] ?>">

    <div class="form-grid">
      <div class="form-row">
        <label>Titulo (opcional)</label>
        <input type="text" name="title" value="<?= h((string) ($form['title'] ?? '')) ?>" placeholder="Mixto Jueves">
      </div>
      <div class="form-row">
        <label>Fecha y hora</label>
        <input type="datetime-local" name="match_date" step="3600" required value="<?= h(date('Y-m-d\TH:00', strtotime((string) $form['match_date']))) ?>">
      </div>
      <div class="form-row">
        <label>Numero de equipos</label>
        <input type="number" name="num_teams" min="2" max="6" value="<?= h((string) $form['num_teams']) ?>" required data-num-teams>
      </div>
      <div class="form-row">
        <label>Jugadores por equipo</label>
        <input type="number" name="players_per_team" min="1" max="12" value="<?= h((string) $form['players_per_team']) ?>" required data-players-per-team>
      </div>
    </div>

    <div class="form-row">
      <div class="participant-head">
        <label>Jugadores convocados</label>
        <span class="participant-count">
          Seleccionados: <strong data-selection-count="participants">0</strong> / <strong data-selection-max="participants"><?= $targetSelection ?></strong>
        </span>
      </div>
      <p class="small-muted" data-selection-limit-message>
        El limite se calcula con equipos x jugadores por equipo. Jugadores activos disponibles: <?= count($activePlayers) ?>.
      </p>

      <div class="participant-search">
        <input type="text" data-participant-search placeholder="Buscar jugador por nombre, posicion o ritmo">
        <label class="chip">
          <input type="checkbox" data-select-all="participants">
          Seleccionar todos
        </label>
        <button class="btn btn-muted" type="button" data-random-select="participants">Seleccion al azar</button>
      </div>

      <div class="participant-picker-layout">
        <section class="participant-panel">
          <h4>Elegir jugadores</h4>
          <div class="match-player-grid" data-participant-list>
            <?php foreach ($activePlayers as $p): ?>
              <?php
                $pid = (int) $p['id'];
                $checked = in_array($pid, $editingParticipants, true);
                $searchText = strtolower(trim((string) $p['name'] . ' ' . $p['positions'] . ' ' . pace_label((string) $p['pace']) . ' ' . number_format((float) $p['skill'], 1)));
              ?>
              <label class="player-picker-item" data-player-row data-player-id="<?= $pid ?>" data-search="<?= h($searchText) ?>">
                <span>
                  <strong><?= h((string) $p['name']) ?></strong>
                  <span class="small-muted"><?= h((string) $p['positions']) ?> | <?= h(pace_label((string) $p['pace'])) ?> | <?= h(skill_label((float) $p['skill'])) ?></span>
                </span>
                <input
                  type="checkbox"
                  name="participants[]"
                  value="<?= $pid ?>"
                  data-player-name="<?= h((string) $p['name']) ?>"
                  data-player-meta="<?= h((string) $p['positions'] . ' | ' . pace_label((string) $p['pace']) . ' | ' . skill_label((float) $p['skill'])) ?>"
                  <?= checked_attr($checked) ?>
                >
              </label>
            <?php endforeach; ?>
          </div>
          <p class="small-muted hidden" data-participant-empty>No hay jugadores que coincidan con la busqueda.</p>
        </section>

        <section class="participant-panel selected-panel">
          <h4>Seleccionados para este partido</h4>
          <div class="selected-player-list" data-selected-participants></div>
          <p class="small-muted" data-selected-empty>Agrega jugadores desde la lista.</p>
        </section>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" type="submit"><?= $form['id'] ? 'Guardar cambios' : 'Crear partido' ?></button>
      <?php if ($form['id']): ?>
        <a class="btn btn-muted" href="encuentros.php">Cancelar</a>
      <?php endif; ?>
    </div>
  </form>
  </section>
</details>

<section class="card encounters-history">
  <div class="section-toolbar">
    <div>
      <h3>Historial de partidos</h3>
      <p class="small-muted">Cada tarjeta muestra estado, cupos y acciones disponibles segun el avance del partido. <?= h((string) $totalMatches) ?> partidos cargados.</p>
    </div>
  </div>

  <?php if (!$matches): ?>
    <p>No hay partidos cargados.</p>
  <?php else: ?>
    <div class="encounter-card-grid">
      <?php foreach ($pagedMatches as $m): ?>
        <?php
          $canFinalize = (string) $m['status'] === 'sorteado';
          $isFinalized = (string) $m['status'] === 'finalizado';
          $isScheduled = (string) $m['status'] === 'programado';
          $matchId = (int) $m['id'];
          $playersPerTeam = (int) ($m['players_per_team'] ?? ((int) $m['participants_count'] / max(1, (int) $m['num_teams'])));
          $expectedPlayers = (int) $m['num_teams'] * max(1, $playersPerTeam);
          $participantsCount = (int) $m['participants_count'];
          $statusClass = $isFinalized ? 'done' : ($canFinalize ? 'ready' : 'warn');
          $historyScoreLine = admin_history_match_score_line($m, $historyTeamsByMatch[$matchId] ?? [], $historyCaptainNames);
        ?>
        <article class="encounter-card">
          <div class="encounter-card-head">
            <div>
              <span class="encounter-date"><?= h(date('d/m/Y H:00', strtotime((string) $m['match_date']))) ?></span>
              <h4>
                <?= h((string) ($m['title'] ?: 'Partido #' . $m['id'])) ?>
                <?php if ($historyScoreLine !== ''): ?>
                  <span class="encounter-card-title-score"><?= h($historyScoreLine) ?></span>
                <?php endif; ?>
              </h4>
            </div>
            <span class="badge <?= h($statusClass) ?>"><?= h(admin_match_status_label((string) $m['status'])) ?></span>
          </div>

          <div class="encounter-card-metrics">
            <span><strong><?= h((string) $participantsCount) ?></strong><small>convocados</small></span>
            <span><strong><?= h((string) $expectedPlayers) ?></strong><small>cupo</small></span>
            <span><strong><?= h((string) $m['num_teams']) ?></strong><small>equipos</small></span>
            <span><strong><?= h((string) $playersPerTeam) ?></strong><small>por equipo</small></span>
          </div>

          <div class="encounter-state-note">
            <?php if ($isScheduled): ?>
              Listo para editar, sortear o iniciar modo capitanes.
            <?php elseif ($canFinalize): ?>
              Equipos generados. Solo resta finalizar el partido.
            <?php else: ?>
              Partido cerrado. Resultado y detalle disponibles.
            <?php endif; ?>
          </div>

          <div class="encounter-actions">
            <?php if ($isScheduled): ?>
              <a class="btn btn-muted icon-pencil encounter-icon-action" data-short="" href="encuentros.php?edit=<?= $matchId ?>" aria-label="Editar partido" title="Editar"></a>
              <a class="btn btn-warning icon-dice" data-short="" href="sorteo_legacy_csv.php?match_id=<?= $matchId ?>">Sortear</a>
              <a class="btn btn-primary icon-captain" data-short="" href="capitanes.php?match_id=<?= $matchId ?>">Capitanes</a>
            <?php else: ?>
              <span class="btn btn-disabled icon-pencil encounter-icon-action" data-short="" aria-label="Editar no disponible" title="Editar"></span>
              <span class="btn btn-disabled icon-dice" data-short=""><?= $canFinalize || $isFinalized ? 'Sorteado' : 'Sortear' ?></span>
              <span class="btn btn-disabled icon-captain" data-short="">Capitanes</span>
            <?php endif; ?>

            <?php if ($canFinalize): ?>
              <a class="btn btn-primary icon-finish" data-short="" href="finalizar_partido.php?match_id=<?= $matchId ?>">Finalizar</a>
            <?php elseif ($isFinalized): ?>
              <a class="btn btn-muted" data-short="V" href="finalizar_partido.php?match_id=<?= $matchId ?>" title="Ver resultado">Ver</a>
            <?php else: ?>
              <span class="btn btn-disabled icon-finish" data-short="" title="Primero hay que generar equipos por sorteo o capitanes">Finalizar</span>
            <?php endif; ?>

            <?php if ($isScheduled): ?>
              <form method="post">
                <input type="hidden" name="action" value="delete_match">
                <input type="hidden" name="id" value="<?= $matchId ?>">
                <button class="btn btn-danger encounter-delete-action" data-short="X" data-confirm="Eliminar partido y sus datos?" aria-label="Eliminar partido" title="Eliminar">X</button>
              </form>
            <?php else: ?>
              <form method="post">
                <input type="hidden" name="action" value="delete_match">
                <input type="hidden" name="id" value="<?= $matchId ?>">
                <button class="btn btn-danger encounter-delete-action" data-short="X" data-confirm="Eliminar este partido? Se borraran convocados, equipos, capitanes, puntajes, goles y premios asociados." aria-label="Eliminar partido" title="Eliminar">X</button>
              </form>
            <?php endif; ?>
          </div>

          <details class="encounter-action-menu">
            <summary>Acciones</summary>
            <div class="encounter-action-menu-list">
              <?php if ($isScheduled): ?>
                <a class="btn btn-muted icon-pencil" href="encuentros.php?edit=<?= $matchId ?>">Editar</a>
                <a class="btn btn-warning icon-dice" href="sorteo_legacy_csv.php?match_id=<?= $matchId ?>">Sortear</a>
                <a class="btn btn-primary icon-captain" href="capitanes.php?match_id=<?= $matchId ?>">Capitanes</a>
              <?php else: ?>
                <span class="btn btn-disabled icon-pencil">Editar</span>
                <span class="btn btn-disabled icon-dice"><?= $canFinalize || $isFinalized ? 'Sorteado' : 'Sortear' ?></span>
                <span class="btn btn-disabled icon-captain">Capitanes</span>
              <?php endif; ?>

              <?php if ($canFinalize): ?>
                <a class="btn btn-primary icon-finish" href="finalizar_partido.php?match_id=<?= $matchId ?>">Finalizar</a>
              <?php elseif ($isFinalized): ?>
                <a class="btn btn-muted" href="finalizar_partido.php?match_id=<?= $matchId ?>">Ver resultado</a>
              <?php else: ?>
                <span class="btn btn-disabled icon-finish" title="Primero hay que generar equipos por sorteo o capitanes">Finalizar</span>
              <?php endif; ?>

              <form method="post">
                <input type="hidden" name="action" value="delete_match">
                <input type="hidden" name="id" value="<?= $matchId ?>">
                <button class="btn btn-danger" data-confirm="<?= $isScheduled ? 'Eliminar partido y sus datos?' : 'Eliminar este partido? Se borraran convocados, equipos, capitanes, puntajes, goles y premios asociados.' ?>">Eliminar</button>
              </form>
            </div>
          </details>
        </article>
      <?php endforeach; ?>
    </div>
    <?php if ($totalPages > 1): ?>
      <nav class="pagination" aria-label="Paginas de partidos">
        <?php if ($currentPage > 1): ?>
          <a class="pagination-link" href="encuentros.php?page=<?= $currentPage - 1 ?>">Anterior</a>
        <?php else: ?>
          <span class="pagination-link disabled">Anterior</span>
        <?php endif; ?>

        <?php for ($page = 1; $page <= $totalPages; $page++): ?>
          <?php if ($page === $currentPage): ?>
            <span class="pagination-link active"><?= $page ?></span>
          <?php else: ?>
            <a class="pagination-link" href="encuentros.php?page=<?= $page ?>"><?= $page ?></a>
          <?php endif; ?>
        <?php endfor; ?>

        <?php if ($currentPage < $totalPages): ?>
          <a class="pagination-link" href="encuentros.php?page=<?= $currentPage + 1 ?>">Siguiente</a>
        <?php else: ?>
          <span class="pagination-link disabled">Siguiente</span>
        <?php endif; ?>
      </nav>
    <?php endif; ?>
  <?php endif; ?>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
