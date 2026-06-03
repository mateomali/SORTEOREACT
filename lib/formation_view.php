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
        [6.0, 99.0],
    ];

    for ($i = 0, $count = count($anchors) - 1; $i < $count; $i++) {
        [$fromRating, $fromOverall] = $anchors[$i];
        [$toRating, $toOverall] = $anchors[$i + 1];
        if ($clamped <= $toRating) {
            $ratio = ($clamped - $fromRating) / ($toRating - $fromRating);
            return (int) round($fromOverall + (($toOverall - $fromOverall) * $ratio));
        }
    }

    return 99;
}

function formation_view_card_tier(float $value): string
{
    $overall = formation_view_card_rating($value);
    if ($overall >= 88) {
        return 'supreme';
    }
    if ($overall >= 84) {
        return 'elite';
    }
    if ($overall >= 76) {
        return 'gold';
    }
    if ($overall >= 66) {
        return 'silver';
    }
    return 'bronze';
}

function formation_view_card_stat_value(array $player, string $field): int
{
    return formation_view_card_rating(player_effective_stat($player, $field));
}

function formation_view_card_regularity_form(array $player): array
{
    $rating = normalize_player_stat(player_effective_stat($player, 'regularity'), 3.5);
    if ($rating >= 4.5) {
        return ['up', 'Regularidad alta'];
    }
    if ($rating < 3.0) {
        return ['down', 'Regularidad baja'];
    }
    return ['right', 'Regularidad normal'];
}

function formation_view_card_stats(array $player, string $position): array
{
    if ($position === 'ARQ') {
        return [
            'ARQ' => formation_view_card_stat_value($player, 'goalkeeper_skill'),
            'RIT' => formation_view_card_stat_value($player, 'rhythm'),
            'DEF' => formation_view_card_stat_value($player, 'defense_physical'),
            'TEC' => formation_view_card_stat_value($player, 'technique'),
            'EQU' => formation_view_card_stat_value($player, 'teamwork'),
            'MEN' => formation_view_card_stat_value($player, 'mentality'),
        ];
    }

    return [
        'TEC' => formation_view_card_stat_value($player, 'technique'),
        'RIT' => formation_view_card_stat_value($player, 'rhythm'),
        'DEF' => formation_view_card_stat_value($player, 'defense_physical'),
        'ATA' => formation_view_card_stat_value($player, 'attack'),
        'EQU' => formation_view_card_stat_value($player, 'teamwork'),
        'MEN' => formation_view_card_stat_value($player, 'mentality'),
    ];
}

