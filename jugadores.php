<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();

$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'delete') {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id > 0) {
            try {
                $stmt = $pdo->prepare('DELETE FROM players WHERE id = :id');
                $stmt->execute(['id' => $id]);
                flash('success', 'Jugador eliminado correctamente.');
            } catch (Throwable $e) {
                $deactivate = $pdo->prepare('UPDATE players SET active = 0 WHERE id = :id');
                $deactivate->execute(['id' => $id]);
                flash('info', 'El jugador tiene historial. Se desactivo en lugar de eliminarse.');
            }
        }
        redirect('jugadores.php');
    }

    if ($action === 'toggle_active') {
        $id = (int) ($_POST['id'] ?? 0);
        $nextActive = null;
        if ($id > 0) {
            $player = repo_player_by_id($id);
            if ($player) {
                $nextActive = (int) $player['active'] === 1 ? 0 : 1;
                $stmt = $pdo->prepare('UPDATE players SET active = :active WHERE id = :id');
                $stmt->execute(['active' => $nextActive, 'id' => $id]);
                if (($_POST['ajax'] ?? '') === '1') {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        'ok' => true,
                        'active' => $nextActive,
                        'label' => $nextActive === 1 ? 'Activo' : 'Inactivo',
                    ]);
                    exit;
                }
                flash('success', $nextActive === 1 ? 'Jugador activado.' : 'Jugador desactivado.');
            }
        }
        if (($_POST['ajax'] ?? '') === '1') {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false]);
            exit;
        }
        redirect('jugadores.php');
    }

    if ($action === 'save') {
        $id = (int) ($_POST['id'] ?? 0);
        $name = trim((string) ($_POST['name'] ?? ''));
        $positions = $_POST['positions'] ?? [];
        $pace = normalize_pace((string) ($_POST['pace'] ?? 'rapido'));
        $skill = (float) ($_POST['skill'] ?? 1);
        $active = isset($_POST['active']) ? 1 : 0;
        $skill = max(1.0, min(6.0, round($skill * 2) / 2));

        if ($name === '' || !$positions) {
            flash('error', 'Nombre y posiciones son obligatorios.');
            redirect($id > 0 ? 'jugadores.php?edit=' . $id : 'jugadores.php');
        }

        $positionsCsv = join_positions(array_map('strval', $positions));
        if ($positionsCsv === '') {
            flash('error', 'Debes seleccionar al menos una posicion valida.');
            redirect($id > 0 ? 'jugadores.php?edit=' . $id : 'jugadores.php');
        }

        if ($id > 0) {
            $stmt = $pdo->prepare(
                'UPDATE players
                 SET name = :name, positions = :positions, pace = :pace, skill = :skill, active = :active
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'name' => $name,
                'positions' => $positionsCsv,
                'pace' => $pace,
                'skill' => $skill,
                'active' => $active,
            ]);
            flash('success', 'Jugador actualizado.');
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO players (name, positions, pace, skill, active)
                 VALUES (:name, :positions, :pace, :skill, :active)'
            );
            $stmt->execute([
                'name' => $name,
                'positions' => $positionsCsv,
                'pace' => $pace,
                'skill' => $skill,
                'active' => $active,
            ]);
            flash('success', 'Jugador agregado correctamente.');
        }
        redirect('jugadores.php');
    }
}

$form = [
    'id' => 0,
    'name' => '',
    'positions' => '',
    'pace' => 'rapido',
    'skill' => 1.0,
    'active' => 1,
];

$players = repo_all_players();
$title = 'Jugadores | ' . APP_NAME;
$activePage = 'jugadores.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Jugadores</h1>
    <p class="small-muted">Alta, edicion y administracion general de la plantilla.</p>
  </div>
  <a class="btn btn-muted" href="migrar_csv.php">Migrar desde CSV</a>
</section>

