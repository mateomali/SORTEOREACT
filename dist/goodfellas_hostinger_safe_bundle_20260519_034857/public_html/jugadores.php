<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/player_profile_visual.php';

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
$currentPlayerId = current_player_id();

function player_row_search_text(array $player): string
{
    return strtolower(trim((string) $player['name'] . ' ' . $player['positions'] . ' ' . number_format(player_overall_rating($player), 1) . ' ' . implode(' ', array_map(static fn(string $field): string => number_format(player_effective_stat($player, $field), 1), player_stat_fields())) . ' ' . ((int) $player['active'] === 1 ? 'activo si' : 'inactivo no')));
}

function player_rating_stars(float $rating): string
{
    $filled = (int) round(max(1, min(6, $rating)));
    return str_repeat('★', $filled) . str_repeat('☆', max(0, 6 - $filled));
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
        'player-scout-mentality' => number_format(player_effective_stat($player, 'mentality'), 1, '.', ''),
        'player-scout-regularity' => number_format(player_effective_stat($player, 'regularity'), 1, '.', ''),
        'player-scout-goalkeeper-skill' => number_format(player_effective_stat($player, 'goalkeeper_skill'), 1, '.', ''),
    ];

    $html = '';
    foreach ($attrs as $name => $value) {
        $html .= ' data-' . $name . '="' . h($value) . '"';
    }
    return $html;
}

function player_sort_data_attrs(array $player): string
{
    $stats = array_map(
        static fn(string $field): float => player_effective_stat($player, $field),
        player_stat_fields()
    );
    $statsAverage = count($stats) > 0 ? array_sum($stats) / count($stats) : 0.0;
    $attrs = [
        'sort-name' => strtolower((string) ($player['name'] ?? '')),
        'sort-active' => (string) ((int) ($player['active'] ?? 0)),
        'sort-positions' => (string) ($player['positions'] ?? ''),
        'sort-general' => number_format(player_overall_rating($player), 3, '.', ''),
        'sort-stats' => number_format($statsAverage, 3, '.', ''),
    ];
    $html = '';
    foreach ($attrs as $name => $value) {
        $html .= ' data-' . $name . '="' . h($value) . '"';
    }
    return $html;
}

function normalize_player_name(string $name): string
{
    $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');
    if (function_exists('mb_strtoupper')) {
        return mb_strtoupper($name, 'UTF-8');
    }
    return strtoupper($name);
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
        $name = normalize_player_name((string) ($_POST['name'] ?? ''));
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
        $positionCount = count(parse_positions_csv($positionsCsv));
        if ($positionCount < 1 || $positionCount > 2) {
            if ($ajax) {
                http_response_code(422);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['ok' => false, 'message' => 'Elige una posicion primaria y una secundaria opcional.']);
                exit;
            }
            flash('error', 'Elige una posicion primaria y una secundaria opcional.');
            redirect($id > 0 ? $playersReturnUrl : 'jugadores.php');
        }

        $technique = normalize_player_stat($_POST['technique'] ?? null);
        $rhythm = normalize_player_stat($_POST['rhythm'] ?? null);
        $defensePhysical = normalize_player_stat($_POST['defense_physical'] ?? null);
        $attack = normalize_player_stat($_POST['attack'] ?? null);
        $teamwork = normalize_player_stat($_POST['teamwork'] ?? null);
        $mentality = normalize_player_stat($_POST['mentality'] ?? null);
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
            'mentality' => $mentality,
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
                     attack = :attack, teamwork = :teamwork, mentality = :mentality, regularity = :regularity, goalkeeper_skill = :goalkeeper_skill,
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
                'mentality' => $mentality,
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
                    'mentality' => $mentality,
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
                   (name, positions, pace, skill, technique, rhythm, defense_physical, attack, teamwork, mentality, regularity, goalkeeper_skill, active)
                 VALUES
                   (:name, :positions, :pace, :skill, :technique, :rhythm, :defense_physical, :attack, :teamwork, :mentality, :regularity, :goalkeeper_skill, :active)'
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
                'mentality' => $mentality,
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
    'mentality' => 3.0,
    'regularity' => 3.5,
    'goalkeeper_skill' => 3.0,
    'active' => 1,
];

