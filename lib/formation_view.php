<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function formation_view_card_rating(float $value): int
{
    $clamped = max(1.0, min(6.0, $value));
    $anchors = [
        [1.0, 35.0],
        [2.5, 54.0],
        [3.0, 64.0],
        [3.2, 69.0],
        [3.5, 74.0],
        [3.8, 79.0],
        [4.0, 81.0],
        [4.4, 86.0],
        [4.5, 87.0],
        [5.0, 92.0],
        [5.2, 93.0],
        [5.3, 94.0],
        [6.0, 98.0],
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

function formation_view_group_players(array $players): array
{
    $lines = ['ARQ' => [], 'DEF' => [], 'MED' => [], 'DEL' => []];
    foreach ($players as $player) {
        if (!is_array($player)) {
            continue;
        }
        $line = strtoupper((string) ($player['assigned_position'] ?? 'MED'));
        if (!isset($lines[$line])) {
            $line = 'MED';
        }
        $lines[$line][] = $player;
    }
    return $lines;
}

function formation_view_render_pitch(array $teams, array $options = []): string
{
    $highlightPlayerId = (int) ($options['highlight_player_id'] ?? 0);
    $gridClass = (string) ($options['grid_class'] ?? 'grid gap-3 lg:grid-cols-2');
    $compact = !empty($options['compact']);

    $html = '<div class="' . h($gridClass) . '">';
    foreach ($teams as $team) {
        if (!is_array($team)) {
            continue;
        }
        $html .= formation_view_render_team($team, [
            'highlight_player_id' => $highlightPlayerId,
            'compact' => $compact,
        ]);
    }
    $html .= '</div>';

    return $html;
}

function formation_view_render_team(array $team, array $options = []): string
{
    $highlightPlayerId = (int) ($options['highlight_player_id'] ?? 0);
    $compact = !empty($options['compact']);
    $teamName = (string) ($team['team_name'] ?? 'Equipo');
    $colorName = (string) ($team['color_name'] ?? '');
    $teamTotal = (float) ($team['total_skill'] ?? 0);
    $lines = formation_view_group_players((array) ($team['players'] ?? []));
    $pitchHeight = $compact ? 'min-h-[500px]' : 'min-h-[620px] max-[760px]:min-h-[520px]';

    $html = '<article class="min-h-0 rounded-2xl border border-lime-200/45 bg-emerald-950/85 p-3 text-lime-50 shadow-xl shadow-emerald-950/20">';
    $html .= '<div class="mb-3 flex flex-wrap items-start justify-between gap-2">';
    $html .= '<h4 class="mb-0 flex min-w-0 flex-wrap items-center gap-2 text-lg font-black leading-tight text-lime-50">';
    $html .= '<span class="min-w-0">' . h($teamName) . '</span>';
    $html .= '<em class="rounded-lg border border-lime-200/35 bg-emerald-900/70 px-2 py-1 text-xs font-black not-italic text-lime-100">General ' . h(number_format($teamTotal, 1)) . '</em>';
    $html .= '</h4>';
    if ($colorName !== '') {
        $html .= '<span class="inline-flex rounded-lg bg-lime-100 px-2 py-1 text-[10px] font-black text-emerald-950">' . h($colorName) . '</span>';
    }
    $html .= '</div>';
    $html .= '<div class="relative overflow-hidden rounded-2xl border border-lime-200/35 bg-emerald-900 p-3 shadow-inner shadow-emerald-950/40 ' . h($pitchHeight) . '">';
    $html .= '<div class="pointer-events-none absolute inset-3 rounded-[1rem] border border-lime-100/20"></div>';
    $html .= '<div class="pointer-events-none absolute left-3 right-3 top-1/2 border-t border-lime-100/20"></div>';
    $html .= '<div class="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime-100/15 max-[760px]:h-16 max-[760px]:w-16"></div>';
    $html .= '<div class="relative z-10 grid h-full content-between gap-4">';

    foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line) {
        $html .= '<div class="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2 max-[760px]:grid-cols-[34px_minmax(0,1fr)]">';
        $html .= '<div class="inline-flex h-8 items-center justify-center rounded-lg border border-lime-200/25 bg-emerald-950/80 text-[10px] font-black text-lime-100 max-[760px]:h-7 max-[760px]:text-[9px]">' . h($line) . '</div>';
        $html .= '<div class="flex min-w-0 flex-wrap justify-center gap-2 max-[760px]:gap-1.5">';
        if (!$lines[$line]) {
            $html .= '<span class="inline-flex min-h-12 min-w-24 items-center justify-center rounded-xl border border-dashed border-lime-200/25 bg-emerald-950/35 px-3 text-xs font-black text-lime-100/45 max-[760px]:min-h-10 max-[760px]:min-w-16">-</span>';
        } else {
            foreach ($lines[$line] as $player) {
                $html .= formation_view_render_player($player, $highlightPlayerId);
            }
        }
        $html .= '</div></div>';
    }

    $html .= '</div></div></article>';

    return $html;
}

function formation_view_render_player(array $player, int $highlightPlayerId = 0): string
{
    $rating = (float) ($player['rating'] ?? 0);
    $isHighlighted = $highlightPlayerId > 0 && (int) ($player['id'] ?? 0) === $highlightPlayerId;
    $cardClass = $isHighlighted
        ? ' border-lime-100 bg-lime-100 text-emerald-950 shadow-xl shadow-lime-200/25 ring-4 ring-lime-200/40'
        : ' border-lime-200/20 bg-emerald-950/80 text-lime-50 shadow-md shadow-emerald-950/20';
    $ratingClass = $isHighlighted
        ? ' border-emerald-950/35 bg-emerald-950 text-lime-100'
        : ' border-lime-200/20 bg-emerald-900 text-lime-100';
    $textClass = $isHighlighted ? 'text-emerald-950' : 'text-lime-50';
    $metaClass = $isHighlighted ? 'text-emerald-950/80' : 'text-emerald-100/75';

    $html = '<div class="relative grid min-w-28 max-w-40 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border px-2 py-1.5 text-xs font-bold transition max-[760px]:min-w-24 max-[760px]:max-w-32 max-[760px]:gap-1.5 max-[760px]:px-1.5 ' . $cardClass . '">';
    $html .= '<span class="inline-flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg border leading-none max-[760px]:h-8 max-[760px]:w-8 ' . $ratingClass . '">';
    $html .= '<strong class="text-base font-black leading-none max-[760px]:text-xs">' . h((string) formation_view_card_rating($rating)) . '</strong>';
    $html .= '<span class="mt-0.5 text-[7px] font-black leading-none max-[760px]:text-[6px]">GEN</span>';
    $html .= '</span>';
    $html .= '<span class="min-w-0">';
    $html .= '<strong class="block min-w-0 truncate text-sm font-black leading-tight max-[760px]:text-[10px] ' . $textClass . '">' . h((string) ($player['name'] ?? 'Jugador')) . '</strong>';
    $html .= '<span class="block min-w-0 truncate text-[10px] font-bold leading-tight max-[760px]:text-[9px] ' . $metaClass . '">' . h(number_format($rating, 1)) . ' estrellas</span>';
    $html .= '</span>';
    if ($isHighlighted) {
        $html .= '<span class="absolute -right-1 -top-2 rounded-full bg-emerald-950 px-1.5 py-0.5 text-[9px] font-black text-lime-100">Vos</span>';
    }
    $html .= '</div>';

    return $html;
}