<details class="card mb-3.5 player-create-drawer">
  <summary class="player-create-summary">
    <span>Agregar jugador</span>
    <small>Cargar nuevo jugador</small>
  </summary>
  <form method="post" class="player-create-body">
    <input type="hidden" name="action" value="save">
    <input type="hidden" name="id" value="<?= (int) $form['id'] ?>">

    <div class="form-grid">
      <div class="form-row">
        <label>Nombre</label>
        <input type="text" name="name" required value="<?= h((string) $form['name']) ?>">
      </div>
      <div class="form-row">
        <label>Ritmo</label>
        <select name="pace">
          <option value="rapido" <?= selected_attr(($form['pace'] ?? '') === 'rapido') ?>>Rapido</option>
          <option value="lento" <?= selected_attr(($form['pace'] ?? '') === 'lento') ?>>Lento</option>
        </select>
      </div>
      <div class="form-row">
        <label>Puntuacion Base (1 a 6)</label>
        <input type="number" name="skill" min="1" max="6" step="0.5" value="<?= h((string) $form['skill']) ?>">
      </div>
      <div class="form-row">
        <label>Estado</label>
        <label class="chip">
          <input type="checkbox" name="active" value="1" <?= checked_attr((int) ($form['active'] ?? 0) === 1) ?>>
          Jugador activo
        </label>
      </div>
    </div>

    <?php $selectedPos = parse_positions_csv((string) $form['positions']); ?>
    <div class="form-row">
      <label>Posiciones</label>
      <div class="check-row">
        <?php foreach (allowed_positions() as $pos): ?>
          <label class="chip">
            <input type="checkbox" name="positions[]" value="<?= h($pos) ?>" <?= checked_attr(in_array($pos, $selectedPos, true)) ?>>
            <?= h($pos) ?>
          </label>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" type="submit">Crear jugador</button>
    </div>
  </form>
</details>

<section class="card">
  <div class="section-toolbar">
    <h3>Listado de jugadores</h3>
    <input type="text" data-player-list-search placeholder="Buscar jugador por nombre, posicion, ritmo o puntaje">
  </div>
  <details class="mobile-full-player-list" open>
    <summary>
      <span>Lista completa de jugadores</span>
      <small><?= h((string) count($players)) ?> jugadores</small>
    </summary>
    <div class="mobile-player-list-body">
      <?php if (!$players): ?>
        <p class="small-muted">No hay jugadores cargados.</p>
      <?php else: ?>
        <?php foreach ($players as $player): ?>
          <?php
            $rowSearch = strtolower(trim((string) $player['name'] . ' ' . $player['positions'] . ' ' . pace_label((string) $player['pace']) . ' ' . number_format((float) $player['skill'], 1) . ' ' . ((int) $player['active'] === 1 ? 'activo si' : 'inactivo no')));
          ?>
          <article class="mobile-player-list-item" data-player-table-row data-search="<?= h($rowSearch) ?>">
            <span>
              <strong><?= h((string) $player['name']) ?></strong>
              <small><?= h((string) $player['positions']) ?> | <?= h(pace_label((string) $player['pace'])) ?> | <?= h(skill_label((float) $player['skill'])) ?></small>
            </span>
            <span class="mobile-player-list-actions">
              <form method="post" class="inline">
                <input type="hidden" name="action" value="toggle_active">
                <input type="hidden" name="id" value="<?= (int) $player['id'] ?>">
                <button class="player-status-pill <?= (int) $player['active'] === 1 ? 'is-active' : 'is-inactive' ?>" type="button" title="Cambiar estado" data-player-status-toggle>
                  <?= (int) $player['active'] === 1 ? 'Activo' : 'Inactivo' ?>
                </button>
              </form>
              <button class="btn btn-muted player-icon-button icon-pencil" type="button" data-player-edit-open="<?= (int) $player['id'] ?>" aria-label="Editar <?= h((string) $player['name']) ?>" title="Editar"></button>
              <form method="post" class="inline">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= (int) $player['id'] ?>">
                <button class="btn btn-danger player-icon-button player-delete-icon" data-confirm="Eliminar jugador?" type="submit" aria-label="Eliminar <?= h((string) $player['name']) ?>" title="Eliminar">X</button>
              </form>
            </span>
          </article>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </details>
  <div class="table-wrap players-desktop-table">
    <table class="editable-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Posiciones</th>
          <th>Ritmo</th>
          <th>Puntuacion</th>
          <th>Activo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
      <?php if (!$players): ?>
        <tr><td colspan="6">No hay jugadores cargados.</td></tr>
      <?php else: ?>
        <?php foreach ($players as $player): ?>
          <?php
            $playerId = (int) $player['id'];
            $rowFormId = 'player-row-' . $playerId;
            $rowPositions = parse_positions_csv((string) $player['positions']);
            $rowSearch = strtolower(trim((string) $player['name'] . ' ' . $player['positions'] . ' ' . pace_label((string) $player['pace']) . ' ' . number_format((float) $player['skill'], 1) . ' ' . ((int) $player['active'] === 1 ? 'activo si' : 'inactivo no')));
          ?>
          <tr data-player-table-row data-player-edit-row data-search="<?= h($rowSearch) ?>">
            <td>
              <input type="hidden" name="action" value="save" form="<?= h($rowFormId) ?>">
              <input type="hidden" name="id" value="<?= $playerId ?>" form="<?= h($rowFormId) ?>">
              <input class="table-input" type="text" name="name" required value="<?= h((string) $player['name']) ?>" form="<?= h($rowFormId) ?>">
            </td>
            <td>
              <div class="inline-checks">
                <?php foreach (allowed_positions() as $pos): ?>
                  <label class="mini-chip">
                    <input type="checkbox" name="positions[]" value="<?= h($pos) ?>" form="<?= h($rowFormId) ?>" <?= checked_attr(in_array($pos, $rowPositions, true)) ?>>
                    <?= h($pos) ?>
                  </label>
                <?php endforeach; ?>
              </div>
            </td>
            <td>
              <select class="table-input" name="pace" form="<?= h($rowFormId) ?>">
                <option value="rapido" <?= selected_attr(($player['pace'] ?? '') === 'rapido') ?>>Rapido</option>
                <option value="lento" <?= selected_attr(($player['pace'] ?? '') === 'lento') ?>>Lento</option>
              </select>
            </td>
            <td>
              <input class="table-input table-number" type="number" name="skill" min="1" max="6" step="0.5" value="<?= h(number_format((float) $player['skill'], 1)) ?>" form="<?= h($rowFormId) ?>">
            </td>
            <td>
              <label class="mini-chip">
                <input type="checkbox" name="active" value="1" form="<?= h($rowFormId) ?>" <?= checked_attr((int) $player['active'] === 1) ?>>
                Activo
              </label>
            </td>
            <td>
              <div class="btn-row">
                <form id="<?= h($rowFormId) ?>" method="post"></form>
                <button class="btn btn-primary" type="submit" form="<?= h($rowFormId) ?>">Guardar</button>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= $playerId ?>">
                  <button class="btn btn-danger" data-confirm="Eliminar jugador?" type="submit">Eliminar</button>
                </form>
              </div>
            </td>
          </tr>
        <?php endforeach; ?>
      <?php endif; ?>
      </tbody>
    </table>
  </div>