$statLabels = [
    'technique' => 'Tecnica',
    'rhythm' => 'Ritmo',
    'defense_physical' => 'Solidez',
    'attack' => 'Ataque',
    'teamwork' => 'Juego en equipo',
    'mentality' => 'Mentalidad',
    'regularity' => 'Regularidad',
    'goalkeeper_skill' => 'Habilidad de arquero',
];
$statHelp = [
    'technique' => 'Control, pase, gambeta y calidad con la pelota.',
    'rhythm' => 'Velocidad, aceleracion, intensidad y capacidad de ir y volver.',
    'defense_physical' => 'Marca, quite, anticipo, presion, fuerza, choque y resistencia defensiva.',
    'attack' => 'Definicion, llegada al arco, desmarque y peligro ofensivo.',
    'teamwork' => 'Juego en equipo, solidaridad con los pases, ubicacion colectiva, toma de decisiones compartida y generosidad para no jugar solo para uno.',
    'mentality' => 'Concentracion, caracter, temple competitivo, estabilidad emocional y capacidad de no irse del partido.',
    'regularity' => 'Estabilidad para rendir cerca de su nivel habitual, sin alternar tanto entre partidazos y partidos flojos.',
    'goalkeeper_skill' => 'Atajada, reflejos, achique, posicionamiento, juego aereo y seguridad bajo los tres palos.',
];
$ratingHelp = [
    '1 punto' => 'Muy bajo.',
    '2 puntos' => 'Bajo.',
    '3 puntos' => 'Aceptable.',
    '4 puntos' => 'Bueno.',
    '5 puntos' => 'Muy bueno.',
    '6 puntos' => 'Excelente.',
];
$fieldWeightHelp = [
    'Defensor' => 'Solidez 28%, Ritmo 20%, Tecnica 18%, Juego en equipo 13%, Mentalidad 13%, Ataque 8%.',
    'Lateral' => 'Ritmo 24%, Solidez 22%, Tecnica 17%, Juego en equipo 15%, Ataque 12%, Mentalidad 10%.',
    'Mediocampista' => 'Tecnica 24%, Ritmo 23%, Juego en equipo 19%, Mentalidad 13%, Solidez 12%, Ataque 9%.',
    'Delantero' => 'Ataque 31%, Ritmo 20%, Tecnica 17%, Juego en equipo 14%, Mentalidad 10%, Solidez 8%.',
    'Arquero' => 'Habilidad de arquero 42%, Solidez 14%, Juego en equipo 14%, Ritmo 10%, Tecnica 10%, Mentalidad 10%.',
    'Regularidad +/-5%' => 'Ajusta la valoracion final segun constancia: 6 suma 5%, 1 resta 5%, 3/4 quedan casi neutros.',
];

