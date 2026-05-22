<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function shared_profile_stat_labels(): array
{
    return [
        'technique' => 'Tecnica',
        'rhythm' => 'Ritmo',
        'defense_physical' => 'Solidez',
        'attack' => 'Ataque',
        'teamwork' => 'Juego en equipo',
        'mentality' => 'Mentalidad',
        'regularity' => 'Regularidad',
        'goalkeeper_skill' => 'Habilidad de arquero',
    ];
}

function shared_profile_stat_help(): array
{
    return [
        'technique' => 'Control, pase, gambeta y calidad con la pelota.',
        'rhythm' => 'Velocidad, aceleracion, intensidad y capacidad de ir y volver.',
        'defense_physical' => 'Marca, quite, anticipo, presion, fuerza, choque y resistencia defensiva.',
        'attack' => 'Definicion, llegada al arco, desmarque y peligro ofensivo.',
        'teamwork' => 'Juego en equipo, ubicacion colectiva y generosidad para no jugar solo para uno.',
        'mentality' => 'Concentracion, caracter, temple competitivo y capacidad de no irse del partido.',
        'regularity' => 'Estabilidad para rendir cerca de su nivel habitual.',
        'goalkeeper_skill' => 'Atajada, reflejos, achique, posicionamiento y seguridad bajo los tres palos.',
    ];
}

function shared_profile_player_fifa_overall(float $value): int
{
    $clamped = max(1.0, min(6.0, $value));
    $anchors = [
        [1.0, 35.0], [2.5, 54.0], [3.0, 64.0], [3.2, 69.0], [3.5, 74.0],
        [3.8, 79.0], [4.0, 81.0], [4.4, 86.0], [4.5, 87.0], [5.0, 92.0],
        [5.2, 93.0], [5.3, 94.0], [6.0, 98.0],
    ];
    for ($i = 0, $count = count($anchors) - 1; $i < $count; $i++) {
        [$fromRating, $fromOverall] = $anchors[$i];
        [$toRating, $toOverall] = $anchors[$i + 1];
        if ($clamped <= $toRating) {
            $ratio = ($clamped - $fromRating) / ($toRating - $fromRating);
            return (int) round($fromOverall + (($toOverall - $fromOverall) * $ratio));
        }
    }
    return 98;
}

function shared_profile_stat_color(float $value): string
{
    if ($value >= 5.95) {
        return '#67e8f9';
    }
    if ($value >= 5.0) {
        return '#22c55e';
    }
    if ($value >= 4.0) {
        return '#84cc16';
    }
    if ($value >= 3.0) {
        return '#f59e0b';
    }
    return '#f87171';
}

function shared_profile_player_description(array $player, array $statLabels): string
{
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    $fields = player_field_stat_fields();
    if (in_array('ARQ', $positions, true)) {
        $fields[] = 'goalkeeper_skill';
    }
    $stats = [];
    foreach ($fields as $field) {
        $stats[$field] = player_effective_stat($player, $field);
    }
    arsort($stats);
    $bestField = (string) array_key_first($stats);
    asort($stats);
    $weakField = (string) array_key_first($stats);
    $overall = player_overall_rating($player);
    $role = implode('/', $positions) ?: 'MED';
    $bestLabel = strtolower((string) ($statLabels[$bestField] ?? $bestField));
    $weakLabel = strtolower((string) ($statLabels[$weakField] ?? $weakField));

    if ($overall >= 5.0) {
        return (string) $player['name'] . ' tiene perfil fuerte de ' . $role . ': destaca en ' . $bestLabel . ' y puede marcar diferencia si el equipo aprovecha ese punto.';
    }
    if ($overall >= 4.0) {
        return (string) $player['name'] . ' es un jugador confiable para el rol ' . $role . '. Su mejor recurso es ' . $bestLabel . ', con ' . $weakLabel . ' como zona a cuidar.';
    }
    return (string) $player['name'] . ' necesita una funcion clara para rendir mejor. Puede aportar desde ' . $bestLabel . ', pero conviene acompanarlo en ' . $weakLabel . '.';
}

