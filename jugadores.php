<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

require_admin();
ensure_control_schema();

$pdo = db();

function player_row_search_text(array $player): string
{
    return strtolower(trim((string) $player['name'] . ' ' . $player['positions'] . ' ' . number_format(player_overall_rating($player), 1) . ' ' . implode(' ', array_map(static fn(string $field): string => number_format(player_effective_stat($player, $field), 1), player_stat_fields())) . ' ' . ((int) $player['active'] === 1 ? 'activo si' : 'inactivo no')));
}

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
        $active = isset($_POST['active']) ? 1 : 0;
        $ajax = ($_POST['ajax'] ?? '') === '1';

        if ($name === '' || !$positions) {
            if ($ajax) {
                http_response_code(422);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['ok' => false, 'message' => 'Nombre y posiciones son obligatorios.']);
                exit;
            }
            flash('error', 'Nombre y posiciones son obligatorios.');
            redirect($id > 0 ? 'jugadores.php?edit=' . $id : 'jugadores.php');
        }

        $positionsCsv = join_positions(array_map('strval', $positions));
        if ($positionsCsv === '') {
            if ($ajax) {
                http_response_code(422);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['ok' => false, 'message' => 'Debes seleccionar al menos una posicion valida.']);
                exit;
            }
            flash('error', 'Debes seleccionar al menos una posicion valida.');
            redirect($id > 0 ? 'jugadores.php?edit=' . $id : 'jugadores.php');
        }

        $technique = normalize_player_stat($_POST['technique'] ?? null);
        $rhythm = normalize_player_stat($_POST['rhythm'] ?? null);
        $defensePhysical = normalize_player_stat($_POST['defense_physical'] ?? null);
        $attack = normalize_player_stat($_POST['attack'] ?? null);
        $teamwork = normalize_player_stat($_POST['teamwork'] ?? null);
        $goalkeeperSkill = str_contains($positionsCsv, 'ARQ')
            ? normalize_player_stat($_POST['goalkeeper_skill'] ?? null)
            : null;
        $ratingPlayer = [
            'positions' => $positionsCsv,
            'technique' => $technique,
            'rhythm' => $rhythm,
            'defense_physical' => $defensePhysical,
            'attack' => $attack,
            'teamwork' => $teamwork,
            'goalkeeper_skill' => $goalkeeperSkill,
        ];
        $skill = player_overall_rating($ratingPlayer);
        $pace = player_pace_from_rhythm($rhythm);

        if ($id > 0) {
            $stmt = $pdo->prepare(
                'UPDATE players
                 SET name = :name, positions = :positions, pace = :pace, skill = :skill,
                     technique = :technique, rhythm = :rhythm, defense_physical = :defense_physical,
                     attack = :attack, teamwork = :teamwork, goalkeeper_skill = :goalkeeper_skill,
                     active = :active
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'name' => $name,
                'positions' => $positionsCsv,
                'pace' => $pace,
                'skill' => $skill,
                'technique' => $technique,
                'rhythm' => $rhythm,
                'defense_physical' => $defensePhysical,
                'attack' => $attack,
                'teamwork' => $teamwork,
                'goalkeeper_skill' => $goalkeeperSkill,
                'active' => $active,
            ]);
            if ($ajax) {
                header('Content-Type: application/json; charset=utf-8');
                $savedPlayer = [
                    'id' => $id,
                    'name' => $name,
                    'positions' => $positionsCsv,
                    'pace' => $pace,
                    'skill' => $skill,
                    'technique' => $technique,
                    'rhythm' => $rhythm,
                    'defense_physical' => $defensePhysical,
                    'attack' => $attack,
                    'teamwork' => $teamwork,
                    'goalkeeper_skill' => $goalkeeperSkill,
                    'active' => $active,
                ];
                echo json_encode([
                    'ok' => true,
                    'message' => 'Jugador actualizado.',
                    'player' => [
                        'id' => $id,
                        'name' => $name,
                        'positions' => $positionsCsv,
                        'skill' => player_overall_rating($savedPlayer),
                        'skill_label' => skill_label(player_overall_rating($savedPlayer)),
                        'active' => $active,
                        'search' => player_row_search_text($savedPlayer),
                    ],
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            flash('success', 'Jugador actualizado.');
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO players
                   (name, positions, pace, skill, technique, rhythm, defense_physical, attack, teamwork, goalkeeper_skill, active)
                 VALUES
                   (:name, :positions, :pace, :skill, :technique, :rhythm, :defense_physical, :attack, :teamwork, :goalkeeper_skill, :active)'
            );
            $stmt->execute([
                'name' => $name,
                'positions' => $positionsCsv,
                'pace' => $pace,
                'skill' => $skill,
                'technique' => $technique,
                'rhythm' => $rhythm,
                'defense_physical' => $defensePhysical,
                'attack' => $attack,
                'teamwork' => $teamwork,
                'goalkeeper_skill' => $goalkeeperSkill,
                'active' => $active,
            ]);
            if ($ajax) {
                $newId = (int) $pdo->lastInsertId();
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'ok' => true,
                    'message' => 'Jugador agregado correctamente. Recarga para verlo en el listado.',
                    'player' => ['id' => $newId, 'skill' => $skill, 'skill_label' => skill_label($skill)],
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
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
    'technique' => 3.0,
    'rhythm' => 3.0,
    'defense_physical' => 3.0,
    'attack' => 3.0,
    'teamwork' => 3.0,
    'goalkeeper_skill' => 3.0,
    'active' => 1,
];

$statLabels = [
    'technique' => 'Tecnica',
    'rhythm' => 'Ritmo',
    'defense_physical' => 'Solidez',
    'attack' => 'Ataque',
    'teamwork' => 'Compromiso',
    'goalkeeper_skill' => 'Habilidad de arquero',
];
$statHelp = [
    'technique' => 'Control, pase, gambeta y calidad con la pelota.',
    'rhythm' => 'Velocidad, aceleracion, intensidad y capacidad de ir y volver.',
    'defense_physical' => 'Marca, quite, anticipo, presion, fuerza, choque y resistencia defensiva.',
    'attack' => 'Definicion, llegada al arco, desmarque y peligro ofensivo.',
    'teamwork' => 'Juego en equipo, solidaridad, ubicacion, toma de decisiones, actitud, concentracion y responsabilidad tactica.',
    'goalkeeper_skill' => 'Atajada, reflejos, achique, posicionamiento, juego aereo y seguridad bajo los tres palos.',
];
$ratingHelp = [
    '1 estrella' => 'Muy bajo.',
    '2 estrellas' => 'Bajo.',
    '3 estrellas' => 'Aceptable.',
    '4 estrellas' => 'Bueno.',
    '5 estrellas' => 'Muy bueno.',
    '6 estrellas' => 'Excelente.',
];

function stat_rating_control(string $name, float $value, ?string $formId = null, bool $compact = false): string
{
    $rating = (int) max(1, min(6, round($value)));
    $formAttr = $formId !== null ? ' form="' . h($formId) . '"' : '';
    $classes = 'stat-rating' . ($compact ? ' stat-rating-compact' : '');
    $html = '<div class="' . $classes . '" data-stat-rating>';
    $html .= '<input type="hidden" name="' . h($name) . '" value="' . $rating . '"' . $formAttr . ' data-stat-rating-input>';
    $html .= '<div class="stat-rating-stars" role="radiogroup" aria-label="' . h($name) . '">';
    for ($i = 1; $i <= 6; $i++) {
        $active = $i <= $rating ? ' is-active' : '';
        $checked = $i === $rating ? 'true' : 'false';
        $html .= '<button type="button" class="stat-star' . $active . '" data-stat-value="' . $i . '" role="radio" aria-checked="' . $checked . '" aria-label="' . $i . ' de 6">★</button>';
    }
    $html .= '</div>';
    $html .= '<span class="stat-rating-value" data-stat-rating-value>' . $rating . '/6</span>';
    $html .= '</div>';
    return $html;
}

function player_stats_help_panel(array $statLabels, array $statHelp, array $ratingHelp): string
{
    $html = '<details class="player-stat-help" data-player-stat-help>';
    $html .= '<summary>¿Como funciona?</summary>';
    $html .= '<div class="player-stat-help-body">';
    $html .= '<section><h4>Stats</h4>';
    foreach ($statHelp as $field => $help) {
        $html .= '<p data-stat-help="' . h((string) $field) . '"><strong>' . h((string) $statLabels[$field]) . ':</strong> ' . h((string) $help) . '</p>';
    }
    $html .= '</section>';
    $html .= '<section><h4>Puntuacion</h4>';
    foreach ($ratingHelp as $label => $help) {
        $html .= '<p><strong>' . h((string) $label) . ':</strong> ' . h((string) $help) . '</p>';
    }
    $html .= '</section>';
    $html .= '</div>';
    $html .= '</details>';
    return $html;
}

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
        <label>General</label>
        <div class="player-general-rating" data-general-rating>
          <strong data-general-rating-value>3/6</strong>
          <span data-general-rating-stars>★★★☆☆☆</span>
        </div>
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

    <div class="form-grid">
      <?php foreach (player_field_stat_fields() as $field): ?>
        <div class="form-row stat-form-row">
          <label><?= h($statLabels[$field]) ?></label>
          <?= stat_rating_control($field, player_effective_stat($form, $field)) ?>
        </div>
      <?php endforeach; ?>
      <div class="form-row stat-form-row" data-goalkeeper-stat-row>
        <label><?= h($statLabels['goalkeeper_skill']) ?></label>
        <?= stat_rating_control('goalkeeper_skill', player_effective_stat($form, 'goalkeeper_skill')) ?>
      </div>
    </div>

    <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp) ?>

    <div class="btn-row">
      <button class="btn btn-primary" type="submit">Crear jugador</button>
    </div>
  </form>
</details>

<section class="card">
  <div class="section-toolbar">
    <h3>Listado de jugadores</h3>
    <input type="text" data-player-list-search placeholder="Buscar jugador por nombre, posicion o stats">
  </div>
  <div class="players-desktop-help">
    <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp) ?>
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
            $rowSearch = player_row_search_text($player);
          ?>
          <article class="mobile-player-list-item" data-player-table-row data-search="<?= h($rowSearch) ?>">
            <span>
              <strong><?= h((string) $player['name']) ?></strong>
              <small><?= h((string) $player['positions']) ?> | General <?= h(skill_label(player_overall_rating($player))) ?></small>
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
          <th>General</th>
          <th>Stats</th>
          <th>Acc.</th>
        </tr>
      </thead>
      <tbody>
      <?php if (!$players): ?>
        <tr><td colspan="5">No hay jugadores cargados.</td></tr>
      <?php else: ?>
        <?php foreach ($players as $player): ?>
          <?php
            $playerId = (int) $player['id'];
            $rowFormId = 'player-row-' . $playerId;
            $rowPositions = parse_positions_csv((string) $player['positions']);
            $rowSearch = player_row_search_text($player);
          ?>
          <tr data-player-table-row data-player-edit-row data-search="<?= h($rowSearch) ?>">
            <td>
              <input type="hidden" name="action" value="save" form="<?= h($rowFormId) ?>">
              <input type="hidden" name="id" value="<?= $playerId ?>" form="<?= h($rowFormId) ?>">
              <label class="player-active-inline">
                <input type="checkbox" name="active" value="1" form="<?= h($rowFormId) ?>" <?= checked_attr((int) $player['active'] === 1) ?>>
                Activo
              </label>
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
              <div class="player-general-rating player-general-rating-compact" data-general-rating>
                <strong data-general-rating-value><?= h(number_format(player_overall_rating($player), 1)) ?>/6</strong>
                <span data-general-rating-stars></span>
              </div>
            </td>
            <td>
              <div class="player-table-stat-grid">
                <?php foreach (player_field_stat_fields() as $field): ?>
                  <div class="player-table-stat">
                    <span><?= h($statLabels[$field]) ?></span>
                    <?= stat_rating_control($field, player_effective_stat($player, $field), $rowFormId, true) ?>
                  </div>
                <?php endforeach; ?>
                <div class="player-table-stat" data-goalkeeper-stat-row>
                  <span><?= h($statLabels['goalkeeper_skill']) ?></span>
                  <?= stat_rating_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill'), $rowFormId, true) ?>
                </div>
              </div>
            </td>
            <td>
              <div class="btn-row">
                <form id="<?= h($rowFormId) ?>" method="post"></form>
                <button class="btn btn-primary player-action-icon player-save-icon" type="submit" form="<?= h($rowFormId) ?>" data-player-row-save aria-label="Guardar <?= h((string) $player['name']) ?>" title="Guardar"></button>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= $playerId ?>">
                  <button class="btn btn-danger player-action-icon player-trash-icon" data-confirm="Eliminar jugador?" type="submit" aria-label="Eliminar <?= h((string) $player['name']) ?>" title="Eliminar"></button>
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
          <label>General</label>
          <div class="player-general-rating" data-general-rating>
            <strong data-general-rating-value><?= h(number_format(player_overall_rating($player), 1)) ?>/6</strong>
            <span data-general-rating-stars></span>
          </div>
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

      <div class="form-grid">
        <?php foreach (player_field_stat_fields() as $field): ?>
          <div class="form-row stat-form-row">
            <label><?= h($statLabels[$field]) ?></label>
            <?= stat_rating_control($field, player_effective_stat($player, $field)) ?>
          </div>
        <?php endforeach; ?>
        <div class="form-row stat-form-row" data-goalkeeper-stat-row>
          <label><?= h($statLabels['goalkeeper_skill']) ?></label>
          <?= stat_rating_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill')) ?>
        </div>
      </div>

      <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp) ?>

      <div class="btn-row">
        <button class="btn btn-primary" type="submit">Guardar cambios</button>
        <button class="btn btn-muted" type="button" data-player-edit-close>Cancelar</button>
      </div>
    </form>
  </dialog>
