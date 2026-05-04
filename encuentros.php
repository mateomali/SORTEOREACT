<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

require_admin();

$pdo = db();
ensure_control_schema();

$matchAdminView = defined('MATCH_ADMIN_VIEW') ? (string) MATCH_ADMIN_VIEW : 'edit';
$showCreateSection = in_array($matchAdminView, ['create', 'all'], true);
$showEditSection = in_array($matchAdminView, ['edit', 'all'], true);
$matchFormPage = 'crear_partido.php';
$matchListPage = 'editar_partidos.php';

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
        redirect($matchListPage);
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
            redirect($id ? $matchFormPage . '?edit=' . $id : $matchFormPage);
        }
        if (count($participants) !== $targetPlayers) {
            flash('error', "Debes seleccionar exactamente {$targetPlayers} jugadores ({$playersPerTeam} por equipo x {$numTeams} equipos).");
            redirect($id ? $matchFormPage . '?edit=' . $id : $matchFormPage);
        }
        if ($participants) {
            $in = implode(',', array_fill(0, count($participants), '?'));
            $activeStmt = $pdo->prepare("SELECT COUNT(*) FROM players WHERE active = 1 AND id IN ($in)");
            $activeStmt->execute($participants);
            if ((int) $activeStmt->fetchColumn() !== count($participants)) {
                flash('error', 'Solo se pueden convocar jugadores con estado activo.');
                redirect($id ? $matchFormPage . '?edit=' . $id : $matchFormPage);
            }
        }

        if ($id > 0) {
            $existing = repo_match_by_id($id);
            if (!$existing) {
                flash('error', 'El partido a editar no existe.');
                redirect($matchListPage);
            }
            if ($existing['status'] === 'finalizado') {
                flash('error', 'No se puede editar un partido finalizado.');
                redirect($matchListPage);
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
            redirect($matchListPage . '?focus_match=' . $newId);
        }
        redirect($matchListPage);
    }
}

$activePlayers = repo_all_players(true);
$matches = repo_matches();
$latestMatch = null;
foreach ($matches as $candidateMatch) {
    if (!$latestMatch || (int) $candidateMatch['id'] > (int) $latestMatch['id']) {
        $latestMatch = $candidateMatch;
    }
}
$matchesPerPage = 10;
$totalMatches = count($matches);
$totalPages = max(1, (int) ceil($totalMatches / $matchesPerPage));
$focusedMatchId = max(0, (int) ($_GET['focus_match'] ?? 0));
$focusedMatchPage = 0;
if ($focusedMatchId > 0) {
    foreach ($matches as $focusIndex => $focusMatch) {
        if ((int) $focusMatch['id'] === $focusedMatchId) {
            $focusedMatchPage = intdiv($focusIndex, $matchesPerPage) + 1;
            break;
        }
    }
}
$requestedPage = isset($_GET['page']) ? (int) $_GET['page'] : ($focusedMatchPage ?: 1);
$currentPage = max(1, min($totalPages, $requestedPage));
$pageOffset = ($currentPage - 1) * $matchesPerPage;
$pagedMatches = array_slice($matches, $pageOffset, $matchesPerPage);
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
$nextMatchId = $matches
    ? (max(array_map(static fn(array $match): int => (int) $match['id'], $matches)) + 1)
    : 1;
$titlePlaceholder = 'Partido #' . (string) ((int) ($form['id'] ?? 0) > 0 ? (int) $form['id'] : $nextMatchId);

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

function admin_team_color_from_label(string $label): string
{
    if (preg_match('/\(([^)]+)\)\s*$/i', $label, $matches) !== 1) {
        return '';
    }

    $color = mb_strtoupper(trim($matches[1]), 'UTF-8');
    $knownColors = ['ROSA', 'AZUL', 'VERDE', 'NEGRO', 'NARANJA'];
    return in_array($color, $knownColors, true) ? $color : '';
}

function admin_team_heart_color(string $color): string
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

function admin_render_team_label(string $label): string
{
    $color = admin_team_color_from_label($label);
    if ($color === '') {
        return h($label);
    }

    $name = trim((string) preg_replace('/\s*\([^)]+\)\s*$/', '', $label));
    if ($name === '') {
        $name = 'Equipo';
    }
    $heartColor = admin_team_heart_color($color);
    return '<span class="team-label-with-heart" title="' . h($label) . '">' .
        '<span>' . h($name) . '</span>' .
        '<svg class="team-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="--team-heart-fill: ' . h($heartColor) . '">' .
        '<path d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" />' .
        '</svg>' .
        '</span>';
}

