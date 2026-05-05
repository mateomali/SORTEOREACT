<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

function player_ajax_token(): string
{
    return hash_hmac('sha256', 'players-save|' . date('Y-m-d'), ADMIN_PASSWORD);
}

function valid_player_ajax_token(string $token): bool
{
    if ($token === '') {
        return false;
    }
    $today = hash_hmac('sha256', 'players-save|' . date('Y-m-d'), ADMIN_PASSWORD);
    $yesterday = hash_hmac('sha256', 'players-save|' . date('Y-m-d', strtotime('-1 day')), ADMIN_PASSWORD);
    return hash_equals($today, $token) || hash_equals($yesterday, $token);
}

function player_same_origin_ajax_request(): bool
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return false;
    }

    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $key) {
        $value = (string) ($_SERVER[$key] ?? '');
        if ($value === '') {
            continue;
        }
        $parts = parse_url($value);
        $requestHost = strtolower((string) ($parts['host'] ?? ''));
        $requestPort = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        if ($requestHost !== '' && ($requestHost === $host || ($requestHost . $requestPort) === $host)) {
            return true;
        }
    }

    return false;
}

$isAjaxRequest = ($_POST['ajax'] ?? '') === '1'
    || strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'fetch'
    || strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';

$hasValidAjaxToken = $isAjaxRequest && valid_player_ajax_token((string) ($_POST['ajax_token'] ?? ''));
$hasSameOriginAjax = $isAjaxRequest && player_same_origin_ajax_request();
$isAdmin = is_admin();

if (!$isAdmin && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($isAjaxRequest) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'message' => 'No tenes permisos para modificar jugadores.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    flash('error', 'Solo un administrador puede modificar jugadores.');
    redirect('jugadores.php');
}
ensure_control_schema();

$pdo = db();
$showInactive = $isAdmin && (($_GET['show_inactive'] ?? $_POST['show_inactive'] ?? '') === '1');

function player_row_search_text(array $player): string
{
    return strtolower(trim((string) $player['name'] . ' ' . $player['positions'] . ' ' . number_format(player_overall_rating($player), 1) . ' ' . implode(' ', array_map(static fn(string $field): string => number_format(player_effective_stat($player, $field), 1), player_stat_fields())) . ' ' . ((int) $player['active'] === 1 ? 'activo si' : 'inactivo no')));
}