<?php endforeach; ?>

<script>
  (() => {
    const statNames = ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork'];
    const fullStars = (rating) => {
      const full = Math.floor(rating);
      const half = rating % 1 !== 0;
      return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, 6 - full - (half ? 1 : 0)));
    };

    const formatRating = (rating) => Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

    const updateGeneralRating = (scope) => {
      const general = scope.querySelector('[data-general-rating]');
      if (!general) return;

      const getValue = (name) => Number(scope.querySelector(`[data-stat-rating-input][name="${name}"]`)?.value || 3);
      const baseTotal = statNames.reduce((total, name) => total + getValue(name), 0);
      const hasGoalkeeper = Boolean(scope.querySelector('input[name="positions[]"][value="ARQ"]:checked'));
      const raw = hasGoalkeeper
        ? (baseTotal + (getValue('goalkeeper_skill') * 2)) / 7
        : baseTotal / 5;
      const rounded = Math.max(1, Math.min(6, Math.round(raw * 10) / 10));

      const value = general.querySelector('[data-general-rating-value]');
      const stars = general.querySelector('[data-general-rating-stars]');
      if (value) value.textContent = `${formatRating(rounded)}/6`;
      if (stars) stars.textContent = fullStars(rounded);
    };

    const setRating = (root, value) => {
      const rating = Math.max(1, Math.min(6, Number(value) || 1));
      const input = root.querySelector('[data-stat-rating-input]');
      const label = root.querySelector('[data-stat-rating-value]');
      const previous = input?.value;
      if (input) {
        input.value = String(rating);
        if (previous !== input.value) {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (label) label.textContent = `${rating}/6`;
      root.querySelectorAll('[data-stat-value]').forEach((button) => {
        const current = Number(button.getAttribute('data-stat-value') || '0');
        button.classList.toggle('is-active', current <= rating);
        button.setAttribute('aria-checked', current === rating ? 'true' : 'false');
      });
    };

    document.querySelectorAll('[data-stat-rating]').forEach((root) => {
      const input = root.querySelector('[data-stat-rating-input]');
      setRating(root, input?.value || 3);
      root.querySelectorAll('[data-stat-value]').forEach((button) => {
        button.addEventListener('click', () => setRating(root, button.getAttribute('data-stat-value')));
        button.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            return;
          }
          event.preventDefault();
          const current = Number(root.querySelector('[data-stat-rating-input]')?.value || 1);
          const next = event.key === 'Home'
            ? 1
            : event.key === 'End'
              ? 6
              : current + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1);
          setRating(root, next);
          root.querySelector(`[data-stat-value="${Math.max(1, Math.min(6, next))}"]`)?.focus();
        });
      });
    });

    const syncGoalkeeperStats = (scope) => {
      const hasGoalkeeper = Boolean(scope.querySelector('input[name="positions[]"][value="ARQ"]:checked'));
      scope.querySelectorAll('[data-goalkeeper-stat-row]').forEach((row) => {
        row.hidden = !hasGoalkeeper;
        row.querySelectorAll('input, select, textarea').forEach((input) => {
          input.disabled = !hasGoalkeeper;
        });
      });
      scope.querySelectorAll('[data-stat-help="goalkeeper_skill"]').forEach((row) => {
        row.hidden = !hasGoalkeeper;
      });
      updateGeneralRating(scope);
    };

    const scopes = document.querySelectorAll('form.player-create-body, form.player-edit-panel, tr[data-player-edit-row]');
    scopes.forEach((scope) => {
      syncGoalkeeperStats(scope);
      scope.querySelectorAll('[data-stat-rating-input]').forEach((input) => {
        input.addEventListener('input', () => updateGeneralRating(scope));
        input.addEventListener('change', () => updateGeneralRating(scope));
      });
      scope.querySelectorAll('input[name="positions[]"]').forEach((input) => {
        input.addEventListener('change', () => syncGoalkeeperStats(scope));
      });
      updateGeneralRating(scope);
    });
  })();
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