function admin_history_team_scoreboard_label(array $match, array $team, array $captainNames): string
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

function admin_render_match_scoreboard(array $match, array $teams, array $captainNames): string
{
    if (!$teams) {
        return '';
    }

    $items = [];
    foreach ($teams as $team) {
        $items[] = [
            'label' => admin_history_team_scoreboard_label($match, $team, $captainNames),
            'goals' => (int) ($team['goals'] ?? 0),
        ];
    }

    if (count($items) !== 2) {
        return h(admin_history_match_score_line($match, $teams, $captainNames));
    }

    return '<span class="match-scoreboard">' .
        '<span class="scoreboard-team">' . admin_render_team_label($items[0]['label']) . '</span>' .
        '<strong class="scoreboard-score">' . h((string) $items[0]['goals']) . ' - ' . h((string) $items[1]['goals']) . '</strong>' .
        '<span class="scoreboard-team scoreboard-team-away">' . admin_render_team_label($items[1]['label']) . '</span>' .
        '</span>';
}

$scheduledCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'programado'));
$readyCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'sorteado'));
$finishedCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'finalizado'));

$pageHeading = $showCreateSection && !$showEditSection ? 'Crear partido' : 'Editar partidos';
$pageDescription = $showCreateSection && !$showEditSection
    ? 'Carga un nuevo partido, define cupos y selecciona los jugadores convocados.'
    : 'Administra partidos cargados, acciones disponibles, sorteo, capitanes y resultados.';
$title = $pageHeading . ' | ' . APP_NAME;
$activePage = $showCreateSection && !$showEditSection ? $matchFormPage : $matchListPage;
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1><?= h($pageHeading) ?></h1>
    <p class="small-muted"><?= h($pageDescription) ?></p>
  </div>
</section>

<?php if ($showEditSection): ?>
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
<?php endif; ?>

<?php if ($showCreateSection): ?>
<details class="encounter-drawer <?= $form['id'] ? 'is-editing' : 'is-new' ?>" <?= ($form['id'] || !$showEditSection) ? 'open' : '' ?>>
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
        <input type="text" name="title" value="<?= h((string) ($form['title'] ?? '')) ?>" placeholder="<?= h($titlePlaceholder) ?>">
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

      <section class="participant-panel participant-roster-panel">
        <div class="participant-roster-head">
          <h4>Lista de jugadores activos</h4>
          <div class="participant-roster-counters">
            <span><?= h((string) count($activePlayers)) ?> activos</span>
            <span><strong data-selection-count="participants">0</strong> / <strong data-selection-max="participants"><?= $targetSelection ?></strong> jugadores elegidos</span>
          </div>
        </div>
        <div class="participant-roster-list" data-participant-list>
          <?php foreach ($activePlayers as $p): ?>
            <?php
              $pid = (int) $p['id'];
              $checked = in_array($pid, $editingParticipants, true);
              $searchText = strtolower(trim((string) $p['name'] . ' ' . $p['positions'] . ' ' . pace_label((string) $p['pace']) . ' ' . number_format((float) $p['skill'], 1)));
            ?>
            <article class="participant-roster-item player-picker-item" data-player-row data-player-id="<?= $pid ?>" data-search="<?= h($searchText) ?>">
              <span>
                <strong><?= h((string) $p['name']) ?></strong>
                <small><?= h((string) $p['positions']) ?> | <?= h(pace_label((string) $p['pace'])) ?> | <?= h(skill_label((float) $p['skill'])) ?></small>
              </span>
              <span class="participant-roster-actions">
                <button class="btn btn-danger participant-remove-button" type="button" data-remove-player-row aria-label="Quitar <?= h((string) $p['name']) ?>" title="Quitar">X</button>
                <button class="participant-add-button" type="button" data-participant-toggle><?= $checked ? 'Agregado' : 'Agregar' ?></button>
              </span>
              <input
                class="participant-hidden-checkbox"
                type="checkbox"
                name="participants[]"
                value="<?= $pid ?>"
                data-player-name="<?= h((string) $p['name']) ?>"
                data-player-meta="<?= h((string) $p['positions'] . ' | ' . pace_label((string) $p['pace']) . ' | ' . skill_label((float) $p['skill'])) ?>"
                <?= checked_attr($checked) ?>
              >
            </article>
          <?php endforeach; ?>
        </div>
        <p class="small-muted hidden" data-participant-empty>No hay jugadores que coincidan con la busqueda.</p>
      </section>

      <section class="participant-panel selected-panel participant-selected-desktop">
        <h4>Seleccionados para este partido</h4>
        <div class="selected-player-list" data-selected-participants></div>
        <p class="small-muted" data-selected-empty>Agrega jugadores desde la lista.</p>
      </section>

      <details class="participant-mobile-marquee" data-participant-marquee>
        <summary>
          <span>Jugadores elegidos</span>
          <strong><span data-selection-count="participants">0</span> / <span data-selection-max="participants"><?= $targetSelection ?></span></strong>
          <button class="btn btn-primary participant-mobile-submit" type="submit" data-mobile-submit disabled>
            CONTINUAR
          </button>
        </summary>
        <div class="participant-mobile-selected-list" data-selected-participants></div>
        <p class="small-muted" data-selected-empty>Agrega jugadores desde la lista.</p>
      </details>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" type="submit"><?= $form['id'] ? 'Guardar cambios' : 'Crear partido' ?></button>
      <?php if ($form['id']): ?>
        <a class="btn btn-muted" href="<?= h($matchListPage) ?>">Cancelar</a>
      <?php endif; ?>
    </div>
  </form>
  </section>
