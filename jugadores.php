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
    '1 estrella' => 'Muy bajo.',
    '2 estrellas' => 'Bajo.',
    '3 estrellas' => 'Aceptable.',
    '4 estrellas' => 'Bueno.',
    '5 estrellas' => 'Muy bueno.',
    '6 estrellas' => 'Excelente.',
];
$fieldWeightHelp = [
    'Ataque 24%' => 'Premia al jugador que genera o define.',
    'Tecnica 18%' => 'Mantiene valor para el que juega bien.',
    'Ritmo 18%' => 'En futbol amateur pesa mucho: correr y volver cambia partidos.',
    'Solidez 18%' => 'Evita que solo cuente atacar.',
    'Juego en equipo 12%' => 'Mide generosidad y decisiones colectivas sin mezclarlo con caracter.',
    'Mentalidad 10%' => 'Suma foco, temple y capacidad de sostenerse en partido.',
    'Regularidad +/-5%' => 'Ajusta el promedio final: 6 suma 5%, 1 resta 5%, 3/4 quedan casi neutros.',
];

function stat_rating_control(string $name, float $value, ?string $formId = null, bool $compact = false, bool $readonly = false): string
{
    $rating = (int) max(1, min(6, round($value)));
    $formAttr = $formId !== null ? ' form="' . h($formId) . '"' : '';
    $classes = 'stat-rating flex min-w-0 items-center justify-between rounded-xl border border-lime-200/45 bg-emerald-950/70';
    $classes .= $compact ? ' stat-rating-compact gap-1 border-0 bg-transparent p-0' : ' gap-3 px-3 py-2';
    $classes .= $readonly ? ' stat-rating-readonly' : '';
    $readonlyAttr = $readonly ? ' data-stat-rating-readonly' : '';
    $disabledAttr = $readonly ? ' disabled' : '';
    $html = '<div class="' . $classes . '" data-stat-rating' . $readonlyAttr . '>';
    $html .= '<input type="hidden" name="' . h($name) . '" value="' . $rating . '"' . $formAttr . ' data-stat-rating-input>';
    $html .= '<div class="stat-rating-stars inline-flex min-w-0 items-center ' . ($compact ? 'gap-0' : 'gap-0.5') . '" role="radiogroup" aria-label="' . h($name) . '">';
    for ($i = 1; $i <= 6; $i++) {
        $active = $i <= $rating ? ' is-active' : '';
        $checked = $i === $rating ? 'true' : 'false';
        $starClass = 'stat-star inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent p-0 leading-none text-emerald-200/35 transition hover:bg-lime-100/10 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-lime-200/60';
        $starClass .= $compact ? ' h-6 w-4 text-sm' : ' h-8 w-8 text-xl';
        $starClass .= $readonly ? ' cursor-default' : '';
        $starClass .= $active ? ' is-active text-amber-300' : ($readonly ? ' opacity-80' : '');
        $html .= '<button type="button" class="' . $starClass . '" data-stat-value="' . $i . '" role="radio" aria-checked="' . $checked . '" aria-label="' . $i . ' de 6"' . $disabledAttr . '>&#9733;</button>';
    }
    $html .= '</div>';
    $html .= '<span class="stat-rating-value shrink-0 rounded-full bg-lime-100 font-extrabold text-emerald-950 shadow-sm ' . ($compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs') . '" data-stat-rating-value>' . $rating . '/6</span>';
    $html .= '</div>';
    return $html;
}
function player_stats_help_panel(array $statLabels, array $statHelp, array $ratingHelp, array $fieldWeightHelp): string
{
    $html = '<details class="player-stat-help mt-2 rounded-xl border border-lime-200/55 bg-emerald-950 text-lime-50 shadow-md shadow-emerald-950/15" data-player-stat-help>';
    $html .= '<summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-extrabold text-lime-50">Como funciona?<span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-100 text-base font-extrabold leading-none text-emerald-950 shadow-sm" aria-hidden="true">?</span></summary>';
    $html .= '<div class="player-stat-help-body grid gap-3 border-t border-lime-200/30 bg-emerald-950/70 p-3 md:grid-cols-2">';
    $html .= '<section><h4 class="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-200">Stats</h4>';
    foreach ($statHelp as $field => $help) {
        $html .= '<p class="m-0 text-xs leading-snug text-emerald-50/80" data-stat-help="' . h((string) $field) . '"><strong class="text-lime-100">' . h((string) $statLabels[$field]) . ':</strong> ' . h((string) $help) . '</p>';
    }
    $html .= '</section>';
    $html .= '<section><h4 class="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-200">Puntuacion</h4>';
    foreach ($ratingHelp as $label => $help) {
        $html .= '<p class="m-0 text-xs leading-snug text-emerald-50/80"><strong class="text-lime-100">' . h((string) $label) . ':</strong> ' . h((string) $help) . '</p>';
    }
    $html .= '</section>';
    $html .= '<section class="player-stat-help-wide md:col-span-2"><h4 class="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-200">Promedio general</h4>';
    foreach ($fieldWeightHelp as $label => $help) {
        $html .= '<p class="m-0 text-xs leading-snug text-emerald-50/80"><strong class="text-lime-100">' . h((string) $label) . ':</strong> ' . h((string) $help) . '</p>';
    }
    $html .= '</section>';
    $html .= '</div>';
    $html .= '</details>';
    return $html;
}
function player_stats_radar_panel(bool $compact = false): string
{
    $class = 'player-radar-card rounded-xl border border-lime-200/45 bg-emerald-950/80 p-3 text-lime-50 shadow-sm shadow-emerald-950/20';
    $class .= $compact ? ' player-radar-card-compact mt-2 p-2' : '';
    return '<aside class="' . $class . '" data-player-radar hidden>
      <div class="player-radar-head mb-2 flex items-center justify-between gap-2">
        <strong class="text-xs font-extrabold uppercase tracking-wide text-lime-100">Perfil del jugador</strong>
        <span class="text-[10px] font-bold text-emerald-100/70" data-player-radar-subtitle>Analisis de stats</span>
      </div>
      <div class="player-radar-canvas mx-auto flex w-full justify-center" data-player-radar-canvas></div>
    </aside>';
}
function player_action_icon(string $icon): string
{
    $base = '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
    $icons = [
        'story' => '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 8h8"/><path d="M8 12h6"/>',
        'edit' => '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        'save' => '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8A2 2 0 0 1 21 8.8V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
        'delete' => '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
        'close' => '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    ];
    return $base . ($icons[$icon] ?? '') . '</svg>';
}
function player_mobile_rating_summary(array $player): string
{
    $rating = player_overall_rating($player);
    $formatted = rtrim(rtrim(number_format($rating, 1, '.', ''), '0'), '.');
    $full = (int) floor($rating);
    $hasHalf = ($rating - $full) >= 0.25 && ($rating - $full) < 0.75;
    if (($rating - $full) >= 0.75) {
        $full += 1;
        $hasHalf = false;
    }
    $full = max(0, min(6, $full));
    $empty = max(0, 6 - $full - ($hasHalf ? 1 : 0));
    $stars = str_repeat('★', $full) . ($hasHalf ? '½' : '') . str_repeat('☆', $empty);

    return '<span class="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">' .
        '<span class="truncate">' . h((string) $player['positions']) . '</span>' .
        '<span class="inline-flex items-center gap-1 font-extrabold text-lime-50" aria-label="General ' . h($formatted) . ' de 6">' .
        '<span>' . h($formatted) . '</span>' .
        '<span class="text-[11px] leading-none text-amber-300" aria-hidden="true">' . h($stars) . '</span>' .
        '</span>' .
        '</span>';
}
function player_position_selects(array $selectedPositions, ?string $formId = null, bool $disabled = false): string
{
    $labels = ['Primaria', 'Secundaria'];
    $positionLabels = [
        'ARQ' => 'Arquero',
        'DEF' => 'Defensor',
        'MED' => 'Mediocampista',
        'DEL' => 'Delantero',
    ];
    $formAttr = $formId !== null ? ' form="' . h($formId) . '"' : '';
    $disabledAttr = $disabled ? ' disabled' : '';
    $html = '<div class="player-position-selects grid grid-cols-1 gap-1.5" data-player-position-selects>';
    foreach ($labels as $index => $label) {
        $required = $index === 0 ? ' required' : '';
        $value = (string) ($selectedPositions[$index] ?? '');
        $html .= '<label class="player-position-select grid min-w-0 gap-1 rounded-xl border border-lime-200/20 bg-emerald-950/45 p-1.5">';
        $html .= '<span class="truncate text-[10px] font-black uppercase tracking-wide text-lime-100/85">' . h($label) . '</span>';
        $html .= '<select class="min-h-9 w-full min-w-0 rounded-lg border-lime-200/40 bg-emerald-950 px-2 py-1.5 text-xs font-extrabold text-lime-50 focus:border-lime-200 focus:ring-lime-200/30" name="positions[]"' . $formAttr . $required . $disabledAttr . '>';
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

$players = repo_all_players($isAdmin ? false : true);
$title = 'Jugadores | ' . APP_NAME;
$activePage = 'jugadores.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head rounded-2xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-lg shadow-emerald-950/15">
  <div>
    <h1 class="m-0 text-lime-50">Jugadores</h1>
    <p class="small-muted text-emerald-100/80"><?= $isAdmin ? 'Alta, edicion y administracion general de la plantilla.' : 'Consulta de plantilla, posiciones y stats actuales.' ?></p>
  </div>
  <?php if ($isAdmin): ?>
    <a class="btn border border-lime-200/55 bg-lime-100 text-emerald-950 hover:bg-lime-200" href="migrar_csv.php">Migrar desde CSV</a>
  <?php endif; ?>
</section>

<div class="players-mobile-help hidden max-[900px]:mb-2.5 max-[900px]:block">
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

<section class="card border-lime-200/55 bg-emerald-950 text-lime-50 shadow-xl shadow-emerald-950/20">
  <div class="section-toolbar rounded-xl border border-lime-200/45 bg-emerald-950/85 p-3 shadow-md shadow-emerald-950/10">
    <div>
      <h3 class="m-0 text-lime-50">Listado de jugadores</h3>
      <p class="small-muted text-emerald-100/75"><?= $isAdmin ? 'Mostrando todos los jugadores.' : 'Mostrando solo jugadores activos.' ?></p>
    </div>
    <div
      data-react-root
      data-react-island="player_list_controls"
      data-total="<?= h((string) count($players)) ?>"
      data-can-filter-active="<?= $isAdmin ? '1' : '0' ?>"
    ></div>
  </div>
  <div class="players-desktop-help mb-3 max-[900px]:hidden">
    <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>
  </div>
  <p class="small-muted player-list-empty text-emerald-100/80" data-player-list-empty hidden>No hay jugadores que coincidan con la busqueda.</p>
  <details class="mobile-full-player-list hidden overflow-hidden rounded-xl border border-lime-200/45 bg-emerald-950/80 max-[900px]:block" open>
    <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3">
      <span class="text-sm font-extrabold text-lime-50">Lista completa de jugadores</span>
      <small class="rounded-full bg-lime-100 px-2 py-1 text-xs font-extrabold text-emerald-950"><?= h((string) count($players)) ?> jugadores</small>
    </summary>
    <div class="mobile-player-list-body grid gap-1.5 border-t border-lime-200/30 p-2">
      <?php if (!$players): ?>
        <p class="small-muted">No hay jugadores cargados.</p>
      <?php else: ?>
        <?php foreach ($players as $player): ?>
          <?php
            $rowSearch = player_row_search_text($player);
          ?>
          <article id="player-<?= (int) $player['id'] ?>" class="mobile-player-list-item flex scroll-mt-20 items-center justify-between gap-2 rounded-lg border border-lime-200/25 bg-emerald-950/70 px-2.5 py-2 text-lime-50 transition target:border-amber-200 target:bg-amber-950/70 target:shadow-sm target:ring-4 target:ring-amber-100/40 max-[760px]:items-start" data-player-table-row data-player-id="<?= (int) $player['id'] ?>" data-search="<?= h($rowSearch) ?>"<?= player_sort_data_attrs($player) ?>>
            <span class="min-w-0">
              <strong class="block text-sm font-extrabold text-lime-50"><?= h((string) $player['name']) ?></strong>
              <small class="block text-xs text-emerald-100/75"><?= player_mobile_rating_summary($player) ?></small>
            </span>
            <span class="mobile-player-list-actions flex shrink-0 items-center gap-1.5">
              <?php if ($isAdmin): ?>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="toggle_active">
                  <input type="hidden" name="id" value="<?= (int) $player['id'] ?>">
                  <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
                  <input type="hidden" name="return_anchor" value="player-<?= (int) $player['id'] ?>">
                  <button class="player-status-pill shrink-0 rounded-full border border-lime-200/35 px-2 py-1 text-[11px] font-extrabold not-italic transition hover:scale-105 disabled:cursor-wait disabled:opacity-70 <?= (int) $player['active'] === 1 ? 'is-active bg-lime-100 text-emerald-950' : 'is-inactive bg-emerald-900 text-emerald-100/70' ?>" type="button" title="Cambiar estado" data-player-status-toggle>
                    <?= (int) $player['active'] === 1 ? 'Activo' : 'Inactivo' ?>
                  </button>
                </form>
                <button class="btn player-icon-button inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-900 px-0 text-sm font-extrabold leading-none text-lime-50 hover:bg-emerald-800" type="button" data-player-scout-open<?= player_scout_data_attrs($player) ?> aria-label="Relato de <?= h((string) $player['name']) ?>" title="Relato"><?= player_action_icon('story') ?></button>
                <button class="btn player-icon-button inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-900 px-0 text-sm font-extrabold leading-none text-lime-50 hover:bg-emerald-800" type="button" data-player-edit-open="<?= (int) $player['id'] ?>" aria-label="Editar <?= h((string) $player['name']) ?>" title="Editar"><?= player_action_icon('edit') ?></button>
                <form method="post" class="inline">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= (int) $player['id'] ?>">
                  <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
                  <input type="hidden" name="return_anchor" value="player-<?= (int) $player['id'] ?>">
                  <button class="btn btn-danger player-icon-button player-delete-icon inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl px-0 text-base font-extrabold leading-none" data-confirm="Eliminar jugador?" type="submit" aria-label="Eliminar <?= h((string) $player['name']) ?>" title="Eliminar"><?= player_action_icon('delete') ?></button>
                </form>
              <?php else: ?>
                <span class="player-status-pill shrink-0 rounded-full border border-lime-200/35 px-2 py-1 text-[11px] font-extrabold not-italic <?= (int) $player['active'] === 1 ? 'is-active bg-lime-100 text-emerald-950' : 'is-inactive bg-emerald-900 text-emerald-100/70' ?>">
                  <?= (int) $player['active'] === 1 ? 'Activo' : 'Inactivo' ?>
                </span>
                <button class="btn player-icon-button inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-900 px-0 text-sm font-extrabold leading-none text-lime-50 hover:bg-emerald-800" type="button" data-player-scout-open<?= player_scout_data_attrs($player) ?> aria-label="Relato de <?= h((string) $player['name']) ?>" title="Relato"><?= player_action_icon('story') ?></button>
                <button class="btn player-icon-button inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl border border-lime-200/35 bg-lime-100 px-0 text-sm font-extrabold leading-none text-emerald-950 hover:bg-lime-200" type="button" data-player-edit-open="<?= (int) $player['id'] ?>" aria-label="Ver stats de <?= h((string) $player['name']) ?>" title="Ver stats"><?= player_action_icon('edit') ?></button>
              <?php endif; ?>
            </span>
          </article>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </details>
  <div class="table-wrap players-desktop-table block overflow-x-auto rounded-2xl border border-lime-200/45 bg-emerald-950/70 shadow-lg shadow-emerald-950/20 max-[900px]:hidden">
    <table class="editable-table min-w-[1160px] table-auto">
      <thead>
        <tr>
          <th class="w-44 min-w-44 border-r border-lime-200/20 bg-emerald-950 text-lime-100 last:border-r-0"><button class="player-sort-head inline-flex min-h-0 w-full items-center justify-between gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left text-inherit shadow-none hover:bg-lime-100/10" type="button" data-player-sort="name" aria-label="Ordenar por nombre">Nombre <span aria-hidden="true">↕</span></button></th>
          <th class="w-44 min-w-44 border-r border-lime-200/20 bg-emerald-950 text-lime-100 last:border-r-0"><button class="player-sort-head inline-flex min-h-0 w-full items-center justify-between gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left text-inherit shadow-none hover:bg-lime-100/10" type="button" data-player-sort="positions" aria-label="Ordenar por posiciones">Posiciones <span aria-hidden="true">↕</span></button></th>
          <th class="w-32 min-w-32 border-r border-lime-200/20 bg-emerald-950 text-lime-100 last:border-r-0"><button class="player-sort-head inline-flex min-h-0 w-full items-center justify-between gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left text-inherit shadow-none hover:bg-lime-100/10" type="button" data-player-sort="general" aria-label="Ordenar por promedio general">General <span aria-hidden="true">↕</span></button></th>
          <th class="border-r border-lime-200/20 bg-emerald-950 text-lime-100 last:border-r-0"><button class="player-sort-head inline-flex min-h-0 w-full items-center justify-between gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left text-inherit shadow-none hover:bg-lime-100/10" type="button" data-player-sort="stats" aria-label="Ordenar por promedio de stats">Stats <span aria-hidden="true">↕</span></button></th>
          <?php if ($isAdmin): ?>
            <th class="w-24 min-w-24 border-r border-lime-200/20 bg-emerald-950 text-center text-lime-100 last:border-r-0">Acc.</th>
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
          <tr class="transition-colors hover:[&>td]:bg-lime-100/10" data-player-table-row data-player-edit-row data-player-id="<?= $playerId ?>" data-search="<?= h($rowSearch) ?>"<?= player_sort_data_attrs($player) ?>>
            <td class="w-44 min-w-44 border-b border-r border-lime-200/20 bg-emerald-950/55 py-3 text-lime-50 last:border-r-0 align-middle">
              <?php if ($isAdmin): ?>
                <input type="hidden" name="action" value="save" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="id" value="<?= $playerId ?>" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="ajax_token" value="<?= h(player_ajax_token()) ?>" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>" form="<?= h($rowFormId) ?>">
                <input type="hidden" name="return_anchor" value="player-<?= $playerId ?>" form="<?= h($rowFormId) ?>">
              <?php endif; ?>
              <label class="player-active-inline mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-lime-200/35 bg-emerald-900 px-2 py-1 text-xs font-extrabold text-lime-50">
                <input type="checkbox" name="active" value="1" <?= $isAdmin ? 'form="' . h($rowFormId) . '"' : 'disabled' ?> <?= checked_attr((int) $player['active'] === 1) ?>>
                Activo
              </label>
              <?php if ($isAdmin): ?>
                <input class="table-input w-full min-w-0 rounded-lg border-lime-200/40 bg-emerald-950 px-2 py-2 text-lime-50 focus:border-lime-200 focus:ring-lime-200/30" type="text" name="name" required value="<?= h((string) $player['name']) ?>" form="<?= h($rowFormId) ?>">
              <?php else: ?>
                <strong class="player-readonly-name block text-sm font-extrabold text-lime-50"><?= h((string) $player['name']) ?></strong>
              <?php endif; ?>
              <button class="btn player-scout-row-button mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-lime-200/35 bg-emerald-900 px-2.5 py-1.5 text-xs font-extrabold text-lime-50 hover:bg-emerald-800" type="button" data-player-scout-open aria-label="Relato de <?= h((string) $player['name']) ?>" title="Relato del jugador">
                <?= player_action_icon('story') ?>
                <span>Relato</span>
              </button>
            </td>
            <td class="w-44 min-w-44 border-b border-r border-lime-200/20 bg-emerald-950/55 py-3 text-lime-50 last:border-r-0 align-middle">
              <?= player_position_selects($rowPositions, $isAdmin ? $rowFormId : null, !$isAdmin) ?>
            </td>
            <td class="w-32 min-w-32 border-b border-r border-lime-200/20 bg-emerald-950/55 py-3 text-lime-50 last:border-r-0 align-middle">
              <div class="player-general-rating player-general-rating-compact flex min-h-0 flex-col items-start justify-center gap-1 rounded-xl border-0 bg-transparent px-0 py-0" data-general-rating>
                <strong class="text-xs font-extrabold text-lime-50" data-general-rating-value><?= h(number_format(player_overall_rating($player), 1)) ?>/6</strong>
                <span class="text-sm leading-none text-amber-300" data-general-rating-stars></span>
              </div>
              <?= player_stats_radar_panel(true) ?>
            </td>
            <td class="border-b border-r border-lime-200/20 bg-emerald-950/55 py-3 text-lime-50 last:border-r-0 align-middle">
              <div class="player-table-stat-grid grid min-w-[440px] grid-cols-3 gap-1.5">
                <?php foreach (player_field_stat_fields() as $field): ?>
                  <div class="player-table-stat grid min-w-[140px] gap-1 rounded-xl border border-lime-200/35 bg-emerald-950/80 px-2 py-1.5 shadow-sm" <?= $field === 'attack' ? 'data-attack-stat-row' : '' ?>>
                    <span class="text-[10px] font-extrabold uppercase tracking-wide text-lime-100/75"><?= h($statLabels[$field]) ?></span>
                    <?= stat_rating_control($field, player_effective_stat($player, $field), $isAdmin ? $rowFormId : null, true, !$isAdmin) ?>
                  </div>
                <?php endforeach; ?>
                <div class="player-table-stat grid min-w-[140px] gap-1 rounded-xl border border-lime-200/35 bg-emerald-950/80 px-2 py-1.5 shadow-sm" data-goalkeeper-stat-row>
                  <span class="text-[10px] font-extrabold uppercase tracking-wide text-lime-100/75"><?= h($statLabels['goalkeeper_skill']) ?></span>
                  <?= stat_rating_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill'), $isAdmin ? $rowFormId : null, true, !$isAdmin) ?>
                </div>
              </div>
            </td>
            <?php if ($isAdmin): ?>
              <td class="w-24 min-w-24 border-b border-r border-lime-200/20 bg-emerald-950/55 py-3 text-lime-50 last:border-r-0 align-middle">
                <div class="btn-row flex-nowrap justify-center">
                  <form id="<?= h($rowFormId) ?>" method="post"></form>
                  <button class="btn player-action-icon player-save-icon inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl border border-lime-200/55 bg-lime-100 px-0 py-0 text-emerald-950 hover:bg-lime-200" type="submit" form="<?= h($rowFormId) ?>" data-player-row-save aria-label="Guardar <?= h((string) $player['name']) ?>" title="Guardar"><?= player_action_icon('save') ?></button>
                  <form method="post" class="inline">
                    <input type="hidden" name="action" value="delete">
                    <input type="hidden" name="id" value="<?= $playerId ?>">
                    <input type="hidden" name="show_inactive" value="<?= $showInactive ? '1' : '0' ?>">
                    <input type="hidden" name="return_anchor" value="player-<?= $playerId ?>">
                    <button class="btn btn-danger player-action-icon player-trash-icon inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl px-0 py-0" data-confirm="Eliminar jugador?" type="submit" aria-label="Eliminar <?= h((string) $player['name']) ?>" title="Eliminar"><?= player_action_icon('delete') ?></button>
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

<div class="player-scout-floating-panel fixed inset-0 z-[90] flex items-center justify-center bg-emerald-950/55 p-4 hidden:[display:none]" data-player-scout-panel hidden>
  <article class="player-scout-floating-card w-[min(92vw,520px)] rounded-2xl border border-lime-200/55 bg-emerald-950 p-4 text-left text-lime-50 shadow-2xl shadow-emerald-950/25" role="dialog" aria-modal="true" aria-labelledby="playerScoutTitle">
    <div class="player-scout-floating-head mb-3 flex items-center justify-between gap-3 border-b border-lime-200/30 pb-3">
      <span class="text-xs font-black uppercase tracking-wide text-lime-100">Relato del jugador</span>
      <button class="player-scout-close inline-flex h-8 w-8 items-center justify-center rounded-xl bg-lime-100 text-sm font-extrabold text-emerald-950 transition hover:bg-lime-200" type="button" data-player-scout-close aria-label="Cerrar">x</button>
    </div>
    <h3 class="mb-2 text-lg font-extrabold leading-tight text-lime-50" id="playerScoutTitle" data-player-scout-title>Perfil del jugador</h3>
    <p class="text-sm font-medium leading-relaxed text-emerald-100/85" data-player-scout-body>-</p>
    <div class="player-scout-tags mt-3 flex flex-wrap gap-2" data-player-scout-tags></div>
  </article>
</div>

<?php foreach ($players as $player): ?>
  <?php
    $playerId = (int) $player['id'];
    $rowPositions = parse_positions_csv((string) $player['positions']);
  ?>
  <dialog class="player-edit-dialog m-auto w-[min(92vw,720px)] rounded-2xl border-0 bg-transparent p-0 text-left backdrop:bg-emerald-950/55 max-[760px]:fixed max-[760px]:inset-0 max-[760px]:h-fit max-[760px]:max-h-[calc(100dvh-1.5rem)] max-[760px]:w-[calc(100vw-1.5rem)] max-[760px]:max-w-none max-[760px]:overflow-visible max-[760px]:rounded-xl" data-player-edit-dialog="<?= $playerId ?>">
    <form method="post" class="player-edit-panel rounded-2xl border border-lime-200/55 bg-emerald-950 p-4 text-lime-50 shadow-2xl shadow-emerald-950/25 max-[760px]:max-h-[calc(100dvh-1.5rem)] max-[760px]:overflow-y-auto max-[760px]:rounded-xl max-[760px]:p-3" <?= $isAdmin ? '' : 'data-player-readonly-form' ?>>
      <div class="player-edit-head mb-4 flex items-start justify-between gap-3 border-b border-lime-200/30 pb-3 max-[760px]:sticky max-[760px]:top-0 max-[760px]:z-10 max-[760px]:mb-3 max-[760px]:bg-emerald-950 max-[760px]:pb-2">
        <div>
          <h3 class="m-0 text-lime-50"><?= $isAdmin ? 'Editar jugador' : 'Ver jugador' ?></h3>
          <p class="small-muted text-emerald-100/75"><?= h((string) $player['name']) ?></p>
        </div>
        <button class="btn player-icon-button inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-900 px-0 text-sm font-extrabold leading-none text-lime-50 hover:bg-emerald-800" type="button" data-player-edit-close aria-label="Cerrar"><?= player_action_icon('close') ?></button>
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
          <label class="text-lime-100">Nombre</label>
          <input class="rounded-xl border-lime-200/40 bg-emerald-950 text-lime-50 placeholder:text-emerald-100/45 focus:border-lime-200 focus:ring-lime-200/30" type="text" name="name" required value="<?= h((string) $player['name']) ?>" <?= $isAdmin ? '' : 'readonly' ?>>
        </div>
        <div class="form-row">
          <label class="text-lime-100">General</label>
          <div class="player-general-rating grid min-h-11 items-center gap-3 rounded-xl border border-lime-200/45 bg-emerald-950/80 px-3 py-2 [grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)]" data-general-rating>
            <strong class="col-start-2 justify-self-center rounded-lg bg-lime-100 px-2 py-1 text-sm font-extrabold text-emerald-950" data-general-rating-value><?= h(number_format(player_overall_rating($player), 1)) ?>/6</strong>
            <span class="col-start-3 min-w-0 justify-self-end text-right text-lg leading-none text-amber-300" data-general-rating-stars></span>
          </div>
        </div>
        <div class="form-row">
          <label class="text-lime-100">Estado</label>
          <label class="chip inline-flex items-center gap-2 rounded-xl border border-lime-200/35 bg-emerald-900 px-3 py-2 text-sm font-extrabold text-lime-50">
            <input type="checkbox" name="active" value="1" <?= checked_attr((int) $player['active'] === 1) ?> <?= $isAdmin ? '' : 'disabled' ?>>
            Jugador activo
          </label>
        </div>
      </div>

      <div class="form-row">
        <label class="text-lime-100">Posiciones</label>
        <?= player_position_selects($rowPositions, null, !$isAdmin) ?>
      </div>

      <div class="form-grid">
        <?php foreach (player_field_stat_fields() as $field): ?>
          <div class="form-row stat-form-row rounded-xl border border-lime-200/35 bg-emerald-950/75 p-3 shadow-sm" <?= $field === 'attack' ? 'data-attack-stat-row' : '' ?>>
            <label class="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-100"><?= h($statLabels[$field]) ?></label>
            <?= stat_rating_control($field, player_effective_stat($player, $field), null, false, !$isAdmin) ?>
          </div>
        <?php endforeach; ?>
        <div class="form-row stat-form-row rounded-xl border border-lime-200/35 bg-emerald-950/75 p-3 shadow-sm" data-goalkeeper-stat-row>
          <label class="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-100"><?= h($statLabels['goalkeeper_skill']) ?></label>
          <?= stat_rating_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill'), null, false, !$isAdmin) ?>
        </div>
      </div>

      <?= player_stats_radar_panel() ?>

      <?= player_stats_help_panel($statLabels, $statHelp, $ratingHelp, $fieldWeightHelp) ?>

      <div class="btn-row">
        <?php if ($isAdmin): ?>
          <button class="btn border border-lime-200/55 bg-lime-100 text-emerald-950 hover:bg-lime-200" type="submit">Guardar cambios</button>
          <button class="btn border border-lime-200/35 bg-emerald-900 text-lime-50 hover:bg-emerald-800" type="button" data-player-edit-close>Cancelar</button>
        <?php else: ?>
          <button class="btn border border-lime-200/35 bg-emerald-900 text-lime-50 hover:bg-emerald-800" type="button" data-player-edit-close>Cerrar</button>
        <?php endif; ?>
      </div>
    </form>
  </dialog>
<?php endforeach; ?>

<span hidden data-player-ajax-token="<?= $isAdmin ? h(player_ajax_token()) : '' ?>"></span>
<script src="assets/jugadores.js"></script>

<?php require __DIR__ . '/includes/footer.php'; ?>
