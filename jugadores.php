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

$editId = isset($_GET['edit']) ? (int) $_GET['edit'] : 0;
$editing = $editId > 0 ? repo_player_by_id($editId) : null;
$form = $editing ?: [
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

<section class="card mb-3.5">
  <h3><?= $form['id'] ? 'Editar jugador' : 'Agregar jugador' ?></h3>
  <form method="post">
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
      <button class="btn btn-primary" type="submit"><?= $form['id'] ? 'Guardar cambios' : 'Crear jugador' ?></button>
      <?php if ($form['id']): ?>
        <a class="btn btn-muted" href="jugadores.php">Cancelar</a>
      <?php endif; ?>
    </div>
  </form>
</section>

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
              <small><?= h((string) $player['positions']) ?> | <?= h(pace_label((string) $player['pace'])) ?> | <?= h(number_format((float) $player['skill'], 1)) ?> pts</small>
            </span>
            <em class="<?= (int) $player['active'] === 1 ? 'is-active' : 'is-inactive' ?>">
              <?= (int) $player['active'] === 1 ? 'Activo' : 'Inactivo' ?>
            </em>
          </article>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </details>
  <div class="table-wrap">
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
          <tr data-player-table-row data-search="<?= h($rowSearch) ?>">
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

<?php require __DIR__ . '/includes/footer.php'; ?>