</details>
<?php endif; ?>

<?php if ($showEditSection): ?>
<section class="card encounters-history">
  <div class="section-toolbar">
    <div>
      <h3>Historial de partidos</h3>
      <p class="small-muted">Resumen rapido de estado, resultado y acciones disponibles. <?= h((string) $totalMatches) ?> partidos cargados.</p>
    </div>
  </div>

  <?php if (!$matches): ?>
    <p>No hay partidos cargados.</p>
  <?php else: ?>
    <?php if ($latestMatch): ?>
      <?php
        $latestId = (int) $latestMatch['id'];
        $latestIsScheduled = (string) $latestMatch['status'] === 'programado';
        $latestCanFinalize = (string) $latestMatch['status'] === 'sorteado';
        $latestIsFinalized = (string) $latestMatch['status'] === 'finalizado';
        $latestPlayersPerTeam = (int) ($latestMatch['players_per_team'] ?? ((int) $latestMatch['participants_count'] / max(1, (int) $latestMatch['num_teams'])));
        $latestExpectedPlayers = (int) $latestMatch['num_teams'] * max(1, $latestPlayersPerTeam);
        $latestParticipantsCount = (int) $latestMatch['participants_count'];
        $latestTeams = $historyTeamsByMatch[$latestId] ?? [];
        $latestScoreboard = admin_render_match_scoreboard($latestMatch, $latestTeams, $historyCaptainNames);
      ?>
      <article class="encounter-latest-card">
        <div>
          <span class="encounter-latest-kicker">Ultimo partido cargado</span>
          <h4><?= h((string) ($latestMatch['title'] ?: ('Partido #' . $latestMatch['id']))) ?></h4>
          <p>
            <?= h(date('d/m/Y H:i', strtotime((string) $latestMatch['match_date']))) ?>
            | <?= h((string) $latestParticipantsCount) ?>/<?= h((string) $latestExpectedPlayers) ?> convocados
            | <?= h(admin_match_status_label((string) $latestMatch['status'])) ?>
          </p>
          <?php if ($latestScoreboard !== ''): ?>
            <div class="encounter-latest-score"><?= $latestScoreboard ?></div>
          <?php endif; ?>
        </div>
        <div class="encounter-latest-actions">
          <?php if ($latestIsScheduled): ?>
            <a class="btn btn-muted" href="<?= h($matchFormPage) ?>?edit=<?= $latestId ?>">Editar</a>
            <a class="btn btn-warning" href="sorteo_legacy_csv.php?match_id=<?= $latestId ?>">Sortear</a>
            <a class="btn btn-primary" href="capitanes.php?match_id=<?= $latestId ?>">Capitanes</a>
          <?php elseif ($latestCanFinalize): ?>
            <a class="btn btn-primary" href="finalizar_partido.php?match_id=<?= $latestId ?>">Cargar resultado</a>
          <?php elseif ($latestIsFinalized): ?>
            <a class="btn btn-muted" href="finalizar_partido.php?match_id=<?= $latestId ?>">Ver resultado</a>
          <?php endif; ?>
        </div>
      </article>
    <?php endif; ?>

    <div class="encounter-history-search" role="search">
      <label for="encounterHistorySearch">Buscar historial</label>
      <input id="encounterHistorySearch" type="search" placeholder="Fecha, partido o capitan..." autocomplete="off" data-encounter-history-search>
      <span data-encounter-history-count><?= h((string) $totalMatches) ?> partidos</span>
    </div>
    <p class="small-muted encounter-history-empty" data-encounter-history-empty hidden>No hay partidos que coincidan con la busqueda.</p>
    <div class="encounter-card-grid">
      <?php foreach ($matches as $matchIndex => $m): ?>
        <?php
          $canFinalize = (string) $m['status'] === 'sorteado';
          $isFinalized = (string) $m['status'] === 'finalizado';
          $isScheduled = (string) $m['status'] === 'programado';
          $matchId = (int) $m['id'];
          $cardPage = intdiv($matchIndex, $matchesPerPage) + 1;
          $participantsCount = (int) $m['participants_count'];
          $ratingStatus = $historyRatingCounts[$matchId] ?? ['player_count' => $participantsCount, 'rated_count' => 0];
          $missingAwards = $isFinalized && (($historyAwardCounts[$matchId] ?? 0) === 0);
          $missingRating = $isFinalized && (int) $ratingStatus['player_count'] > 0 && (int) $ratingStatus['rated_count'] < (int) $ratingStatus['player_count'];
          $statusClass = $isFinalized ? 'done' : ($canFinalize ? 'ready' : 'warn');
          $historyTeams = $historyTeamsByMatch[$matchId] ?? [];
          $historyScoreboard = admin_render_match_scoreboard($m, $historyTeams, $historyCaptainNames);
          $historyCaptainSearch = [];
          foreach ($historyTeams as $historyTeam) {
              if (!empty($historyTeam['captain_player_id'])) {
                  $historyCaptainSearch[] = $historyCaptainNames[(int) $historyTeam['captain_player_id']] ?? '';
              }
          }
          $historySearchText = implode(' ', array_filter([
              (string) ($m['title'] ?: 'Partido #' . $m['id']),
              (string) $m['id'],
              date('d/m/Y', strtotime((string) $m['match_date'])),
              date('Y-m-d', strtotime((string) $m['match_date'])),
              date('d/m/Y H:i', strtotime((string) $m['match_date'])),
              admin_match_status_label((string) $m['status']),
              implode(' ', $historyCaptainSearch),
              admin_history_match_score_line($m, $historyTeams, $historyCaptainNames),
          ]));
          $isFocusedMatch = $focusedMatchId === $matchId;
          $isLatestMatch = $latestMatch && (int) $latestMatch['id'] === $matchId;
          $isPageVisible = $cardPage === $currentPage;
        ?>
        <article
          class="encounter-card <?= $isPageVisible ? '' : 'encounter-page-hidden' ?> <?= $isFocusedMatch ? 'is-focused' : '' ?> <?= $isLatestMatch ? 'is-latest' : '' ?>"
          id="partido-admin-<?= $matchId ?>"
          tabindex="<?= $isFocusedMatch ? '0' : '-1' ?>"
          data-encounter-card
          data-focus-match="<?= $isFocusedMatch ? '1' : '0' ?>"
          data-page="<?= h((string) $cardPage) ?>"
          data-search="<?= h(mb_strtolower($historySearchText, 'UTF-8')) ?>"
        >
          <div class="encounter-card-head">
            <div>
              <span class="encounter-date"><?= h(date('d/m/Y H:00', strtotime((string) $m['match_date']))) ?></span>
              <h4><?= h((string) ($m['title'] ?: 'Partido #' . $m['id'])) ?></h4>
            </div>
          </div>

          <div class="encounter-card-score">
            <?php if ($historyScoreboard !== ''): ?>
              <?= $historyScoreboard ?>
            <?php else: ?>
              <span class="encounter-score-empty">Sin resultado</span>
            <?php endif; ?>
          </div>

          <div class="encounter-card-status-group">
            <span class="badge encounter-card-status <?= h($statusClass) ?>"><?= h(admin_match_status_label((string) $m['status'])) ?></span>
            <?php if ($missingAwards): ?><span class="badge pending">Sin premios</span><?php endif; ?>
            <?php if ($missingRating): ?><span class="badge pending">Sin puntaje</span><?php endif; ?>
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
              <a class="btn btn-muted icon-pencil encounter-icon-action" data-short="" href="<?= h($matchFormPage) ?>?edit=<?= $matchId ?>" aria-label="Editar partido" title="Editar"></a>
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
                <a class="btn btn-muted icon-pencil" data-short="" href="<?= h($matchFormPage) ?>?edit=<?= $matchId ?>">Editar partido</a>
                <a class="btn btn-warning icon-dice" data-short="" href="sorteo_legacy_csv.php?match_id=<?= $matchId ?>">Sortear equipos</a>
                <a class="btn btn-primary icon-captain" data-short="" href="capitanes.php?match_id=<?= $matchId ?>">Modo capitanes</a>
              <?php endif; ?>

              <?php if ($canFinalize): ?>
                <a class="btn btn-primary icon-finish" data-short="" href="finalizar_partido.php?match_id=<?= $matchId ?>">Finalizar partido</a>
              <?php elseif ($isFinalized): ?>
                <a class="btn btn-muted" data-short="" href="finalizar_partido.php?match_id=<?= $matchId ?>">Ver resultado</a>
              <?php endif; ?>

              <form method="post">
                <input type="hidden" name="action" value="delete_match">
                <input type="hidden" name="id" value="<?= $matchId ?>">
                <button class="btn btn-danger" data-short="" data-confirm="<?= $isScheduled ? 'Eliminar partido y sus datos?' : 'Eliminar este partido? Se borraran convocados, equipos, capitanes, puntajes, goles y premios asociados.' ?>">Eliminar partido</button>
              </form>
            </div>
          </details>
        </article>
      <?php endforeach; ?>
    </div>
    <?php if ($totalPages > 1): ?>
      <nav class="pagination" aria-label="Paginas de partidos">
        <?php if ($currentPage > 1): ?>
          <a class="pagination-link" href="<?= h($matchListPage) ?>?page=<?= $currentPage - 1 ?>">Anterior</a>
        <?php else: ?>
          <span class="pagination-link disabled">Anterior</span>
        <?php endif; ?>

        <?php for ($page = 1; $page <= $totalPages; $page++): ?>
          <?php if ($page === $currentPage): ?>
            <span class="pagination-link active"><?= $page ?></span>
          <?php else: ?>
            <a class="pagination-link" href="<?= h($matchListPage) ?>?page=<?= $page ?>"><?= $page ?></a>
          <?php endif; ?>
        <?php endfor; ?>

        <?php if ($currentPage < $totalPages): ?>
          <a class="pagination-link" href="<?= h($matchListPage) ?>?page=<?= $currentPage + 1 ?>">Siguiente</a>
        <?php else: ?>
          <span class="pagination-link disabled">Siguiente</span>
        <?php endif; ?>
      </nav>
    <?php endif; ?>
  <?php endif; ?>
</section>

<script>
  (() => {
    const input = document.querySelector('[data-encounter-history-search]');
    if (!input) return;

    const cards = Array.from(document.querySelectorAll('[data-encounter-card]'));
    const pagination = document.querySelector('.encounters-history .pagination');
    const empty = document.querySelector('[data-encounter-history-empty]');
    const count = document.querySelector('[data-encounter-history-count]');
    const currentPage = '<?= h((string) $currentPage) ?>';
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
        const matches = query === '' ? card.dataset.page === currentPage : haystack.includes(query);
        card.classList.toggle('encounter-page-hidden', !matches);
        if (matches) visible++;
      });

      if (pagination) {
        pagination.hidden = query !== '';
      }
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

    const focusedCard = document.querySelector('[data-focus-match="1"]');
    if (focusedCard) {
      window.setTimeout(() => {
        focusedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        focusedCard.focus({ preventScroll: true });
      }, 120);
    }
  })();
</script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