function player_scout_data_attrs(array $player): string
{
    $attrs = [
        'player-scout-name' => (string) ($player['name'] ?? ''),
        'player-scout-positions' => (string) ($player['positions'] ?? ''),
        'player-scout-skill' => number_format(player_overall_rating($player), 1, '.', ''),
        'player-scout-technique' => number_format(player_effective_stat($player, 'technique'), 1, '.', ''),
        'player-scout-rhythm' => number_format(player_effective_stat($player, 'rhythm'), 1, '.', ''),
        'player-scout-defense-physical' => number_format(player_effective_stat($player, 'defense_physical'), 1, '.', ''),
        'player-scout-attack' => number_format(player_effective_stat($player, 'attack'), 1, '.', ''),
        'player-scout-teamwork' => number_format(player_effective_stat($player, 'teamwork'), 1, '.', ''),
        'player-scout-regularity' => number_format(player_effective_stat($player, 'regularity'), 1, '.', ''),
        'player-scout-goalkeeper-skill' => number_format(player_effective_stat($player, 'goalkeeper_skill'), 1, '.', ''),
    ];

    $html = '';
    foreach ($attrs as $name => $value) {
        $html .= ' data-' . $name . '="' . h($value) . '"';
    }
    return $html;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $returnAnchor = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_POST['return_anchor'] ?? ''));
    $playersReturnUrl = 'jugadores.php' . ($showInactive ? '?show_inactive=1' : '') . ($returnAnchor !== '' ? '#' . $returnAnchor : '');

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
                flash('info', 'El jugador tiene historial. Se oculto del listado y se conserva para estadisticas.');
            }
        }
        redirect($playersReturnUrl);
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
        redirect($playersReturnUrl);
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
            redirect($id > 0 ? $playersReturnUrl : 'jugadores.php');
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
            redirect($id > 0 ? $playersReturnUrl : 'jugadores.php');
        }

        $technique = normalize_player_stat($_POST['technique'] ?? null);
        $rhythm = normalize_player_stat($_POST['rhythm'] ?? null);
        $defensePhysical = normalize_player_stat($_POST['defense_physical'] ?? null);
        $attack = normalize_player_stat($_POST['attack'] ?? null);
        $teamwork = normalize_player_stat($_POST['teamwork'] ?? null);
        $regularity = normalize_player_stat($_POST['regularity'] ?? null, 3.5);
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
            'regularity' => $regularity,
            'goalkeeper_skill' => $goalkeeperSkill,
        ];
        $skill = player_overall_rating($ratingPlayer);
        $pace = player_pace_from_rhythm($rhythm);

        if ($id > 0) {
            $stmt = $pdo->prepare(
                'UPDATE players
                 SET name = :name, positions = :positions, pace = :pace, skill = :skill,
                     technique = :technique, rhythm = :rhythm, defense_physical = :defense_physical,
                     attack = :attack, teamwork = :teamwork, regularity = :regularity, goalkeeper_skill = :goalkeeper_skill,
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
                'regularity' => $regularity,
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
                    'regularity' => $regularity,
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
                   (name, positions, pace, skill, technique, rhythm, defense_physical, attack, teamwork, regularity, goalkeeper_skill, active)
                 VALUES
                   (:name, :positions, :pace, :skill, :technique, :rhythm, :defense_physical, :attack, :teamwork, :regularity, :goalkeeper_skill, :active)'
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
                'regularity' => $regularity,
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
        redirect($playersReturnUrl);
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
    'regularity' => 3.5,
    'goalkeeper_skill' => 3.0,
    'active' => 1,
];

$statLabels = [
    'technique' => 'Tecnica',
    'rhythm' => 'Ritmo',
    'defense_physical' => 'Solidez',
    'attack' => 'Ataque',
    'teamwork' => 'Compromiso',
    'regularity' => 'Regularidad',
    'goalkeeper_skill' => 'Habilidad de arquero',
];
$statHelp = [
    'technique' => 'Control, pase, gambeta y calidad con la pelota.',
    'rhythm' => 'Velocidad, aceleracion, intensidad y capacidad de ir y volver.',
    'defense_physical' => 'Marca, quite, anticipo, presion, fuerza, choque y resistencia defensiva.',
    'attack' => 'Definicion, llegada al arco, desmarque y peligro ofensivo.',
    'teamwork' => 'Juego en equipo, solidaridad, ubicacion, toma de decisiones, actitud, concentracion y responsabilidad tactica.',
    'regularity' => 'Estabilidad para rendir cerca de su nivel habitual, sin alternar tanto entre partidazos y partidos flojos.',
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
$fieldWeightHelp = [
    'Ataque 25%' => 'Premia al jugador que genera o define.',
    'Tecnica 20%' => 'Mantiene valor para el que juega bien.',
    'Ritmo 20%' => 'En futbol amateur pesa mucho: correr y volver cambia partidos.',
    'Solidez 20%' => 'Evita que solo cuente atacar.',
    'Compromiso 15%' => 'Importa, pero no infla demasiado a jugadores solo ordenados.',
    'Regularidad +/-5%' => 'Ajusta el promedio final: 6 suma 5%, 1 resta 5%, 3/4 quedan casi neutros.',
];

function stat_rating_control(string $name, float $value, ?string $formId = null, bool $compact = false, bool $readonly = false): string
{
    $rating = (int) max(1, min(6, round($value)));
    $formAttr = $formId !== null ? ' form="' . h($formId) . '"' : '';
    $classes = 'stat-rating' . ($compact ? ' stat-rating-compact' : '') . ($readonly ? ' stat-rating-readonly' : '');
    $readonlyAttr = $readonly ? ' data-stat-rating-readonly' : '';
    $disabledAttr = $readonly ? ' disabled' : '';
    $html = '<div class="' . $classes . '" data-stat-rating' . $readonlyAttr . '>';
    $html .= '<input type="hidden" name="' . h($name) . '" value="' . $rating . '"' . $formAttr . ' data-stat-rating-input>';
    $html .= '<div class="stat-rating-stars" role="radiogroup" aria-label="' . h($name) . '">';
    for ($i = 1; $i <= 6; $i++) {
        $active = $i <= $rating ? ' is-active' : '';
        $checked = $i === $rating ? 'true' : 'false';
        $html .= '<button type="button" class="stat-star' . $active . '" data-stat-value="' . $i . '" role="radio" aria-checked="' . $checked . '" aria-label="' . $i . ' de 6"' . $disabledAttr . '>★</button>';
    }
    $html .= '</div>';
    $html .= '<span class="stat-rating-value" data-stat-rating-value>' . $rating . '/6</span>';
    $html .= '</div>';
    return $html;
}

function player_stats_help_panel(array $statLabels, array $statHelp, array $ratingHelp, array $fieldWeightHelp): string
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
    $html .= '<section class="player-stat-help-wide"><h4>Promedio general</h4>';
    foreach ($fieldWeightHelp as $label => $help) {
        $html .= '<p><strong>' . h((string) $label) . ':</strong> ' . h((string) $help) . '</p>';
    }
    $html .= '</section>';
    $html .= '</div>';
    $html .= '</details>';
    return $html;
}

function player_stats_radar_panel(bool $compact = false): string
{
    $class = 'player-radar-card' . ($compact ? ' player-radar-card-compact' : '');
    return '<aside class="' . $class . '" data-player-radar hidden>
      <div class="player-radar-head">
        <strong>Perfil del jugador</strong>
        <span data-player-radar-subtitle>Analisis de stats</span>
      </div>
      <div class="player-radar-canvas" data-player-radar-canvas></div>
    </aside>';
}

$players = repo_all_players(!$showInactive);
$title = 'Jugadores | ' . APP_NAME;
$activePage = 'jugadores.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Jugadores</h1>
    <p class="small-muted"><?= $isAdmin ? 'Alta, edicion y administracion general de la plantilla.' : 'Consulta de plantilla, posiciones y stats actuales.' ?></p>
  </div>
  <?php if ($isAdmin): ?>
    <a class="btn btn-muted" href="migrar_csv.php">Migrar desde CSV</a>
  <?php endif; ?>
</section>

<?php if ($isAdmin): ?>
  <details class="card mb-3.5 player-create-drawer">
    <summary class="player-create-summary">
      <span>Agregar jugador</span>
      <small>Cargar nuevo jugador</small>
    </summary>
    <form method="post" class="player-create-body">
      <input type="hidden" name="action" value="save">
      <input type="hidden" name="id" value="<?= (int) $form['id'] ?>">
      <input type="hidden" name="ajax_token" value="<?= h(player_ajax_token()) ?>">
      <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">

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

    <div class="player-stats-editor">
      <div class="form-grid">
        <?php foreach (player_field_stat_fields() as $field): ?>
          <div class="form-row stat-form-row" <?= $field === 'attack' ? 'data-attack-stat-row' : '' ?>>
            <label><?= h($statLabels[$field]) ?></label>
            <?= stat_rating_control($field, player_effective_stat($form, $field)) ?>
          </div>
        <?php endforeach; ?>
        <div class="form-row stat-form-row" data-goalkeeper-stat-row>
          <label><?= h($statLabels['goalkeeper_skill']) ?></label>
          <?= stat_rating_control('goalkeeper_skill', player_effective_stat($form, 'goalkeeper_skill')) ?>
        </div>
      </div>
        <?= player_stats_radar_panel() ?>
      </div>

      <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>

      <div class="btn-row">
        <button class="btn btn-primary" type="submit">Crear jugador</button>
      </div>
    </form>
  </details>
<?php endif; ?>

<section class="card">
  <div class="section-toolbar">
    <div>
      <h3>Listado de jugadores</h3>
      <p class="small-muted"><?= $showInactive ? 'Mostrando activos e inactivos.' : 'Mostrando solo jugadores activos.' ?></p>
    </div>
    <?php if ($isAdmin): ?>
      <a class="btn btn-muted" href="<?= $showInactive ? 'jugadores.php' : 'jugadores.php?show_inactive=1' ?>">
        <?= $showInactive ? 'Ver solo activos' : 'Ver inactivos' ?>
      </a>
    <?php endif; ?>
    <input type="text" data-player-list-search placeholder="Buscar jugador por nombre, posicion o stats">
  </div>
  <div class="players-desktop-help">
    <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>
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
          <article id="player-<?= (int) $player['id'] ?>" class="mobile-player-list-item" data-player-table-row data-search="<?= h($rowSearch) ?>">
            <span>
              <strong><?= h((string) $player['name']) ?></strong>
              <small><?= h((string) $player['positions']) ?> | General <?= h(skill_label(player_overall_rating($player))) ?></small>
            </span>
            <span class="mobile-player-list-actions">
              <?php if ($isAdmin): ?>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="toggle_active">
                  <input type="hidden" name="id" value="<?= (int) $player['id'] ?>">
                  <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
                  <input type="hidden" name="return_anchor" value="player-<?= (int) $player['id'] ?>">
                  <button class="player-status-pill <?= (int) $player['active'] === 1 ? 'is-active' : 'is-inactive' ?>" type="button" title="Cambiar estado" data-player-status-toggle>
                    <?= (int) $player['active'] === 1 ? 'Activo' : 'Inactivo' ?>
                  </button>
                </form>
                <button class="btn btn-muted player-icon-button player-scout-icon" type="button" data-player-scout-open<?= player_scout_data_attrs($player) ?> aria-label="Informe de <?= h((string) $player['name']) ?>" title="Informe"></button>
                <button class="btn btn-muted player-icon-button icon-pencil" type="button" data-player-edit-open="<?= (int) $player['id'] ?>" aria-label="Editar <?= h((string) $player['name']) ?>" title="Editar"></button>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= (int) $player['id'] ?>">
                  <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
                  <input type="hidden" name="return_anchor" value="player-<?= (int) $player['id'] ?>">
                  <button class="btn btn-danger player-icon-button player-delete-icon" data-confirm="Eliminar jugador?" type="submit" aria-label="Eliminar <?= h((string) $player['name']) ?>" title="Eliminar">X</button>
                </form>
              <?php else: ?>
                <span class="player-status-pill <?= (int) $player['active'] === 1 ? 'is-active' : 'is-inactive' ?>">
                  <?= (int) $player['active'] === 1 ? 'Activo' : 'Inactivo' ?>
                </span>
                <button class="btn btn-muted player-icon-button player-scout-icon" type="button" data-player-scout-open<?= player_scout_data_attrs($player) ?> aria-label="Informe de <?= h((string) $player['name']) ?>" title="Informe"></button>
                <button class="btn btn-muted" type="button" data-player-edit-open="<?= (int) $player['id'] ?>" aria-label="Ver stats de <?= h((string) $player['name']) ?>" title="Ver stats">Ver</button>
              <?php endif; ?>
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
          <?php if ($isAdmin): ?>
            <th>Acc.</th>
          <?php endif; ?>
        </tr>
      </thead>
      <tbody>
      <?php if (!$players): ?>
        <tr><td colspan="<?= $isAdmin ? '5' : '4' ?>">No hay jugadores cargados.</td></tr>
      <?php else: ?>
        <?php foreach ($players as $player): ?>
          <?php
            $playerId = (int) $player['id'];
            $rowFormId = 'player-row-' . $playerId;
            $rowPositions = parse_positions_csv((string) $player['positions']);
            $rowSearch = player_row_search_text($player);
          ?>
          <tr data-player-table-row data-player-edit-row data-player-id="<?= $playerId ?>" data-search="<?= h($rowSearch) ?>">
            <td>
              <?php if ($isAdmin): ?>
                <input type="hidden" name="action" value="save" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="id" value="<?= $playerId ?>" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="ajax_token" value="<?= h(player_ajax_token()) ?>" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="return_anchor" value="player-<?= $playerId ?>" form="<?= h($rowFormId) ?>">
              <?php endif; ?>
              <label class="player-active-inline">
                <input type="checkbox" name="active" value="1" <?= $isAdmin ? 'form="' . h($rowFormId) . '"' : 'disabled' ?> <?= checked_attr((int) $player['active'] === 1) ?>>
                Activo
              </label>
              <?php if ($isAdmin): ?>
                <input class="table-input" type="text" name="name" required value="<?= h((string) $player['name']) ?>" form="<?= h($rowFormId) ?>">
              <?php else: ?>
                <strong class="player-readonly-name"><?= h((string) $player['name']) ?></strong>
              <?php endif; ?>
              <button class="btn btn-muted player-scout-row-button" type="button" data-player-scout-open aria-label="Informe de <?= h((string) $player['name']) ?>" title="Informe del relator">
                <span class="player-scout-icon" aria-hidden="true"></span>
                <span>Informe</span>
              </button>
            </td>
            <td>
              <div class="inline-checks">
                <?php foreach (allowed_positions() as $pos): ?>
                  <label class="mini-chip">
                    <input type="checkbox" name="positions[]" value="<?= h($pos) ?>" <?= $isAdmin ? 'form="' . h($rowFormId) . '"' : 'disabled' ?> <?= checked_attr(in_array($pos, $rowPositions, true)) ?>>
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
              <?= player_stats_radar_panel(true) ?>
            </td>
            <td>
              <div class="player-table-stat-grid">
                <?php foreach (player_field_stat_fields() as $field): ?>
                  <div class="player-table-stat" <?= $field === 'attack' ? 'data-attack-stat-row' : '' ?>>
                    <span><?= h($statLabels[$field]) ?></span>
                    <?= stat_rating_control($field, player_effective_stat($player, $field), $isAdmin ? $rowFormId : null, true, !$isAdmin) ?>
                  </div>
                <?php endforeach; ?>
                <div class="player-table-stat" data-goalkeeper-stat-row>
                  <span><?= h($statLabels['goalkeeper_skill']) ?></span>
                  <?= stat_rating_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill'), $isAdmin ? $rowFormId : null, true, !$isAdmin) ?>
                </div>
              </div>
            </td>
            <?php if ($isAdmin): ?>
              <td>
                <div class="btn-row">
                  <form id="<?= h($rowFormId) ?>" method="post"></form>
                  <button class="btn btn-primary player-action-icon player-save-icon" type="submit" form="<?= h($rowFormId) ?>" data-player-row-save aria-label="Guardar <?= h((string) $player['name']) ?>" title="Guardar"></button>
                  <form method="post" class="inline">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="id" value="<?= $playerId ?>">
                    <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
                    <input type="hidden" name="return_anchor" value="player-<?= $playerId ?>">
                    <button class="btn btn-danger player-action-icon player-trash-icon" data-confirm="Eliminar jugador?" type="submit" aria-label="Eliminar <?= h((string) $player['name']) ?>" title="Eliminar"></button>
                  </form>
                </div>
              </td>
            <?php endif; ?>
          </tr>
        <?php endforeach; ?>
      <?php endif; ?>
      </tbody>
    </table>
  </div>
</section>

<div class="player-scout-floating-panel" data-player-scout-panel hidden>
  <article class="player-scout-floating-card" role="dialog" aria-modal="true" aria-labelledby="playerScoutTitle">
    <div class="player-scout-floating-head">
      <span>Informe del relator</span>
      <button class="player-scout-close" type="button" data-player-scout-close aria-label="Cerrar">x</button>
    </div>
    <h3 id="playerScoutTitle" data-player-scout-title>Perfil del jugador</h3>
    <p data-player-scout-body>-</p>
    <div class="player-scout-tags" data-player-scout-tags></div>
  </article>
</div>

<?php foreach ($players as $player): ?>
  <?php
    $playerId = (int) $player['id'];
    $rowPositions = parse_positions_csv((string) $player['positions']);
  ?>
  <dialog class="player-edit-dialog" data-player-edit-dialog="<?= $playerId ?>">
    <form method="post" class="player-edit-panel" <?= $isAdmin ? '' : 'data-player-readonly-form' ?>>
      <div class="player-edit-head">
        <div>
          <h3><?= $isAdmin ? 'Editar jugador' : 'Ver jugador' ?></h3>
          <p class="small-muted"><?= h((string) $player['name']) ?></p>
        </div>
        <button class="btn btn-muted player-icon-button" type="button" data-player-edit-close aria-label="Cerrar">X</button>
      </div>
      <?php if ($isAdmin): ?>
        <input type="hidden" name="action" value="save">
        <input type="hidden" name="id" value="<?= $playerId ?>">
        <input type="hidden" name="ajax_token" value="<?= h(player_ajax_token()) ?>">
        <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
        <input type="hidden" name="return_anchor" value="player-<?= $playerId ?>">
      <?php endif; ?>

      <div class="form-grid">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="name" required value="<?= h((string) $player['name']) ?>" <?= $isAdmin ? '' : 'readonly' ?>>
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
            <input type="checkbox" name="active" value="1" <?= checked_attr((int) $player['active'] === 1) ?> <?= $isAdmin ? '' : 'disabled' ?>>
            Jugador activo
          </label>
        </div>
      </div>

      <div class="form-row">
        <label>Posiciones</label>
        <div class="check-row">
          <?php foreach (allowed_positions() as $pos): ?>
            <label class="chip">
              <input type="checkbox" name="positions[]" value="<?= h($pos) ?>" <?= checked_attr(in_array($pos, $rowPositions, true)) ?> <?= $isAdmin ? '' : 'disabled' ?>>
              <?= h($pos) ?>
            </label>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="form-grid">
        <?php foreach (player_field_stat_fields() as $field): ?>
          <div class="form-row stat-form-row" <?= $field === 'attack' ? 'data-attack-stat-row' : '' ?>>
            <label><?= h($statLabels[$field]) ?></label>
            <?= stat_rating_control($field, player_effective_stat($player, $field), null, false, !$isAdmin) ?>
          </div>
        <?php endforeach; ?>
        <div class="form-row stat-form-row" data-goalkeeper-stat-row>
          <label><?= h($statLabels['goalkeeper_skill']) ?></label>
          <?= stat_rating_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill'), null, false, !$isAdmin) ?>
        </div>
      </div>

      <?= player_stats_radar_panel() ?>

      <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>

      <div class="btn-row">
        <?php if ($isAdmin): ?>
          <button class="btn btn-primary" type="submit">Guardar cambios</button>
          <button class="btn btn-muted" type="button" data-player-edit-close>Cancelar</button>
        <?php else: ?>
          <button class="btn btn-muted" type="button" data-player-edit-close>Cerrar</button>
        <?php endif; ?>
      </div>
    </form>
  </dialog>
<?php endforeach; ?>

<script>
  (() => {
    window.playerAjaxToken = '<?= $isAdmin ? h(player_ajax_token()) : '' ?>';
    const statNames = ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'regularity'];
    const fullStars = (rating) => {
      const full = Math.floor(rating);
      const half = rating % 1 !== 0;
      return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, 6 - full - (half ? 1 : 0)));
    };

    const formatRating = (rating) => Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
    const radarLabels = {
      technique: 'Tecnica',
      rhythm: 'Ritmo',
      defense_physical: 'Solidez',
      attack: 'Ataque',
      teamwork: 'Compromiso',
      regularity: 'Regularidad',
      goalkeeper_skill: 'Arquero',
    };
    const radarShortLabels = {
      technique: 'TEC',
      rhythm: 'RIT',
      defense_physical: 'SOL',
      attack: 'ATA',
      teamwork: 'COM',
      regularity: 'REG',
      goalkeeper_skill: 'ARQ',
    };
    const scoutStatRules = [
      {
        field: 'technique',
        label: 'Tecnica',
        strength: ['la pelota todavia le rebota como baldosa floja', 'tiene lo basico: no tira lujos, pero tampoco se prende fuego solo', 'controla, descarga y no se mete en cuentos raros', 'ya se anima a pisarla y levantar la cabeza', 'tiene pie fino: donde otros revientan, el tipo intenta jugar', 'trae joystick incorporado: la pelota le hace caso'],
        weakness: ['si le tiran un melon, capaz lo devuelve en sandia', 'cuando lo apuran, el primer control puede pedir auxilio', 'no es negado, pero tampoco le pidas una rabona en el area', 'a veces le falta un toque mas limpio para quedar bien perfilado', 'con la pelota casi siempre sale bien parado', 'hasta cuando se equivoca parece que quiso hacer algo distinto'],
      },
      {
        field: 'rhythm',
        label: 'Ritmo',
        strength: ['va en tercera aunque el partido pida autopista', 'no es una moto, pero llega si no lo hacen cruzar todo el conurbano', 'cumple el recorrido sin hacer ruido', 'tiene nafta para ir y volver sin pedir cambio', 'mete quinta y aparece donde la jugada ya parecia perdida', 'te corre todo el partido sin descanso'],
        weakness: ['si el partido se hace largo, empieza a mirar el banco con carino', 'si lo hacen correr de lado a lado, se le prende la reserva', 'en un partido de ida y vuelta, no mantiene el ritmo de subir y bajar', 'no se cae fisicamente, pero tampoco te gana una carrera al bondi', 'por piernas casi nunca queda pagando', 'en ritmo va sobrado: al rival le conviene buscar otro camino'],
      },
      {
        field: 'defense_physical',
        label: 'Solidez',
        strength: ['en el choque todavia entra pidiendo permiso', 'si viene uno pesado, lo puede hacer retroceder un par de casilleros', 'aguanta la parada, sin ponerse el traje de sheriff', 'mete cuerpo y ya no regala la zona', 'va al roce como quien va al almacen: sin drama y con decision', 'es pared medianera: choca, rebota y te cobra alquiler'],
        weakness: ['en el mano a mano fuerte lo pueden mandar a comprar facturas', 'si el rival lo obliga al roce, puede pasarla incomodo', 'cuando se arma el bardo, le cuesta sacar pecho', 'no es drama, pero si lo cargan mucho puede perder alguna dividida', 'para moverlo hay que traer orden judicial', 'fisicamente responde como patron de estancia'],
      },
      {
        field: 'attack',
        label: 'Ataque',
        strength: ['arriba todavia entra con timbre, no con llave', 'llega a zona caliente, pero a veces se le nubla el GPS', 'participa y molesta, aunque no siempre huele sangre', 'ya pisa el area y obliga a que alguno lo siga', 'tiene olfato: le das media baldosa y te arma un lio', 'en el area es inspector de billeteras: si te descuidas, te cobra'],
        weakness: ['en los ultimos metros se le puede apagar la tele', 'puede fabricar la jugada y terminar eligiendo el boton equivocado', 'con el arco enfrente a veces se apura como si cerrara el chino', 'no siempre liquida, pero ya obliga a respetarlo', 'arriba cuesta dejarlo mudo', 'cerca del arco no perdona ni una deuda chica'],
      },
      {
        field: 'teamwork',
        label: 'Compromiso',
        strength: ['le cuesta entrar en el circuito colectivo', 'por momentos juega su partido aparte', 'acompaña, aunque todavia puede ofrecerse mas', 'se conecta bien y entiende cuando soltarla', 'juega para el equipo, levanta la cabeza y ordena a los de al lado', 'es el pegamento del equipo: habla, ayuda y mejora a todos'],
        weakness: ['si se desconecta, el equipo lo siente enseguida', 'puede quedar lejos de la jugada cuando toca ayudar', 'a veces acompana mas de lo que conduce', 'no preocupa, aunque puede participar mas en la sociedad', 'su compromiso rara vez deja dudas', 'hasta sin pelota juega para que el equipo respire'],
        strength: ['todavia juega medio en modo solista de karaoke', 'a veces acompana, a veces mira la obra desde la vereda', 'se suma al circuito, aunque puede pedirla un poquito mas', 'entiende la pared, la descarga y el favor al companero', 'juega con documento: ayuda, habla y no se borra', 'es delegado del equipo: ordena, cubre y encima te ceba el mate'],
        weakness: ['si se cuelga, el equipo queda pagando el peaje', 'cuando toca dar una mano, a veces llega tarde a la reunion', 'acompanar acompana, pero le falta mandar un poco mas', 'no desentona, pero a veces desaparece un rato del partido', 'en compromiso rara vez deja una silla vacia', 'hasta sin tocarla acomoda el quilombo'],
      },
      {
        field: 'regularity',
        label: 'Regularidad',
        strength: ['todavia es una moneda al aire: puede venir iluminado o venir con la luz cortada', 'tiene ratos buenos, aunque todavia mezcla una bien con una que hace mirar al cielo', 'suele sostener un nivel aceptable sin regalar demasiados pozos', 'mantiene una linea bastante confiable y no se cae por cualquier golpe del partido', 'rinde casi siempre cerca de su mejor version: no vende humo de un solo domingo', 'es relojito: lo pones y sabes que no te va a dejar tirado cuando el partido aprieta'],
        weakness: ['si arranca torcido, puede pasar medio partido intentando encontrarse', 'todavia tiene bajones que cambian la lectura de todo lo bueno que hizo', 'su piso no siempre acompana a su techo: por momentos parece otro jugador', 'no se cae seguido, pero cuando baja un cambio el equipo lo nota', 'rara vez baja de su nivel habitual, y eso lo vuelve muy confiable', 'su peor partido igual suele ser competitivo: no se borra ni en dia torcido'],
      },
      {
        field: 'goalkeeper_skill',
        label: 'Arquero',
        strength: ['en el arco necesita que la defensa no lo abandone como bondi de noche', 'saca alguna importante, pero todavia no da para estatua', 'cumple bajo los tres palos y evita papelones', 'achica bien y ya empieza a hacerse respetar', 'se agranda en el arco: tapa, grita y acomoda el boliche', 'es persiana metalica: baja y no entra nadie'],
        weakness: ['cada centro puede venir con musica de suspenso', 'si lo bombardean, puede empezar a mirar de reojo', 'necesita que la defensa no le tire la mochila entera', 'no es flojo, pero podria mandar mas en el area', 'bajo presion responde con cara de pocos amigos', 'en el arco casi no deja ni la propina'],
      },
    ];

    const datasetStatName = (field) => `playerScout${field.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
    const numberOr = (value, fallback = 3) => {
      const number = Number.parseFloat(String(value ?? ''));
      return Number.isFinite(number) ? number : fallback;
    };
    const starTier = (value) => Math.max(1, Math.min(6, Math.round(numberOr(value, 3))));
    const stableIndex = (seed, length) => {
      if (length <= 1) return 0;
      let hash = 0;
      String(seed).split('').forEach((char) => {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
        hash |= 0;
      });
      return Math.abs(hash) % length;
    };
    const statAliases = {
      technique: ['tecnica', 'el pie', 'la pelota en los pies', 'el trato con la redonda'],
      rhythm: ['ritmo', 'las piernas', 'la intensidad', 'el ida y vuelta'],
      defense_physical: ['solidez', 'el roce', 'la marca', 'la batalla fisica'],
      attack: ['ataque', 'el ultimo tramo', 'la zona caliente', 'el olor a gol'],
      teamwork: ['compromiso', 'el juego colectivo', 'la entrega', 'la sociedad'],
      regularity: ['regularidad', 'la constancia', 'el piso de rendimiento', 'la estabilidad'],
      goalkeeper_skill: ['el arco', 'los tres palos', 'la seguridad bajo palos', 'el buzo imaginario'],
    };
    const strengthTemplates = [
      (alias, phrase) => `Por el lado de ${alias}, ${phrase}.`,
      (alias, phrase) => `Si la charla va por ${alias}, ${phrase}.`,
      (alias, phrase) => `En el rubro ${alias}, ${phrase}.`,
      (alias, phrase, label) => label === 'Ataque'
        ? `Se destaca atacando: ${phrase}.`
        : (label === 'Tecnica' ? `Es peligroso cuando ataca: ${phrase}.` : `${label} le pone el cartel luminoso: ${phrase}.`),
      (alias, phrase) => `Cuando aparece ${alias}, ${phrase}.`,
    ];
    const weaknessTemplates = [
      (alias, phrase) => `Cuando toca mirar ${alias}, ${phrase}.`,
      (alias, phrase) => `La lupa, mala pero necesaria, cae en ${alias}: ${phrase}.`,
      (alias, phrase) => `Si el rival es vivo, lo va a medir en ${alias}: ${phrase}.`,
      (alias, phrase) => `El semaforo amarillo aparece en ${alias}: ${phrase}.`,
      (alias, phrase) => `El costado para apretarlo viene por ${alias}: ${phrase}.`,
    ];
    const regularClosingLines = [
      'Le pone toda la onda para jugar; si lo presionan muy fuerte, puede empezar a mandarse cagadas o a cobrar boludeces.',
      'Cuando juega comodo suma un monton; cuando lo aprietan donde menos quiere, necesita resolver simple.',
      'Si el partido lo lleva a su baldosa, crece; si lo empujan a decidir rapido, puede mostrar la costura.',
      'En su mejor version te acomoda la tarde; en su peor rato, el rival tiene que insistir justo donde mas le pica.',
    ];
    const eliteClosingLines = [
      'Si tiene ganas te puede ganar solo el partido; si lo pones nervioso, capaz lo podes sacar del partido.',
    ];
    const statPhrase = (stat, type, playerName) => {
      const tier = starTier(stat.value);
      const phrase = stat[type][tier - 1];
      if (type === 'weakness' && stat.field === 'teamwork' && tier === 1) {
        return 'Cuando se toca hablar de companerismo, a veces prefiere un lujo que jugar rapido.';
      }
      if (type === 'weakness' && stat.field === 'teamwork' && tier === 2) {
        return 'Si hay algo negativo por decir es el trabajo en equipo: si tiene que tocar rapido, o bancarse el ida y vuelta, se cansa rapido.';
      }
      const aliasPool = statAliases[stat.field] || [stat.label.toLowerCase()];
      const templates = type === 'strength' ? strengthTemplates : weaknessTemplates;
      const seed = `${playerName}|${stat.field}|${type}|${tier}`;
      const alias = aliasPool[stableIndex(`${seed}|alias`, aliasPool.length)];
      const template = templates[stableIndex(`${seed}|template`, templates.length)];
      return template(alias, phrase, stat.label);
    };
    const regularityInsightLine = (player) => {
      const regularity = numberOr(player.regularity, 3.5);
      const overall = numberOr(player.skill, 3);
      const tier = starTier(regularity);
      const pools = {
        1: [
          'Regularidad es su alarma roja: puede tener un partido buenisimo y al siguiente jugar como si hubiera llegado tarde a su propio cuerpo.',
          'El problema no es solo cuanto sabe jugar, sino que no siempre aparece la misma version; cuando se cae, se nota demasiado.',
        ],
        2: [
          'Tiene momentos donde suma, pero todavia alterna bastante: si entra mal al partido, le cuesta acomodarse.',
          'Su regularidad todavia pide paciencia; puede regalar un rato bueno y despues desaparecer justo cuando el equipo lo necesita.',
        ],
        3: [
          'En regularidad esta en zona media: normalmente cumple, aunque todavia puede tener algun pozo que le baja la nota.',
          'No es una loteria total, pero tampoco un cheque certificado; suele rendir, con algun altibajo dando vueltas.',
        ],
        4: [
          'Tiene buen piso de rendimiento: capaz no siempre rompe el partido, pero casi nunca te lo tira por la ventana.',
          'Regularidad le suma bastante: suele estar cerca de lo que promete la planilla y eso ordena al equipo.',
        ],
        5: [
          'Es confiable: no depende tanto de estar inspirado, casi siempre entrega una version fuerte y parecida.',
          'Su constancia pesa: puede no ser el mas vistoso cada fecha, pero rara vez baja de competitivo.',
        ],
        6: [
          'Es una garantia de rendimiento: incluso en dia flojo sostiene el piso y no obliga al equipo a taparle agujeros.',
          'Regularidad altisima: no vive de chispazos, vive de repetir buenas decisiones hasta que el rival se cansa.',
        ],
      };
      const pool = pools[tier] || pools[3];
      const base = pool[stableIndex(`${player.name}|regularity-line|${tier}|${starTier(overall)}`, pool.length)];
      if (overall >= 4.5 && regularity <= 2.5) {
        return `${base} Tiene techo alto, pero esa irregularidad lo vuelve dificil de medir.`;
      }
      if (overall >= 4.5 && regularity >= 4.5) {
        return `${base} Cuando talento y constancia se juntan, ahi aparece el jugador que te cambia el sorteo.`;
      }
      return base;
    };
    const comboInsightLine = (player) => {
      const technique = numberOr(player.technique, 3);
      const rhythm = numberOr(player.rhythm, 3);
      const defense = numberOr(player.defense_physical, 3);
      const attack = numberOr(player.attack, 3);
      const teamwork = numberOr(player.teamwork, 3);
      const regularity = numberOr(player.regularity, 3.5);
      const goalkeeper = numberOr(player.goalkeeper_skill, 3);
      const isGoalkeeper = player.positions.includes('ARQ');
      const high = (value) => value >= 4.5;
      const low = (value) => value <= 2.5;
      const matches = [];

      if (numberOr(player.skill, 3) < 3) {
        matches.push('Es buen tipo y ayuda a completar la cancha; futbolisticamente viene con casco y chaleco, pero viene.');
        matches.push('Hace lo que puede: a veces suma por presencia, a veces por fe, pero no se esconde.');
        matches.push('Viene a jugar igual, sabiendo que a veces es mas lo que estorba en la cancha que lo que ordena.');
        matches.push('No sera el distinto, pero es de esos que aparecen cuando falta uno y eso tambien vale en el fulbito.');
        matches.push('Tiene mas voluntad que recursos, pero al menos no deja al grupo clavado buscando reemplazo.');
      }
      if (numberOr(player.skill, 3) > 5) {
        matches.push('Destaca al lado de todos los demas muertos: juega a otra velocidad mental y encima se nota.');
        matches.push('En este grupo hace una de las mayores diferencias: cuando aparece, el partido se inclina solo.');
        matches.push('Hay que agradecerle que quiera jugar con tantos perros: baja al barro y aun asi deja calidad.');
        matches.push('Esta un escalon arriba del promedio del potrero: si se enchufa, hay que repartirlo entre dos marcas.');
        matches.push('Cuando toca la pelota se nota que no vino a pasear: el resto mira y trata de no molestar.');
      }

      if (attack >= 4.5 && defense <= 2.5) {
        matches.push('No te marca a nadie, pero hace goles: es de esos que atras te hacen renegar y arriba te pagan la cuota.');
      }
      if (technique >= 4.5 && teamwork <= 2.5) {
        matches.push('Tiene magia en los pies, pero a veces es muy morfon: ve el pase y aun asi prueba el firulete.');
      }
      if (technique >= 4.5 && defense <= 2.5) {
        matches.push(defense <= 2
          ? 'No le gusta que lo marquen al hombre: si le respiran en la nuca, empieza la novela.'
          : 'Si lo marcas fuerte se le congela el pecho: con espacio juega lindo, con roce ya no canta tan afinado.');
      }
      if (high(attack) && high(technique) && low(defense)) {
        matches.push('No te pone la pierna fuerte ni aunque le pagues: arriba juega lindo, pero en el roce se hace el distraido.');
      }
      if (defense >= 4.5 && technique <= 2.5) {
        matches.push('No le pidas que te tire un caño ni que salga jugando: lo suyo es morder, trabar y devolver la pelota sin perfume.');
      }

      if (high(technique) && low(rhythm)) {
        matches.push('Tiene pie de salon, pero motor de domingo despues del asado: si le das tiempo te pinta la cara, si lo haces correr se complica.');
      }
      if (high(rhythm) && low(technique)) {
        matches.push('Corre como si llegara tarde al laburo, pero con la pelota a veces parece que la persigue mas de lo que la maneja.');
      }
      if (high(technique) && low(attack)) {
        matches.push('Juega lindo hasta la puerta del area; despues le falta tocar el timbre y entrar a cobrar.');
      }
      if (high(attack) && low(technique)) {
        matches.push('No le pidas poesia, pedile que empuje la pelota: capaz no acaricia la redonda, pero cerca del arco molesta siempre.');
      }
      if (high(rhythm) && low(defense)) {
        matches.push('Tiene piernas para perseguir hasta el bondi, pero en la marca a veces corre mucho y muerde poco.');
      }
      if (high(defense) && low(rhythm)) {
        matches.push('Cuando lo agarran parado es una pared, pero si lo sacan a pasear por la banda puede pedir remiseria.');
      }
      if (high(rhythm) && low(attack)) {
        matches.push('Va y viene como ascensor de hospital, aunque arriba muchas veces llega con las ideas en otra cancha.');
      }
      if (high(attack) && low(rhythm)) {
        matches.push('En el area tiene veneno, pero no le pidas que presione hasta la esquina porque se queda sin monedas.');
      }
      if (high(rhythm) && low(teamwork)) {
        matches.push('Corre por todos lados, pero a veces parece que juega con Waze propio y se olvida de los companeros.');
      }
      if (high(teamwork) && low(rhythm)) {
        matches.push('Tiene alma de equipo, habla y ordena, pero las piernas no siempre firman el contrato.');
      }
      if (high(defense) && low(attack)) {
        matches.push('Te apaga incendios atras, pero no le hace un gol ni al arcoiris.');
      }
      if (high(attack) && low(teamwork)) {
        matches.push('Arriba te mete goles, pero es medio morfon: si levanta la cabeza, el equipo le va a agradecer.');
      }
      if (high(teamwork) && low(attack)) {
        matches.push('Hace jugar a todos, pero cuando queda para definir parece que le pasa la pelota caliente al de al lado.');
      }
      if (high(defense) && low(teamwork)) {
        matches.push('Va fuerte y gana duelos, pero cuidado: puede defender su quintita y olvidarse de cerrar con el resto.');
      }
      if (high(teamwork) && low(defense)) {
        matches.push('Tiene voluntad de sobra, pero en el roce a veces le falta maldad de potrero.');
      }
      if (defense < 3 && teamwork < 3) {
        matches.push('Cuando lo aprietan en su zona floja, puede tirar un pelotazo a cualquier lado.');
      }
      if (high(regularity) && numberOr(player.skill, 3) >= 4) {
        matches.push('Lo bueno no es solo el techo: suele repetirlo, y eso en equipos parejos vale doble.');
      }
      if (low(regularity) && numberOr(player.skill, 3) >= 4) {
        matches.push('Tiene nivel para romperla, pero no siempre aparece la misma version: te puede ganar el partido o dejarte esperando.');
      }
      if (isGoalkeeper && high(goalkeeper) && low(defense)) {
        matches.push('Como arquero te salva las papas, pero si sale del arco a chocar queda mas expuesto que persiana rota.');
      }
      if (isGoalkeeper && high(goalkeeper) && low(teamwork)) {
        matches.push('Bajo los tres palos responde, pero si no habla con la defensa el area se le vuelve una feria.');
      }
      if (isGoalkeeper && high(defense) && low(goalkeeper)) {
        matches.push('Tiene presencia y cuerpo, pero bajo los tres palos todavia no te vende seguro contra todo riesgo.');
      }
      if (isGoalkeeper && high(teamwork) && low(goalkeeper)) {
        matches.push('Ordena y acompana, pero cuando le patean al arco necesita que la tribuna rece bajito.');
      }

      if (!matches.length) return '';
      return matches[stableIndex(`${player.name}|combo|${starTier(technique)}|${starTier(rhythm)}|${starTier(defense)}|${starTier(attack)}|${starTier(teamwork)}|${starTier(regularity)}|${starTier(goalkeeper)}`, matches.length)];
    };
    const radarShapeLine = (stats, playerName, isGoalkeeper) => {
      const values = stats.map((stat) => stat.value);
      const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const spread = max - min;
      const top = stats.slice().sort((a, b) => b.value - a.value).slice(0, 2).map((stat) => stat.field);
      const bottom = stats.slice().sort((a, b) => a.value - b.value).slice(0, 2).map((stat) => stat.field);
      const statValue = (field) => stats.find((stat) => stat.field === field)?.value || 0;
      const hasTop = (...fields) => fields.some((field) => top.includes(field) && statValue(field) >= 4);
      const hasBottom = (...fields) => fields.some((field) => bottom.includes(field) && statValue(field) <= 2.5);
      let pool;

      if (spread <= 0.75 && average >= 4.2) {
        pool = [
          'El radar sale redondito y alto: no tiene una esquina para esconderse, de esos que caen a la cancha y te acomodan el equipo.',
          'La figura parece dibujada con compas: parejo, confiable y sin un costado regalado para que el rival haga negocio.',
        ];
      } else if (spread <= 0.75) {
        pool = [
          'El radar es parejo: no te vende humo con una punta gigante, pero tampoco deja un pozo para caer de cabeza.',
          'La silueta sale de jugador cumplidor: no te prende fuego la planilla, pero tampoco te rompe el asado.',
        ];
      } else if (
        (statValue('attack') >= 4 && statValue('defense_physical') <= 2)
        || (statValue('defense_physical') >= 4 && statValue('attack') <= 2)
      ) {
        pool = [
          'Es de esos jugadores bien de puesto: si lo usas donde va, suma; fuera de su posicion sufre bastante.',
          'El radar lo marca clarito: en una punta ayuda mucho, pero si lo corres al otro trabajo se le complica.',
        ];
      } else if (spread >= 2.5) {
        pool = [
          'Hace bien su trabajo, pero a veces se manda alguna cagada.',
          'Tiene perfil de especialista: si lo llevas a su fuerte, suma; si lo sacas de ahi, baja bastante.',
        ];
      } else if (hasTop('attack', 'technique') && hasBottom('defense_physical', 'teamwork')) {
        pool = [
          'El dibujo se le va para adelante: pide pelota y arco, pero atras conviene ponerle un primo que lo cubra.',
          'La forma del radar grita jugador ofensivo: arriba puede salir en la foto, en la vuelta hay que prenderle el GPS.',
        ];
      } else if (statValue('defense_physical') >= 4 && statValue('teamwork') >= 4) {
        pool = [
          'Es un todoterreno, corre, mete, marca, ayuda, ataca, no le interesa jugar lindo, quiere ganar.',
          'La figura tira para el sacrificio: de esos que hacen el laburo sucio para que otro salga en la foto.',
        ];
      } else if (false && hasTop('defense_physical', 'teamwork') && hasBottom('attack', 'technique')) {
        pool = [
          'El radar se planta mas con casco que con moño: sostiene, ayuda y compite, aunque no siempre firma la jugada linda.',
          'La figura tira para el sacrificio: de esos que hacen el laburo sucio para que otro salga en la foto.',
        ];
      } else if (hasTop('rhythm') && hasBottom('technique', 'attack')) {
        pool = [
          'El radar muestra motor antes que seda: corre, llega y molesta, pero a veces la jugada le pide bajar un cambio.',
          'La silueta tiene piernas largas y pie de barrio: puede acelerar el partido, no siempre elegir el mejor final.',
        ];
      } else if (hasTop('teamwork') && spread <= 1.75) {
        pool = [
          'El radar tiene forma de jugador de equipo: no vive para la tapa, vive para que la rueda gire.',
          'La lectura global dice companero util: aparece donde falta una mano y no te desordena el tablero.',
        ];
      } else if (hasTop('teamwork') && spread <= 1.75) {
        pool = [
          'El radar tiene forma de jugador de equipo: no vive para la tapa, vive para que la rueda gire.',
          'La lectura global dice compañero util: aparece donde falta una mano y no desacomoda el tablero.',
        ];
      } else if (isGoalkeeper && hasTop('goalkeeper_skill')) {
        pool = [
          'El radar se agranda bajo los tres palos: si el partido pide arquero, ahi tiene con que ponerse la capa.',
          'La forma lo cuenta sola: su kiosco esta en el arco, donde puede transformar peligro en alivio.',
        ];
      } else {
        pool = [
          'La forma del radar deja un perfil mixto: tiene por donde sumar y tambien una arista para ajustar antes de que lo madruguen.',
          'Mirado de lejos, el radar no miente: hay una virtud clara en su juego, pero comete algunas fallas que el rival puede aprovechar.',
        ];
      }

      return pool[stableIndex(`${playerName}|shape|${top.join('-')}|${bottom.join('-')}|${Math.round(spread * 10)}`, pool.length)];
    };
    const colorCommentLine = (player, role) => {
      const technique = numberOr(player.technique, 3);
      const rhythm = numberOr(player.rhythm, 3);
      const defense = numberOr(player.defense_physical, 3);
      const attack = numberOr(player.attack, 3);
      const teamwork = numberOr(player.teamwork, 3);
      const regularity = numberOr(player.regularity, 3.5);
      const goalkeeper = numberOr(player.goalkeeper_skill, 3);
      const overall = numberOr(player.skill, 3);
      const pool = [];

      if (overall >= 4.5) {
        pool.push('Tiene chapa de titular en cualquier picado serio: no necesita vender humo, agarra la pelota y ya te das cuenta la clase de jugador que es.');
        pool.push('Cuando se enchufa, los demas parecen extras de la pelicula.');
      }
      if (overall <= 3) {
        pool.push('Es de esos que capaz no te gana el partido, pero te salva la convocatoria del grupo.');
        pool.push('No viene con botines magicos, viene con ganas; a veces en este futbol eso ya es medio contrato.');
      }
      if (technique >= 4 && attack >= 4) {
        pool.push('Tiene cositas de lirico de potrero: pisa, mira y si le dan un metro empieza el show.');
        pool.push('No te perdona una, y a veces te tira alguna magia de esas que te inventan un problema de la nada.');
      }
      if (defense >= 4 && rhythm >= 4) {
        pool.push('Perfil tractor: mete, corre y te sigue hasta la parada del colectivo.');
        pool.push('No negocia una dividida y encima tiene piernas para repetir; molesto como tos en reunion.');
      }
      if (teamwork >= 4.5) {
        pool.push('Tiene alma de capitan sin cinta: acomoda, habla y juega para que el equipo no sea una murga.');
        pool.push('No se casa con la pelota: si hay que tocar y moverse, toca y se mueve.');
      }
      if (regularity >= 4.5) {
        pool.push('No vive de flashes: lo normal es que juegue cerca de su mejor version.');
      }
      if (regularity <= 2.5 && overall >= 4) {
        pool.push('Tiene dias de figura y dias para esconder la planilla: conviene mirarlo de cerca cuando arranca irregular.');
      }
      if (attack >= 4.5) {
        pool.push('Tiene sangre de nueve vivo: capaz toca dos pelotas y una termina con todos sacando del medio.');
        pool.push('En la zona caliente no va de visita, va a cobrar alquiler.');
      }
      if (defense >= 4.5) {
        pool.push('Tiene oficio de marcador viejo: no siempre sale lindo, pero el rival termina mirando para otro lado.');
        pool.push('Es de los que te dejan un recuerdito en la primera dividida para avisar que estan presentes.');
      }
      if (rhythm >= 4.5) {
        pool.push('Tiene motor de remisero en fin de mes: no para nunca y llega a todos lados.');
        pool.push('Le sobra recorrido; si el partido pide piernas, levanta la mano primero.');
      }
      if (technique <= 2.5 && defense <= 2.5) {
        pool.push('Si la pelota viene dificil y encima hay roce, conviene prender una vela.');
      }
      if (attack <= 2.5 && technique <= 2.5) {
        pool.push('En ataque no asusta ni al arquero distraido, pero por lo menos ocupa un defensor.');
      }
      if (role === 'defensor' && technique >= 4) {
        pool.push('Defensor con salida limpia: raro en el barrio, casi articulo importado.');
      }
      if (role === 'delantero' && teamwork >= 4) {
        pool.push('Delantero que devuelve paredes: especie protegida, hay que cuidarlo.');
      }
      if (role === 'mediocampista' && defense >= 4 && teamwork >= 4) {
        pool.push('Cinco de overol: barre, ordena y no pide aplausos.');
      }
      if (role === 'arquero' && goalkeeper >= 4.5) {
        pool.push('Cuando se pone los guantes imaginarios, el arco parece achicarse para todos menos para el.');
      }

      if (!pool.length) {
        pool.push('Tiene perfil de fulbito puro: algo para aplaudir, algo para putear y bastante para comentar despues.');
        pool.push('No pasa desapercibido: siempre deja una jugada para discutir en el tercer tiempo.');
      }

      return pool[stableIndex(`${player.name}|color|${role}|${starTier(overall)}|${starTier(technique)}|${starTier(rhythm)}|${starTier(defense)}|${starTier(attack)}|${starTier(teamwork)}|${starTier(regularity)}|${starTier(goalkeeper)}`, pool.length)];
    };
    const scoutDataFromTrigger = (trigger) => {
      const row = trigger.closest('[data-player-edit-row]');
      if (row) {
        const positions = Array.from(row.querySelectorAll('input[name="positions[]"]:checked')).map((input) => input.value);
        const getValue = (field) => numberOr(row.querySelector(`[data-stat-rating-input][name="${field}"]`)?.value, field === 'regularity' ? 3.5 : 3);
        const player = {
          name: row.querySelector('input[name="name"]')?.value || row.querySelector('.player-readonly-name')?.textContent || 'Este jugador',
          positions,
          skill: numberOr(row.querySelector('[data-general-rating-value]')?.textContent, 3),
        };
        scoutStatRules.forEach((rule) => {
          player[rule.field] = getValue(rule.field);
        });
        return player;
      }

      const positions = String(trigger.dataset.playerScoutPositions || '').split('/').map((position) => position.trim()).filter(Boolean);
      const player = {
        name: trigger.dataset.playerScoutName || 'Este jugador',
        positions,
        skill: numberOr(trigger.dataset.playerScoutSkill, 3),
      };
      scoutStatRules.forEach((rule) => {
        player[rule.field] = numberOr(trigger.dataset[datasetStatName(rule.field)], 3);
      });
      return player;
    };
    const describeScoutPlayer = (player) => {
      const isGoalkeeper = player.positions.includes('ARQ');
      const visibleRules = scoutStatRules.filter((rule) => isGoalkeeper
        ? rule.field !== 'attack'
        : rule.field !== 'goalkeeper_skill');
      const stats = visibleRules.map((rule) => ({ ...rule, value: numberOr(player[rule.field], rule.field === 'regularity' ? 3.5 : 3) }));
      const best = stats.slice().sort((a, b) => b.value - a.value)[0];
      const weakest = stats.slice().sort((a, b) => a.value - b.value)[0];
      const role = isGoalkeeper
        ? 'arquero'
        : (player.positions.includes('DEL') ? 'delantero'
          : (player.positions.includes('DEF') ? 'defensor'
            : (player.positions.includes('MED') ? 'mediocampista' : 'comodin')));
      const virtueLine = statPhrase(best, 'strength', player.name);
      const flawLine = statPhrase(weakest, 'weakness', player.name);
      const comboLine = comboInsightLine(player);
      const shapeLine = radarShapeLine(stats, player.name, isGoalkeeper);
      const colorLine = colorCommentLine(player, role);
      const regularityLine = regularityInsightLine(player);
      const hasEliteStat = stats.some((stat) => stat.value > 5);
      const closingPool = hasEliteStat ? regularClosingLines.concat(eliteClosingLines) : regularClosingLines;
      const closingLine = closingPool[stableIndex(`${player.name}|${best.field}|${starTier(best.value)}|${weakest.field}|${starTier(weakest.value)}`, closingPool.length)];
      return {
        title: `${player.name}, ${role} de ${formatRating(numberOr(player.skill, 3))}/6`,
        body: [shapeLine, colorLine, virtueLine, regularityLine, closingLine, comboLine, flawLine].filter(Boolean).join(' '),
        tags: [
          role.toUpperCase(),
          `General ${formatRating(numberOr(player.skill, 3))}/6`,
          `Regularidad ${formatRating(numberOr(player.regularity, 3.5))}`,
          `${best.label} ${formatRating(best.value)}`,
          `${weakest.label} ${formatRating(weakest.value)}`,
        ],
      };
    };
    const openPlayerScoutPanel = (trigger) => {
      const panel = document.querySelector('[data-player-scout-panel]');
      if (!panel) return;
      const scout = describeScoutPlayer(scoutDataFromTrigger(trigger));
      panel.querySelector('[data-player-scout-title]').textContent = scout.title;
      panel.querySelector('[data-player-scout-body]').textContent = scout.body;
      panel.querySelector('[data-player-scout-tags]').innerHTML = scout.tags.map((tag) => `<span>${tag}</span>`).join('');
      panel.hidden = false;
    };
    const closePlayerScoutPanel = () => {
      const panel = document.querySelector('[data-player-scout-panel]');
      if (panel) panel.hidden = true;
    };

    const radarPoint = (centerX, centerY, radius, index, total) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index / total);
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    };

    const renderPlayerRadar = (scope) => {
      const card = scope.querySelector('[data-player-radar]');
      const canvas = scope.querySelector('[data-player-radar-canvas]');
      if (!card || !canvas) return;

      const getValue = (name) => Number(scope.querySelector(`[data-stat-rating-input][name="${name}"]`)?.value || (name === 'regularity' ? 3.5 : 3));
      const hasGoalkeeper = Boolean(scope.querySelector('input[name="positions[]"][value="ARQ"]:checked'));
      const fields = hasGoalkeeper ? statNames.map((field) => field === 'attack' ? 'goalkeeper_skill' : field) : statNames;
      const isCompact = card.classList.contains('player-radar-card-compact');
      const labels = isCompact ? radarShortLabels : radarLabels;
      const size = isCompact ? 180 : 240;
      const viewBoxHeight = isCompact ? size : 278;
      const centerX = size / 2;
      const centerY = isCompact ? size / 2 : 112;
      const maxRadius = isCompact ? 56 : 78;
      const labelRadius = isCompact ? 76 : 103;
      const scaleY = isCompact ? centerY + maxRadius + 31 : viewBoxHeight - 14;
      const levels = [1, 2, 3, 4, 5, 6];
      const polygon = fields.map((field, index) => {
        const value = Math.max(1, Math.min(6, getValue(field)));
        const point = radarPoint(centerX, centerY, maxRadius * (value / 6), index, fields.length);
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      }).join(' ');

      canvas.innerHTML = `
        <svg viewBox="0 0 ${size} ${viewBoxHeight}" role="img" aria-label="Diagrama de estrella de stats">
          <g class="radar-grid">
            ${levels.map((level) => {
              const radius = maxRadius * (level / 6);
              const points = fields.map((_, index) => {
                const point = radarPoint(centerX, centerY, radius, index, fields.length);
                return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
              }).join(' ');
              return `<polygon points="${points}"></polygon>`;
            }).join('')}
          </g>
          <g class="radar-axis">
            ${fields.map((field, index) => {
              const end = radarPoint(centerX, centerY, maxRadius, index, fields.length);
              const label = radarPoint(centerX, centerY, labelRadius, index, fields.length);
              const anchor = Math.abs(label.x - centerX) < 8 ? 'middle' : (label.x > centerX ? 'start' : 'end');
              return `
                <line x1="${centerX}" y1="${centerY}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}"></line>
                <text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="${anchor}">${labels[field]}</text>
              `;
            }).join('')}
          </g>
          <polygon class="radar-shape" points="${polygon}"></polygon>
          <g class="radar-points">
            ${fields.map((field, index) => {
              const value = Math.max(1, Math.min(6, getValue(field)));
              const point = radarPoint(centerX, centerY, maxRadius * (value / 6), index, fields.length);
              return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>${radarLabels[field]} ${value}/6</title></circle>`;
            }).join('')}
          </g>
          <text class="radar-scale" x="${centerX}" y="${scaleY}" text-anchor="middle">Escala 1 a 6 estrellas</text>
        </svg>
      `;
      card.hidden = false;
    };

    const updateGeneralRating = (scope) => {
      const general = scope.querySelector('[data-general-rating]');
      if (!general) {
        renderPlayerRadar(scope);
        return;
      }

      const getValue = (name) => Number(scope.querySelector(`[data-stat-rating-input][name="${name}"]`)?.value || (name === 'regularity' ? 3.5 : 3));
      const hasGoalkeeper = Boolean(scope.querySelector('input[name="positions[]"][value="ARQ"]:checked'));
      const raw = hasGoalkeeper
        ? (getValue('goalkeeper_skill') * 0.45)
          + (getValue('defense_physical') * 0.15)
          + (getValue('rhythm') * 0.10)
          + (getValue('technique') * 0.10)
          + (getValue('teamwork') * 0.20)
        : (getValue('technique') * 0.20)
          + (getValue('rhythm') * 0.20)
          + (getValue('defense_physical') * 0.20)
          + (getValue('attack') * 0.25)
          + (getValue('teamwork') * 0.15);
      const regularityFactor = 1 + ((getValue('regularity') - 3.5) / 50);
      const rounded = Math.max(1, Math.min(6, Math.round(raw * regularityFactor * 10) / 10));

      const value = general.querySelector('[data-general-rating-value]');
      const stars = general.querySelector('[data-general-rating-stars]');
      if (value) value.textContent = `${formatRating(rounded)}/6`;
      if (stars) stars.textContent = fullStars(rounded);
      renderPlayerRadar(scope);
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
      if (root.hasAttribute('data-stat-rating-readonly')) {
        return;
      }
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
      scope.querySelectorAll('[data-attack-stat-row]').forEach((row) => {
        row.hidden = hasGoalkeeper;
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

    document.querySelectorAll('[data-player-readonly-form]').forEach((form) => {
      form.addEventListener('submit', (event) => event.preventDefault());
    });

    document.addEventListener('click', (event) => {
      const scoutTrigger = event.target.closest('[data-player-scout-open]');
      if (scoutTrigger) {
        openPlayerScoutPanel(scoutTrigger);
        return;
      }
      if (event.target.closest('[data-player-scout-close]') || event.target.matches('[data-player-scout-panel]')) {
        closePlayerScoutPanel();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closePlayerScoutPanel();
      }
    });
  })();
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