function stat_rating_control(string $name, float $value, ?string $formId = null, bool $compact = false, bool $readonly = false): string
{
    $rating = (int) max(1, min(6, round($value)));
    $formAttr = $formId !== null ? ' form="' . h($formId) . '"' : '';
    $classes = 'stat-rating' . ($compact ? ' stat-rating-compact' : '') . ($readonly ? ' stat-rating-readonly' : '');
    $readonlyAttr = $readonly ? ' data-stat-rating-readonly' : '';
    $barPercent = max(0, min(100, (int) round(($rating / 6) * 100)));
    $tone = $rating <= 2 ? 'low' : ($rating <= 3 ? 'medium' : ($rating <= 4 ? 'good' : 'elite'));
    $html = '<div class="' . $classes . '" data-stat-rating data-stat-rating-tone="' . h($tone) . '"' . $readonlyAttr . '>';
    $html .= '<input type="hidden" name="' . h($name) . '" value="' . $rating . '"' . $formAttr . ' data-stat-rating-input>';
    $starsClass = 'stat-rating-stars inline-flex shrink-0 items-center gap-0.5 leading-none' . ($compact ? ' col-start-1 row-start-1 min-w-0' : '');
    $html .= '<div class="' . $starsClass . '" role="radiogroup" aria-label="' . h($name) . '">';
    for ($i = 1; $i <= 6; $i++) {
        $activeClass = $i <= $rating ? ' is-active text-[#f5b625]' : ' text-[#c6d3ce]';
        $starClasses = 'stat-rating-star inline-flex h-6 w-4 items-center justify-center rounded-none border-0 bg-transparent p-0 text-lg leading-none shadow-none transition-colors' . $activeClass;
        if ($readonly) {
            $html .= '<span class="' . $starClasses . '" aria-hidden="true">★</span>';
            continue;
        }
        $html .= '<button class="' . $starClasses . ' cursor-pointer focus:outline-none focus:ring-2 focus:ring-lime-200/70" type="button" data-stat-value="' . $i . '" role="radio" aria-checked="' . ($i === $rating ? 'true' : 'false') . '" aria-label="' . $i . ' de 6">★</button>';
    }
    $html .= '</div>';
    $html .= '<div class="stat-rating-bar-shell relative col-span-full row-start-2 grid min-h-3 min-w-0 flex-1 items-center">';
    $html .= '<div class="stat-rating-bar h-2.5 w-full overflow-hidden rounded-full bg-emerald-100" aria-hidden="true"><span class="block h-full rounded-full transition-[width,background-color]" data-stat-rating-bar style="width: ' . $barPercent . '%"></span></div>';
    if (!$readonly) {
        $html .= '<input class="stat-rating-range" type="range" min="1" max="6" step="1" value="' . $rating . '" aria-label="' . h($name) . '" data-stat-rating-range>';
    }
    $html .= '</div>';
    $html .= '<span class="stat-rating-value" data-stat-rating-value>' . $rating . '/6</span>';
    $html .= '</div>';
    return $html;
}

function player_stat_info_button(string $field, array $statLabels, array $statHelp): string
{
    $label = (string) ($statLabels[$field] ?? $field);
    $description = (string) ($statHelp[$field] ?? '');
    return '<span class="player-stat-info-trigger">' . h($label) . '</span>';
}

function player_stat_info_attrs(string $field, array $statLabels, array $statHelp): string
{
    $label = (string) ($statLabels[$field] ?? $field);
    $description = (string) ($statHelp[$field] ?? '');
    return ' data-player-stat-info="' . h($field) . '" data-player-stat-label="' . h($label) . '" data-player-stat-description="' . h($description) . '" aria-expanded="false"';
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
    $html .= '<section class="player-stat-help-wide"><h4>Valoracion general por posicion</h4>';
    foreach ($fieldWeightHelp as $label => $help) {
        $html .= '<p><strong>' . h((string) $label) . ':</strong> ' . h((string) $help) . '</p>';
    }
    $html .= '</section>';
    $html .= '</div>';
    $html .= '</details>';
    return $html;
}