</section>

<?php foreach ($players as $player): ?>
  <?php
    $playerId = (int) $player['id'];
    $rowPositions = parse_positions_csv((string) $player['positions']);
  ?>
  <dialog class="player-edit-dialog" data-player-edit-dialog="<?= $playerId ?>">
    <form method="post" class="player-edit-panel">
      <div class="player-edit-head">
        <div>
          <h3>Editar jugador</h3>
          <p class="small-muted"><?= h((string) $player['name']) ?></p>
        </div>
        <button class="btn btn-muted player-icon-button" type="button" data-player-edit-close aria-label="Cerrar">X</button>
      </div>
      <input type="hidden" name="action" value="save">
      <input type="hidden" name="id" value="<?= $playerId ?>">

      <div class="form-grid">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="name" required value="<?= h((string) $player['name']) ?>">
        </div>
        <div class="form-row">
          <label>Ritmo</label>
          <select name="pace">
            <option value="rapido" <?= selected_attr(($player['pace'] ?? '') === 'rapido') ?>>Rapido</option>
            <option value="lento" <?= selected_attr(($player['pace'] ?? '') === 'lento') ?>>Lento</option>
          </select>
        </div>
        <div class="form-row">
          <label>Puntuacion Base (1 a 6)</label>
          <input type="number" name="skill" min="1" max="6" step="0.5" value="<?= h(number_format((float) $player['skill'], 1)) ?>">
        </div>
        <div class="form-row">
          <label>Estado</label>
          <label class="chip">
            <input type="checkbox" name="active" value="1" <?= checked_attr((int) $player['active'] === 1) ?>>
            Jugador activo
          </label>
        </div>
      </div>

      <div class="form-row">
        <label>Posiciones</label>
        <div class="check-row">
          <?php foreach (allowed_positions() as $pos): ?>
            <label class="chip">
              <input type="checkbox" name="positions[]" value="<?= h($pos) ?>" <?= checked_attr(in_array($pos, $rowPositions, true)) ?>>
              <?= h($pos) ?>
            </label>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" type="submit">Guardar cambios</button>
        <button class="btn btn-muted" type="button" data-player-edit-close>Cancelar</button>
      </div>
    </form>
  </dialog>
<?php endforeach; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