function shared_profile_player_card(array $player, array $statLabels, array $statHelp): string
{
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    $fields = player_field_stat_fields();
    if (in_array('ARQ', $positions, true)) {
        $fields[] = 'goalkeeper_skill';
    }
    $overallSix = player_overall_rating($player);
    $overallCard = shared_profile_player_fifa_overall($overallSix);
    $positionsLabel = implode(' / ', $positions);

    $html = '<div class="mobile-player-profile-panel profile-player-panel profile-card-panel rounded-2xl border border-lime-200/45 bg-emerald-950/80 p-4 text-lime-50 shadow-xl shadow-emerald-950/20">';
    foreach ($positions as $position) {
        $html .= '<input type="checkbox" name="positions[]" value="' . h($position) . '" checked hidden aria-hidden="true">';
    }
    foreach (array_merge(player_field_stat_fields(), ['goalkeeper_skill']) as $field) {
        $html .= '<input type="hidden" name="' . h($field) . '" value="' . h(number_format(player_effective_stat($player, $field), 1, '.', '')) . '" data-stat-rating-input>';
    }
    $html .= '<div class="profile-card-inner grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">';
    $html .= '<div class="grid gap-3">';
    $html .= '<div class="desktop-player-card-overall grid items-center gap-2 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">';
    $html .= '<div class="mobile-player-card-rating"><strong data-general-card-value>' . h((string) $overallCard) . '</strong><span>GEN</span></div>';
    $html .= '<div class="mobile-player-card-meta"><span>GENERAL</span><strong data-general-card-position>' . h($positionsLabel) . '</strong></div>';
    $html .= '</div>';
    $html .= '<aside class="player-radar-card rounded-xl border border-lime-200/45 bg-emerald-950/80 p-3 text-lime-50 shadow-sm shadow-emerald-950/20" data-player-radar hidden>';
    $html .= '<div class="player-radar-head mb-2 flex items-center justify-between gap-2"><strong class="text-xs font-extrabold uppercase tracking-wide text-lime-100">Radar del jugador</strong><span class="text-[10px] font-bold text-emerald-100/70" data-player-radar-subtitle>Analisis de stats</span></div>';
    $html .= '<div class="player-radar-canvas mx-auto flex w-full justify-center" data-player-radar-canvas></div>';
    $html .= '</aside>';
    $html .= '</div>';
    $html .= '<div class="grid gap-2">';
    foreach ($fields as $field) {
        $value = player_effective_stat($player, $field);
        $percent = max(0, min(100, (int) round(($value / 6) * 100)));
        $barColor = shared_profile_stat_color($value);
        $html .= '<details class="desktop-player-stat-explainer mobile-player-stat-explainer rounded-xl border border-lime-200/25 bg-emerald-900/35">';
        $html .= '<summary class="cursor-pointer list-none p-2.5">';
        $html .= '<div class="mb-1.5 flex items-center justify-between gap-2">';
        $html .= '<span class="min-w-0 truncate text-xs font-extrabold text-lime-100">' . h((string) ($statLabels[$field] ?? $field)) . '</span>';
        $html .= '<strong class="shrink-0 rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-extrabold text-[#07130f]">' . h(number_format($value, 1)) . '/6</strong>';
        $html .= '</div><div class="h-2 overflow-hidden rounded-full bg-emerald-950/80">';
        $html .= '<span class="block h-full rounded-full" style="width: ' . $percent . '%; background-color: ' . h($barColor) . '"></span>';
        $html .= '</div></summary>';
        $html .= '<div class="mobile-player-stat-help border-t border-lime-200/20 px-2.5 pb-2.5 pt-2 text-xs font-semibold leading-snug text-emerald-100/85">' . h((string) ($statHelp[$field] ?? 'Sin descripcion disponible.')) . '</div>';
        $html .= '</details>';
    }
    $html .= '</div></div></div>';
    return $html;
}