function player_scout_panel(): string
{
    return '<article class="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm shadow-emerald-950/5" data-player-info-scout data-player-info-scout-collapsed="1">'
        . '<div class="player-info-scout-head">'
        . '<span class="mb-1 block text-[0.62rem] font-black uppercase leading-none text-[#12362a]">Relato</span>'
        . '<button class="player-info-scout-toggle" type="button" data-player-info-scout-toggle aria-expanded="false" aria-label="Expandir relato">+</button>'
        . '</div>'
        . '<div class="player-info-scout-content" data-player-info-scout-content>'
        . '<h4 class="mb-2 text-sm font-black leading-tight text-[#07130f]" data-player-info-scout-title>Relato del jugador</h4>'
        . '<p class="m-0 text-sm font-semibold leading-relaxed text-slate-700" data-player-info-scout-body>-</p>'
        . '<div class="mt-3 flex flex-wrap gap-1.5" data-player-info-scout-tags></div>'
        . '</div>'
        . '</article>';
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

function player_position_selects(array $selectedPositions, ?string $formId = null, bool $disabled = false): string
{
    $labels = ['Primaria', 'Secundaria'];
    $positionLabels = player_position_labels();
    $formAttr = $formId !== null ? ' form="' . h($formId) . '"' : '';
    $disabledAttr = $disabled ? ' disabled' : '';
    $html = '<div class="player-position-selects" data-player-position-selects>';
    foreach ($labels as $index => $label) {
        $required = $index === 0 ? ' required' : '';
        $value = (string) ($selectedPositions[$index] ?? '');
        $html .= '<label class="player-position-select">';
        $html .= '<span>' . h($label) . '</span>';
        $html .= '<select name="positions[]"' . $formAttr . $required . $disabledAttr . '>';
        if ($index > 0) {
            $html .= '<option value="">Sin posicion</option>';
        }
        foreach (allowed_positions() as $pos) {
            $html .= '<option value="' . h($pos) . '"' . selected_attr($value === $pos) . '>' . h($positionLabels[$pos] ?? $pos) . '</option>';
        }
        $html .= '</select>';
        $html .= '</label>';
    }
    $html .= '</div>';
    return $html;
}

function player_position_simulation_control(array $player, array $selectedPositions): string
{
    $positionLabels = player_position_labels();
    $selected = (string) ($selectedPositions[0] ?? player_primary_position($player));
    if (!in_array($selected, allowed_positions(), true)) {
        $selected = 'MED';
    }
    $rating = player_position_rating($player, $selected);
    $html = '<div class="form-row player-position-simulation" data-position-simulation>';
    $html .= '<label>Simular posicion</label>';
    $html .= '<div class="player-position-simulation-body">';
    $html .= '<select data-position-simulation-select aria-label="Simular posicion">';
    foreach (allowed_positions() as $pos) {
        $html .= '<option value="' . h($pos) . '"' . selected_attr($selected === $pos) . '>' . h($positionLabels[$pos] ?? $pos) . '</option>';
    }
    $html .= '</select>';
    $html .= '<div class="player-position-simulation-result">';
    $html .= '<span>Promedio general</span>';
    $html .= '<strong data-position-simulation-six>' . h(number_format($rating, 1)) . '/6</strong>';
    $html .= '<em data-position-simulation-stars>' . h(player_rating_stars($rating)) . '</em>';
    $html .= '</div>';
    $html .= '<div class="player-position-simulation-result">';
    $html .= '<span>Puntaje general</span>';
    $html .= '<strong data-position-simulation-card>' . h((string) shared_profile_player_fifa_overall($rating)) . '</strong>';
    $html .= '</div>';
    $html .= '</div>';
    $html .= '</div>';
    return $html;
}

$players = repo_all_players(!$isAdmin || !$showInactive);
$title = 'Jugadores | ' . APP_NAME;
$activePage = 'jugadores.php';
$disableContrastOverrides = true;
$bodyClass = $isAdmin ? 'page-jugadores page-jugadores-admin' : 'page-jugadores';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head players-page-head">
  <div>
    <h1>Jugadores</h1>
    <p class="small-muted"><?= $isAdmin ? 'Alta, edicion y administracion general de la plantilla.' : 'Consulta de plantilla, posiciones y stats actuales.' ?></p>
  </div>
  <?php if ($isAdmin): ?>
    <div class="btn-row">
      <a class="btn btn-muted" href="<?= $showInactive ? 'jugadores.php' : 'jugadores.php?show_inactive=1' ?>">
        <?= $showInactive ? 'Ver solo activos' : 'Mostrar inactivos' ?>
      </a>
      <a class="btn btn-muted" href="migrar_csv.php">Migrar desde CSV</a>
    </div>
  <?php endif; ?>
</section>

<div class="players-mobile-help">
  <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>
</div>

<?php if ($isAdmin): ?>
  <div
    data-react-root
    data-react-island="player_create"
    data-show-inactive="<?= $showInactive ? '1' : '0' ?>"
    data-labels="<?= h(json_encode($statLabels, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
    data-help="<?= h(json_encode($statHelp, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
    data-rating-help="<?= h(json_encode($ratingHelp, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
    data-weight-help="<?= h(json_encode($fieldWeightHelp, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
  ></div>
<?php endif; ?>

<section class="card players-list-card">
  <div class="section-toolbar">
    <div>
      <h3>Listado de jugadores</h3>
      <p class="small-muted"><?= ($isAdmin && $showInactive) ? 'Mostrando activos e inactivos.' : 'Mostrando solo jugadores activos.' ?></p>
    </div>
    <div
      data-react-root
      data-react-island="player_list_controls"
      data-total="<?= h((string) count($players)) ?>"
      data-can-filter-active="<?= $isAdmin ? '1' : '0' ?>"
    ></div>
  </div>
  <div class="players-desktop-help">
    <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>
  </div>
  <p class="small-muted player-list-empty" data-player-list-empty hidden>No hay jugadores que coincidan con la busqueda.</p>
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
            $playerId = (int) $player['id'];
            $isCurrentPlayerRow = $currentPlayerId > 0 && $playerId === $currentPlayerId;
          ?>
          <article id="player-<?= $playerId ?>" class="mobile-player-list-item <?= $isCurrentPlayerRow ? 'is-current-player-row' : '' ?>" data-player-table-row data-player-id="<?= $playerId ?>" data-search="<?= h($rowSearch) ?>"<?= player_sort_data_attrs($player) ?>>
            <span>
              <strong><?= h((string) $player['name']) ?></strong>
              <small>
                <?= h(number_format(player_overall_rating($player), 1)) ?>
                <span class="mobile-player-list-stars" aria-label="<?= h(player_rating_stars(player_overall_rating($player))) ?>"><?= h(player_rating_stars(player_overall_rating($player))) ?></span>
              </small>
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
                <button class="btn btn-muted player-icon-button icon-pencil" type="button" data-player-edit-open="<?= (int) $player['id'] ?>" aria-label="Editar <?= h((string) $player['name']) ?>" title="Editar"></button>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= (int) $player['id'] ?>">
                  <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
                  <input type="hidden" name="return_anchor" value="player-<?= (int) $player['id'] ?>">
                  <button class="btn btn-danger player-icon-button player-delete-icon" data-confirm="Eliminar jugador?" type="submit" aria-label="Eliminar <?= h((string) $player['name']) ?>" title="Eliminar"></button>
                </form>
              <?php else: ?>
                <span class="mobile-player-list-score-card" aria-label="Puntaje <?= h((string) shared_profile_player_fifa_overall(player_overall_rating($player))) ?>">
                  <strong><?= h((string) shared_profile_player_fifa_overall(player_overall_rating($player))) ?></strong>
                  <small><?= h((string) $player['positions']) ?></small>
                </span>
                <button class="mobile-player-info-button h-11 min-h-11 w-11" type="button" data-player-edit-open="<?= (int) $player['id'] ?>" aria-label="Ver stats de <?= h((string) $player['name']) ?>" title="Ver stats">
                  <svg class="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="3"></rect>
                    <circle cx="9" cy="12" r="2.2"></circle>
                    <path d="M14 10h4"></path>
                    <path d="M14 14h3"></path>
                    <path d="M7 16.5c.8-1 3.2-1 4 0"></path>
                  </svg>
                </button>
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
          <th><button class="player-sort-head" type="button" data-player-sort="name" aria-label="Ordenar por nombre">Nombre <span aria-hidden="true"></span></button></th>
          <th><button class="player-sort-head" type="button" data-player-sort="positions" aria-label="Ordenar por posiciones">Posiciones <span aria-hidden="true"></span></button></th>
          <th><button class="player-sort-head" type="button" data-player-sort="general" aria-label="Ordenar por promedio general">General <span aria-hidden="true"></span></button></th>
          <th><button class="player-sort-head" type="button" data-player-sort="stats" aria-label="Ordenar por promedio de stats">Stats <span aria-hidden="true"></span></button></th>
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
            $isCurrentPlayerRow = $currentPlayerId > 0 && $playerId === $currentPlayerId;
            $rowFormId = 'player-row-' . $playerId;
            $rowPositions = parse_positions_csv((string) $player['positions']);
            $rowSearch = player_row_search_text($player);
          ?>
          <tr class="<?= $isCurrentPlayerRow ? 'is-current-player-row' : '' ?>" data-player-table-row data-player-edit-row data-player-id="<?= $playerId ?>" data-search="<?= h($rowSearch) ?>"<?= player_sort_data_attrs($player) ?>>
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
            </td>
            <td>
              <?= player_position_selects($rowPositions, $isAdmin ? $rowFormId : null, !$isAdmin) ?>
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
                  <div class="player-table-stat"<?= player_stat_info_attrs($field, $statLabels, $statHelp) ?> <?= $field === 'attack' ? 'data-attack-stat-row' : '' ?>>
                    <?= player_stat_info_button($field, $statLabels, $statHelp) ?>
                    <?= stat_rating_control($field, player_effective_stat($player, $field), $isAdmin ? $rowFormId : null, true, !$isAdmin) ?>
                  </div>
                <?php endforeach; ?>
                <div class="player-table-stat"<?= player_stat_info_attrs('goalkeeper_skill', $statLabels, $statHelp) ?> data-goalkeeper-stat-row>
                  <?= player_stat_info_button('goalkeeper_skill', $statLabels, $statHelp) ?>
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

<?php foreach ($players as $player): ?>
  <?php
    $playerId = (int) $player['id'];
    $rowPositions = parse_positions_csv((string) $player['positions']);
  ?>
  <dialog class="player-edit-dialog <?= $isAdmin ? '' : 'player-info-dialog' ?>" data-player-edit-dialog="<?= $playerId ?>">
    <form method="post" class="player-edit-panel <?= $isAdmin ? 'player-admin-edit-panel' : 'player-info-panel' ?>" <?= $isAdmin ? player_scout_data_attrs($player) : 'data-player-readonly-form ' . player_scout_data_attrs($player) ?>>
      <div class="player-edit-head">
        <div>
          <h3><?= $isAdmin ? 'Editar jugador' : 'Ficha de jugador' ?></h3>
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

      <?php if ($isAdmin): ?>
        <div class="form-grid player-edit-top-grid">
          <div class="form-row">
            <label>Nombre</label>
            <input type="text" name="name" required value="<?= h((string) $player['name']) ?>">
          </div>
          <article class="desktop-player-card-overall player-edit-general-card">
            <div class="mobile-player-card-rating">
              <strong data-general-card-value><?= h((string) shared_profile_player_fifa_overall(player_overall_rating($player))) ?></strong>
              <span>GEN</span>
            </div>
            <div class="mobile-player-card-meta">
              <span>Puntaje general</span>
              <strong data-general-card-position><?= h(implode(' / ', $rowPositions)) ?></strong>
            </div>
          </article>
          <div class="form-row">
            <label>General</label>
            <div class="player-general-rating" data-general-rating>
              <strong data-general-rating-value><?= h(number_format(player_overall_rating($player), 1)) ?>/6</strong>
              <span data-general-rating-stars></span>
            </div>
          </div>
          <?= player_position_simulation_control($player, $rowPositions) ?>
          <div class="form-row">
            <label>Estado</label>
            <label class="chip">
              <input type="checkbox" name="active" value="1" <?= checked_attr((int) $player['active'] === 1) ?>>
              Jugador activo
            </label>
          </div>
        </div>

        <div class="form-row player-edit-positions-row">
          <label>Posiciones</label>
          <?= player_position_selects($rowPositions, null, false) ?>
        </div>
      <?php else: ?>
        <section class="player-info-overview" aria-label="Ficha compacta de <?= h((string) $player['name']) ?>">
          <article class="player-info-main-card">
            <span>Jugador</span>
            <strong><?= h((string) $player['name']) ?></strong>
            <div class="player-info-main-rating player-general-rating" data-general-rating>
              <span data-general-rating-stars><?= h(player_rating_stars(player_overall_rating($player))) ?></span>
              <strong data-general-rating-value><?= h(number_format(player_overall_rating($player), 1)) ?>/6</strong>
            </div>
            <div class="player-info-position-chips">
              <?php foreach ($rowPositions as $position): ?>
                <span><?= h($position) ?></span>
              <?php endforeach; ?>
            </div>
          </article>
          <article class="desktop-player-card-overall player-info-general-card">
            <div class="mobile-player-card-rating">
              <strong data-general-card-value><?= h((string) shared_profile_player_fifa_overall(player_overall_rating($player))) ?></strong>
            </div>
            <div class="mobile-player-card-meta">
              <span>Puntaje general</span>
              <strong data-general-card-position><?= h(implode(' / ', $rowPositions)) ?></strong>
            </div>
          </article>
          <?= player_position_simulation_control($player, $rowPositions) ?>
        </section>
        <?= player_scout_panel() ?>
      <?php endif; ?>

      <div class="form-grid player-edit-stats-grid">
        <?php foreach (player_field_stat_fields() as $field): ?>
          <div class="form-row stat-form-row"<?= player_stat_info_attrs($field, $statLabels, $statHelp) ?> <?= $field === 'attack' ? 'data-attack-stat-row' : '' ?>>
            <?= player_stat_info_button($field, $statLabels, $statHelp) ?>
            <?= stat_rating_control($field, player_effective_stat($player, $field), null, false, !$isAdmin) ?>
          </div>
        <?php endforeach; ?>
        <div class="form-row stat-form-row"<?= player_stat_info_attrs('goalkeeper_skill', $statLabels, $statHelp) ?> data-goalkeeper-stat-row>
          <?= player_stat_info_button('goalkeeper_skill', $statLabels, $statHelp) ?>
          <?= stat_rating_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill'), null, false, !$isAdmin) ?>
        </div>
      </div>

      <?= player_stats_radar_panel() ?>

      <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>

      <?php if ($isAdmin): ?>
        <?= player_scout_panel() ?>
      <?php endif; ?>

      <div class="btn-row player-edit-actions">
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

<div class="player-radar-floating-panel" data-player-radar-panel hidden>
  <section class="player-radar-floating-card" role="dialog" aria-modal="true" aria-labelledby="playerRadarPanelTitle">
    <div class="player-radar-floating-head">
      <div>
        <span>Radar ampliado</span>
        <h3 id="playerRadarPanelTitle" data-player-radar-title>Jugador</h3>
      </div>
      <button class="btn btn-muted player-icon-button" type="button" data-player-radar-close aria-label="Cerrar radar">X</button>
    </div>
    <div class="player-radar-large-canvas" data-player-radar-large-canvas></div>
    <div class="player-radar-floating-stats" data-player-radar-stats></div>
  </section>
</div>

<span hidden data-player-ajax-token="<?= $isAdmin ? h(player_ajax_token()) : '' ?>"></span>
<script src="assets/jugadores.js"></script>

<?php require __DIR__ . '/includes/footer.php'; ?>
