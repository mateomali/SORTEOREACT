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
            ? array_merge($lines['LAT'] ?? [], $lines['DEF'] ?? [])
            : ($lines[$line] ?? []);
        if ($line === 'DEF' && count($lines['LAT'] ?? []) > 1) {
            $latPlayers = $lines['LAT'] ?? [];
            $defPlayers = $lines['DEF'] ?? [];
            $linePlayers = array_merge(array_slice($latPlayers, 0, 1), $defPlayers, array_slice($latPlayers, 1));
        }
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
    $cardClass = 'formation-player' . ($isHighlighted ? ' is-current-player' : '');

    $html = '<div class="' . h($cardClass) . '" draggable="false" data-static-formation-player data-static-player-key="' . h((string) ($player['id'] ?? ($player['name'] ?? ''))) . '" data-assigned-position="' . h($position) . '" data-player-skill="' . h((string) $rating) . '">';
    $html .= '<strong class="formation-player-name">' . h((string) ($player['name'] ?? 'Jugador')) . '</strong>';
    $html .= '<span class="player-card-rating formation-player-match-rating" title="Nota del partido">' . h(number_format($rating, 1)) . '</span>';
    $html .= '<span class="formation-player-meta formation-player-position" title="Posicion">' . h($position ?: 'GEN') . '</span>';
    $html .= '</div>';

    return $html;
}