function formation_view_group_players(array $players): array
{
    $lines = array_fill_keys(player_formation_lines(), []);
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

function formation_view_defense_line_players(array $lines): array
{
    $lateralPlayers = array_values($lines['LAT'] ?? []);
    $defenderPlayers = array_values($lines['DEF'] ?? []);

    if (!$lateralPlayers) {
        return $defenderPlayers;
    }

    $leftCount = (int) ceil(count($lateralPlayers) / 2);
    return array_merge(
        array_slice($lateralPlayers, 0, $leftCount),
        $defenderPlayers,
        array_slice($lateralPlayers, $leftCount)
    );
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
    $pitchClasses = 'team-formation';
    if ($compact) {
        $pitchClasses .= ' profile-next-team-formation';
    }

    $html = '<article class="team-card multi-draw-pitch-team">';
    $html .= '<div class="team-head">';
    $html .= '<h4>' . h($teamName) . '</h4>';
    if ($colorName !== '') {
        $html .= '<span class="chip">' . h($colorName) . '</span>';
    }
    $html .= '</div>';
    $html .= '<div class="formation-title-row">';
    $html .= '<div class="formation-total-title" data-formation-total-title><span>Base</span><strong>' . h(number_format($teamTotal, 1)) . ' pts</strong></div>';
    $html .= '<div class="formation-total-title formation-tactic-title"><span>TACTICA</span><strong data-formation-tactic>' . h(formation_view_tactic_label($lines)) . '</strong></div>';
    $html .= '</div>';
    $html .= '<div class="' . h($pitchClasses) . '" data-static-team-formation data-static-formation-locked="1">';

    foreach (player_pitch_lines() as $line) {
        $linePlayers = $line === 'DEF'
            ? formation_view_defense_line_players($lines)
            : ($lines[$line] ?? []);
        $html .= '<div class="formation-line">';
        $html .= '<div class="line-label">' . h($line === 'DEF' && ($lines['LAT'] ?? []) ? 'DEF/LAT' : $line) . '</div>';
        $html .= '<div class="line-players">';
        if (!$linePlayers) {
            $html .= '<span class="formation-player empty-slot">-</span>';
        } else {
            foreach ($linePlayers as $player) {
                $assigned = strtoupper((string) ($player['assigned_position'] ?? $line));
                $html .= formation_view_render_player($player, $highlightPlayerId, $assigned);
            }
        }
        $html .= '</div></div>';
    }

    $html .= '</div></article>';

    return $html;
}

function formation_view_tactic_label(array $lines): string
{
    return implode('-', [
        count($lines['DEF'] ?? []) + count($lines['LAT'] ?? []),
        count($lines['MED'] ?? []),
        count($lines['DEL'] ?? []),
    ]);
}

function formation_view_render_player(array $player, int $highlightPlayerId = 0, string $line = ''): string
{
    $rating = (float) ($player['rating'] ?? 0);
    $isHighlighted = $highlightPlayerId > 0 && (int) ($player['id'] ?? 0) === $highlightPlayerId;
    $position = strtoupper($line !== '' ? $line : (string) ($player['assigned_position'] ?? 'MED'));
    $stats = formation_view_card_stats($player, $position);
    $cardClass = 'formation-player card-pro-relieve formation-card-sin-stat formation-card-compacta formation-card-tier-' . formation_view_card_tier($rating) . ($isHighlighted ? ' is-current-player' : '');
    $photoPath = player_photo_path($player);
    $photoClass = player_has_custom_photo($player) ? ' is-custom' : ' is-default';

    $laneRole = $position === 'LAT' ? ' data-lane-role="lateral"' : '';
    $html = '<div class="' . h($cardClass) . '" draggable="false" data-static-formation-player data-static-player-key="' . h((string) ($player['id'] ?? ($player['name'] ?? ''))) . '" data-assigned-position="' . h($position) . '" data-player-skill="' . h((string) $rating) . '"' . $laneRole . '>';
    $html .= '<span class="player-card-rating" title="Puntaje general"><strong>' . h((string) formation_view_card_rating($rating)) . '</strong><span>GEN</span></span>';
    $html .= '<span class="formation-lane-indicator" aria-hidden="true"><span></span><span></span><span></span></span>';
    $html .= '<span class="formation-card-photo' . h($photoClass) . '" aria-hidden="true"><img src="' . h($photoPath) . '" alt=""></span>';
    $html .= '<strong class="formation-player-name">' . h((string) ($player['name'] ?? 'Jugador')) . '</strong>';
    $html .= '<span class="formation-player-meta formation-player-position formation-card-position" title="Posicion asignada">' . h($position ?: 'GEN') . '</span>';
    [$regularityForm, $regularityLabel] = formation_view_card_regularity_form($player);
    $html .= '<span class="formation-card-regularity is-' . h($regularityForm) . '" title="' . h($regularityLabel) . '" aria-label="' . h($regularityLabel) . '"></span>';
    $html .= '<span class="formation-card-stats" aria-label="Stats del jugador">';
    foreach ($stats as $label => $value) {
        $html .= '<span class="formation-card-stat"><span>' . h($label) . '</span><strong>' . h((string) $value) . '</strong></span>';
    }
    $html .= '</span>';
    $html .= '</div>';

    return $html;
}
