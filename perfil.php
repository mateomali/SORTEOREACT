<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/sorteo_multiple.php';

ensure_auth_schema();
ensure_control_schema();
ensure_multiple_draw_schema();
require_player_user();

$playerId = current_player_id();
$player = repo_player_by_id($playerId);
if (!$player) {
    flash('error', 'Tu cuenta ya no esta vinculada a un jugador valido.');
    redirect('logout.php');
}

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
    'teamwork' => 'Juego en equipo, ubicacion colectiva y generosidad para no jugar solo para uno.',
    'mentality' => 'Concentracion, caracter, temple competitivo y capacidad de no irse del partido.',
    'regularity' => 'Estabilidad para rendir cerca de su nivel habitual.',
    'goalkeeper_skill' => 'Atajada, reflejos, achique, posicionamiento y seguridad bajo los tres palos.',
];

function profile_player_fifa_overall(float $value): int
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

function profile_stat_color(float $value): string
{
    if ($value >= 5.95) {
        return '#67e8f9';
    }
    if ($value >= 4.0) {
        return '#bef264';
    }
    if ($value >= 3.0) {
        return '#fcd34d';
    }
    return '#f87171';
}

function profile_scout_data_attrs(array $player): string
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

function profile_player_description(array $player, array $statLabels): string
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

function profile_player_card(array $player, array $statLabels, array $statHelp): string
{
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    $fields = player_field_stat_fields();
    if (in_array('ARQ', $positions, true)) {
        $fields[] = 'goalkeeper_skill';
    }
    $overallSix = player_overall_rating($player);
    $overallCard = profile_player_fifa_overall($overallSix);
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
        $barColor = profile_stat_color($value);
        $html .= '<details class="desktop-player-stat-explainer mobile-player-stat-explainer rounded-xl border border-lime-200/25 bg-emerald-900/35">';
        $html .= '<summary class="cursor-pointer list-none p-2.5">';
        $html .= '<div class="mb-1.5 flex items-center justify-between gap-2">';
        $html .= '<span class="min-w-0 truncate text-xs font-extrabold text-lime-100">' . h((string) ($statLabels[$field] ?? $field)) . '</span>';
        $html .= '<strong class="shrink-0 rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-950">' . h(number_format($value, 1)) . '/6</strong>';
        $html .= '</div><div class="h-2 overflow-hidden rounded-full bg-emerald-950/80">';
        $html .= '<span class="block h-full rounded-full" style="width: ' . $percent . '%; background-color: ' . h($barColor) . '"></span>';
        $html .= '</div></summary>';
        $html .= '<div class="mobile-player-stat-help border-t border-lime-200/20 px-2.5 pb-2.5 pt-2 text-xs font-semibold leading-snug text-emerald-100/85">' . h((string) ($statHelp[$field] ?? 'Sin descripcion disponible.')) . '</div>';
        $html .= '</details>';
    }
    $html .= '</div></div></div>';
    return $html;
}

function profile_next_match_grouped_players(int $matchId): array
{
    $stmt = db()->prepare(
        "SELECT p.*, mp.team_number, mp.assigned_position, mp.is_goalkeeper, mp.lineup_order, mp.formation_line_order
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid
           AND mp.team_number IS NOT NULL
         ORDER BY mp.team_number ASC,
           FIELD(mp.assigned_position, 'ARQ', 'DEF', 'MED', 'DEL'),
           COALESCE(mp.formation_line_order, 99) ASC,
           COALESCE(mp.lineup_order, 99) ASC,
           p.name ASC"
    );
    $stmt->execute(['mid' => $matchId]);
    $grouped = [];
    foreach ($stmt->fetchAll() as $row) {
        $teamNumber = (int) $row['team_number'];
        $line = (string) ($row['assigned_position'] ?: 'MED');
        if (!isset($grouped[$teamNumber])) {
            $grouped[$teamNumber] = ['ARQ' => [], 'DEF' => [], 'MED' => [], 'DEL' => []];
        }
        if (!isset($grouped[$teamNumber][$line])) {
            $line = 'MED';
        }
        $grouped[$teamNumber][$line][] = $row;
    }
    ksort($grouped);
    return $grouped;
}

function profile_render_next_match_formations(array $match, int $currentPlayerId): string
{
    $matchId = (int) ($match['id'] ?? 0);
    $matchTeams = repo_match_teams($matchId);
    $grouped = profile_next_match_grouped_players($matchId);
    if (!$matchTeams || !$grouped) {
        return '';
    }
    $teamsByNumber = [];
    foreach ($matchTeams as $teamRow) {
        $teamsByNumber[(int) ($teamRow['team_number'] ?? 0)] = $teamRow;
    }
    $labels = repo_match_team_labels($match, $matchTeams);
    $formationTeams = [];
    foreach ($grouped as $teamNumber => $lines) {
        $label = $labels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber);
        $players = [];
        foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line) {
            foreach (($lines[$line] ?? []) as $playerRow) {
                $playerRow['assigned_position'] = $line;
                $playerRow['rating'] = player_overall_rating($playerRow);
                $players[] = $playerRow;
            }
        }
        $formationTeams[] = [
            'team_name' => (string) $label,
            'color_name' => profile_team_color_from_label((string) $label),
            'total_skill' => (float) ($teamsByNumber[(int) $teamNumber]['total_skill'] ?? 0),
            'players' => $players,
        ];
    }
    if (!$formationTeams) {
        return '';
    }
    return '<div class="mt-3">' . formation_view_render_pitch($formationTeams, [
        'highlight_player_id' => $currentPlayerId,
    ]) . '</div>';
}

function profile_team_color_from_label(string $label): string
{
    if (preg_match('/\(([^)]+)\)\s*$/i', $label, $matches) !== 1) {
        return '';
    }

    $color = mb_strtoupper(trim($matches[1]), 'UTF-8');
    $knownColors = ['ROSA', 'AZUL', 'VERDE', 'NEGRO', 'NARANJA'];
    return in_array($color, $knownColors, true) ? $color : '';
}

function profile_team_heart_color(string $color): string
{
    return match ($color) {
        'ROSA' => '#ec4899',
        'AZUL' => '#2563eb',
        'VERDE' => '#16a34a',
        'NEGRO' => '#111827',
        'NARANJA' => '#f97316',
        default => '#047857',
    };
}

function profile_render_team_label(string $label): string
{
    $color = profile_team_color_from_label($label);
    if ($color === '') {
        return h($label);
    }

    $name = trim((string) preg_replace('/\s*\([^)]+\)\s*$/', '', $label));
    if ($name === '') {
        $name = 'Equipo';
    }
    return '<span class="team-label-with-heart" title="' . h($label) . '">' .
        '<span>' . h($name) . '</span>' .
        '<svg class="team-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="' . h(profile_team_heart_color($color)) . '">' .
        '<path d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" />' .
        '</svg>' .
        '</span>';
}

function profile_position_base_rating(array $player, string $position): float
{
    $position = strtoupper($position);
    if ($position === 'ARQ') {
        $goalkeeperSkill = in_array('ARQ', parse_positions_csv((string) ($player['positions'] ?? '')), true)
            ? player_effective_stat($player, 'goalkeeper_skill')
            : 2.0;
        return player_apply_regularity_adjustment(
            ($goalkeeperSkill * 0.42)
            + (player_effective_stat($player, 'defense_physical') * 0.14)
            + (player_effective_stat($player, 'rhythm') * 0.10)
            + (player_effective_stat($player, 'technique') * 0.10)
            + (player_effective_stat($player, 'teamwork') * 0.14)
            + (player_effective_stat($player, 'mentality') * 0.10),
            $player
        );
    }
    if ($position === 'DEF') {
        return player_apply_regularity_adjustment(
            (player_effective_stat($player, 'defense_physical') * 0.60)
            + (player_effective_stat($player, 'rhythm') * 0.12)
            + (player_effective_stat($player, 'technique') * 0.08)
            + (player_effective_stat($player, 'teamwork') * 0.08)
            + (player_effective_stat($player, 'mentality') * 0.08)
            + (player_effective_stat($player, 'attack') * 0.04),
            $player
        );
    }
    if ($position === 'MED') {
        return player_apply_regularity_adjustment(
            (player_effective_stat($player, 'technique') * 0.22)
            + (player_effective_stat($player, 'teamwork') * 0.20)
            + (player_effective_stat($player, 'rhythm') * 0.18)
            + (player_effective_stat($player, 'mentality') * 0.14)
            + (player_effective_stat($player, 'defense_physical') * 0.13)
            + (player_effective_stat($player, 'attack') * 0.13),
            $player
        );
    }
    if ($position === 'DEL') {
        return player_apply_regularity_adjustment(
            (player_effective_stat($player, 'attack') * 0.60)
            + (player_effective_stat($player, 'technique') * 0.12)
            + (player_effective_stat($player, 'rhythm') * 0.10)
            + (player_effective_stat($player, 'mentality') * 0.08)
            + (player_effective_stat($player, 'teamwork') * 0.06)
            + (player_effective_stat($player, 'defense_physical') * 0.04),
            $player
        );
    }

    return player_overall_rating($player);
}

function profile_adjusted_position_rating(array $player, string $position): float
{
    $position = strtoupper($position);
    $general = player_overall_rating($player);
    if ($position === '' || in_array($position, parse_positions_csv((string) ($player['positions'] ?? '')), true)) {
        return max(1.0, min(6.0, $general));
    }
    return max(1.0, min(6.0, profile_position_base_rating($player, $position)));
}

function profile_public_team_players_from_lines(array $lines): array
{
    $players = [];
    foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line) {
        foreach (($lines[$line] ?? []) as $playerRow) {
            $players[] = $playerRow;
        }
    }
    return $players;
}

function profile_public_team_tactic_label(array $lines): string
{
    return implode('-', [
        (string) count($lines['DEF'] ?? []),
        (string) count($lines['MED'] ?? []),
        (string) count($lines['DEL'] ?? []),
    ]);
}

function profile_team_characteristics_summary(array $players): array
{
    $count = count($players);
    $average = static function (string $field) use ($players, $count): float {
        if ($count === 0) {
            return 0.0;
        }
        return array_sum(array_map(static fn(array $playerRow): float => player_effective_stat($playerRow, $field), $players)) / $count;
    };
    $goalkeeperSkill = 0.0;
    foreach ($players as $playerRow) {
        if (player_has_goalkeeper_position($playerRow)) {
            $goalkeeperSkill = max($goalkeeperSkill, player_effective_stat($playerRow, 'goalkeeper_skill'));
        }
    }

    return [
        'total' => array_sum(array_map(static fn(array $playerRow): float => player_overall_rating($playerRow), $players)),
        'attack' => $average('attack'),
        'defense_physical' => $average('defense_physical'),
        'rhythm' => $average('rhythm'),
        'technique' => $average('technique'),
        'teamwork' => $average('teamwork'),
        'mentality' => $average('mentality'),
        'regularity' => $average('regularity'),
        'goalkeeper_skill' => $goalkeeperSkill,
        'fast' => count(array_filter($players, static fn(array $playerRow): bool => !player_is_low_rhythm($playerRow))),
        'slow' => count(array_filter($players, static fn(array $playerRow): bool => player_is_low_rhythm($playerRow))),
    ];
}

function profile_render_team_characteristics(array $players): string
{
    if (!$players) {
        return '';
    }
    $summary = profile_team_characteristics_summary($players);
    ob_start();
    ?>
    <div class="public-team-characteristics">
      <div class="team-characteristics-main">
        <span>General <?= h(number_format((float) $summary['total'], 1)) ?></span>
        <span><?= h((string) $summary['fast']) ?> rapidos / <?= h((string) $summary['slow']) ?> lentos</span>
      </div>
      <div class="team-characteristics-stats">
        <?php if ((float) $summary['goalkeeper_skill'] > 0): ?>
          <span>Arquero <?= h(number_format((float) $summary['goalkeeper_skill'], 1)) ?></span>
        <?php else: ?>
          <span>Ataque <?= h(number_format((float) $summary['attack'], 1)) ?></span>
        <?php endif; ?>
        <span>Solidez <?= h(number_format((float) $summary['defense_physical'], 1)) ?></span>
        <span>Ritmo <?= h(number_format((float) $summary['rhythm'], 1)) ?></span>
        <span>Tecnica <?= h(number_format((float) $summary['technique'], 1)) ?></span>
        <span>Juego en equipo <?= h(number_format((float) $summary['teamwork'], 1)) ?></span>
        <span>Mentalidad <?= h(number_format((float) $summary['mentality'], 1)) ?></span>
        <span>Regularidad <?= h(number_format((float) $summary['regularity'], 1)) ?></span>
      </div>
    </div>
    <?php
    return trim((string) ob_get_clean());
}

function profile_render_formation_title_row(float $total, string $tactic): string
{
    ob_start();
    ?>
    <div class="formation-title-row">
      <div class="formation-total-title" data-formation-total-title>
        <span>Base</span>
        <strong><?= h(number_format($total, 1)) ?> pts</strong>
      </div>
      <div class="formation-total-title formation-tactic-title">
        <span>TACTICA</span>
        <strong data-formation-tactic><?= h($tactic) ?></strong>
      </div>
    </div>
    <?php
    return trim((string) ob_get_clean());
}

function profile_render_match_detail_content(array $match, int $currentPlayerId): string
{
    $matchId = (int) $match['id'];
    $participants = repo_match_participants($matchId);
    $groupedTeams = profile_next_match_grouped_players($matchId);
    $teamTotals = repo_team_totals($matchId);
    $matchTeams = repo_match_teams($matchId);
    $teamLabels = $matchTeams ? repo_match_team_labels($match, $matchTeams) : [];

    ob_start();
    ?>
    <?php if (!$groupedTeams): ?>
      <p>Los equipos todavia no fueron formados. Cuando esten sorteados o elegidos por capitanes, se mostrara la formacion aca.</p>
      <?php if ($participants): ?>
        <div class="selected-player-list public-player-list">
          <?php foreach ($participants as $participant): ?>
            <div class="selected-player-item <?= (int) $participant['id'] === $currentPlayerId ? 'profile-current-participant' : '' ?>">
              <span>
                <strong><?= h((string) $participant['name']) ?><?= (int) $participant['id'] === $currentPlayerId ? ' (vos)' : '' ?></strong>
                <small><?= h((string) $participant['positions']) ?> | <?= h(pace_label((string) $participant['pace'])) ?> | <?= h(skill_label((float) $participant['skill'])) ?></small>
              </span>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    <?php else: ?>
      <div class="grid cols-2 public-teams">
        <?php foreach ($groupedTeams as $teamNumber => $lines): ?>
          <?php
            $teamPlayers = profile_public_team_players_from_lines($lines);
            $tacticLabel = profile_public_team_tactic_label($lines);
          ?>
          <article class="team-card">
            <div class="team-head">
              <h4><?= profile_render_team_label($teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber)) ?></h4>
              <span class="small-muted">Formacion base</span>
            </div>
            <?= profile_render_formation_title_row((float) ($teamTotals[$teamNumber]['total_skill'] ?? 0), $tacticLabel) ?>
            <div class="team-formation" data-static-team-formation data-static-formation-locked="1" data-team-number="<?= h((string) $teamNumber) ?>">
              <?php foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line): ?>
                <div class="formation-line">
                  <div class="line-label"><?= h($line) ?></div>
                  <div class="line-players">
                    <?php if (empty($lines[$line])): ?>
                      <span class="formation-player empty-slot">-</span>
                    <?php else: ?>
                      <?php foreach ($lines[$line] as $teamPlayer): ?>
                        <?php
                          $isCurrent = (int) $teamPlayer['id'] === $currentPlayerId;
                          $formationOverall = player_overall_rating($teamPlayer);
                          $formationCardRating = profile_player_fifa_overall(profile_adjusted_position_rating($teamPlayer, $line));
                        ?>
                        <div
                          class="formation-player profile-next-player-card<?= $isCurrent ? ' is-current-player' : '' ?>"
                          draggable="false"
                          data-static-formation-player
                          data-static-player-key="<?= h((string) $teamPlayer['id']) ?>"
                          data-assigned-position="<?= h($line) ?>"
                          data-player-skill="<?= h(number_format($formationOverall, 1, '.', '')) ?>"
                          data-player-positions="<?= h((string) ($teamPlayer['positions'] ?? '')) ?>"
                          data-player-technique="<?= h(number_format(player_effective_stat($teamPlayer, 'technique'), 1, '.', '')) ?>"
                          data-player-rhythm="<?= h(number_format(player_effective_stat($teamPlayer, 'rhythm'), 1, '.', '')) ?>"
                          data-player-defense-physical="<?= h(number_format(player_effective_stat($teamPlayer, 'defense_physical'), 1, '.', '')) ?>"
                          data-player-attack="<?= h(number_format(player_effective_stat($teamPlayer, 'attack'), 1, '.', '')) ?>"
                          data-player-teamwork="<?= h(number_format(player_effective_stat($teamPlayer, 'teamwork'), 1, '.', '')) ?>"
                          data-player-mentality="<?= h(number_format(player_effective_stat($teamPlayer, 'mentality'), 1, '.', '')) ?>"
                          data-player-regularity="<?= h(number_format(player_effective_stat($teamPlayer, 'regularity'), 1, '.', '')) ?>"
                          data-player-goalkeeper-skill="<?= h(number_format(player_effective_stat($teamPlayer, 'goalkeeper_skill'), 1, '.', '')) ?>"
                        >
                          <span class="player-card-rating"><strong><?= h((string) $formationCardRating) ?></strong><span><?= h($line) ?></span></span>
                          <strong><?= h((string) $teamPlayer['name']) ?></strong>
                          <span class="formation-player-meta"><?= h(number_format($formationOverall, 1, '.', '')) ?> pts</span>
                          <?php if ($isCurrent): ?>
                            <span class="profile-current-player-badge">Vos</span>
                          <?php endif; ?>
                        </div>
                      <?php endforeach; ?>
                    <?php endif; ?>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
            <?= profile_render_team_characteristics($teamPlayers) ?>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
    <?php
    return trim((string) ob_get_clean());
}

$stmt = db()->prepare(
    "SELECT
        COUNT(DISTINCT mp.match_id) AS partidos,
        COALESCE(SUM(mp.goals), 0) AS goles,
        ROUND(AVG(mp.rating), 2) AS promedio,
        COALESCE(SUM(CASE
          WHEN mt.goals IS NOT NULL
            AND mt.goals > COALESCE((SELECT MAX(mt2.goals) FROM match_teams mt2 WHERE mt2.match_id = mp.match_id AND mt2.team_number <> mp.team_number), mt.goals)
          THEN 1 ELSE 0 END), 0) AS pg,
        COALESCE(SUM(CASE
          WHEN mt.goals IS NOT NULL
            AND mt.goals = COALESCE((SELECT MAX(mt2.goals) FROM match_teams mt2 WHERE mt2.match_id = mp.match_id AND mt2.team_number <> mp.team_number), mt.goals)
            AND EXISTS (SELECT 1 FROM match_teams mt3 WHERE mt3.match_id = mp.match_id AND mt3.team_number <> mp.team_number)
          THEN 1 ELSE 0 END), 0) AS pe,
        COALESCE(SUM(CASE
          WHEN mt.goals IS NOT NULL
            AND mt.goals < COALESCE((SELECT MAX(mt2.goals) FROM match_teams mt2 WHERE mt2.match_id = mp.match_id AND mt2.team_number <> mp.team_number), mt.goals)
          THEN 1 ELSE 0 END), 0) AS pp
     FROM match_players mp
     INNER JOIN matches m ON m.id = mp.match_id AND m.status = 'finalizado'
     LEFT JOIN match_teams mt ON mt.match_id = mp.match_id AND mt.team_number = mp.team_number
     WHERE mp.player_id = :player_id"
);
$stmt->execute(['player_id' => $playerId]);
$summary = $stmt->fetch() ?: ['partidos' => 0, 'goles' => 0, 'promedio' => null, 'pg' => 0, 'pe' => 0, 'pp' => 0];

$nextMatchStmt = db()->prepare(
    "SELECT m.id, m.title, m.match_date, mp.availability_status
     FROM match_players mp
     INNER JOIN matches m ON m.id = mp.match_id
     WHERE mp.player_id = :player_id
       AND m.status <> 'finalizado'
     ORDER BY m.match_date ASC
     LIMIT 1"
);
$nextMatchStmt->execute(['player_id' => $playerId]);
$nextMatch = $nextMatchStmt->fetch() ?: null;
$multiDrawMatch = null;
$multiDrawOptionCount = 0;
$nextMatchFull = null;
$nextMatchFormationsHtml = '';
$nextMatchDetailHtml = '';
$nextMatchVotePill = '';
$nextMatchVotePillClass = '';
if ($nextMatch) {
    $candidate = repo_match_by_id((int) $nextMatch['id']);
    if ($candidate) {
        multiple_draw_finalize_if_due($candidate);
        $candidate = repo_match_by_id((int) $nextMatch['id']) ?: $candidate;
        $nextMatchFull = $candidate;
        $candidateOptions = multiple_draw_options((int) $candidate['id']);
        if ($candidateOptions) {
            $canVoteCandidate = multiple_draw_user_can_vote($candidate);
            $nextMatchVotePill = $canVoteCandidate ? 'Vota ahora!' : 'Votacion finalizada';
            $nextMatchVotePillClass = $canVoteCandidate ? 'is-open' : 'is-closed';
        }
        if ((string) ($candidate['status'] ?? '') === 'sorteado') {
            $nextMatchFormationsHtml = profile_render_next_match_formations($candidate, $playerId);
        }
        $nextMatchDetailHtml = profile_render_match_detail_content($candidate, $playerId);
        if (multiple_draw_user_can_vote($candidate)) {
            if ($candidateOptions) {
                $multiDrawMatch = $candidate;
                $multiDrawOptionCount = count($candidateOptions);
            }
        }
    }
}

$title = 'Mi perfil | ' . APP_NAME;
$activePage = 'perfil.php';
require __DIR__ . '/includes/header.php';
?>

<section class="card home-next-card profile-home-next-card">
  <div class="home-next-main">
    <span class="home-kicker">Proxima fecha</span>
    <?php if ($nextMatch): ?>
      <h2><?= h((string) ($nextMatch['title'] ?: ('Fecha #' . $nextMatch['id']))) ?></h2>
      <p class="small-muted">
        Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $nextMatch['match_date']))) ?>
        | estado <?= h((string) $nextMatch['availability_status']) ?>
        <?php if ($nextMatchFull): ?>
          | <?= h(match_status_label((string) ($nextMatchFull['status'] ?? 'programado'))) ?>
        <?php endif; ?>
      </p>
    <?php else: ?>
      <h2>Sin fecha asignada</h2>
      <p class="small-muted">Todavia no estas convocado en una fecha proxima.</p>
    <?php endif; ?>
  </div>
  <div class="profile-next-card-actions">
    <?php if ($nextMatchVotePill !== ''): ?>
      <span class="profile-next-vote-pill <?= h($nextMatchVotePillClass) ?>"><?= h($nextMatchVotePill) ?></span>
    <?php endif; ?>
    <?php if ($nextMatch): ?>
      <button class="btn btn-primary match-detail-toggle-btn" type="button" data-match-detail-toggle aria-expanded="false" aria-controls="profileNextMatchDetail">
        <span class="match-detail-toggle-symbol" data-match-detail-symbol>+</span>
        <span>Detalles</span>
      </button>
    <?php endif; ?>
  </div>
</section>

<?php if ($nextMatch): ?>
  <article class="card match-detail profile-next-match-detail" id="profileNextMatchDetail" data-match-detail-panel hidden>
    <?php if ($multiDrawMatch): ?>
      <div class="mb-3">
        <a class="btn btn-primary w-full" href="votar_sorteo.php?match_id=<?= (int) $multiDrawMatch['id'] ?>">Votar sorteo multiple (<?= h((string) $multiDrawOptionCount) ?> opciones)</a>
      </div>
    <?php endif; ?>
    <?php if ($nextMatchDetailHtml !== ''): ?>
      <?= $nextMatchDetailHtml ?>
    <?php else: ?>
      <p class="small-muted">Las caracteristicas del partido aparecen aca cuando se cargan los jugadores o se forman los equipos.</p>
    <?php endif; ?>
  </article>
<?php endif; ?>

<section class="page-head profile-page-head">
  <div>
    <h1>Mi perfil</h1>
    <p class="small-muted">Cuenta vinculada a <?= h((string) $player['name']) ?>.</p>
  </div>
  <a class="btn btn-muted" href="estadisticas.php#stats-jugadores">Ver mis stats</a>
</section>

<section class="grid cols-3 profile-identity-grid mb-3">
  <article class="stat-box">
    <div class="label">Rol</div>
    <div class="value">Jugador</div>
  </article>
  <article class="stat-box">
    <div class="label">Usuario</div>
    <div class="value"><?= h((string) ($_SESSION['username'] ?? '')) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">Jugador</div>
    <div class="value"><?= h((string) $player['name']) ?></div>
  </article>
</section>

<section class="grid cols-3 profile-summary-grid mb-3">
  <article class="stat-box">
    <div class="label">Partidos</div>
    <div class="value"><?= h((string) ((int) $summary['partidos'])) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">Goles</div>
    <div class="value"><?= h((string) ((int) $summary['goles'])) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">Promedio</div>
    <div class="value"><?= $summary['promedio'] !== null ? h(number_format((float) $summary['promedio'], 2)) : '-' ?></div>
  </article>
  <article class="stat-box">
    <div class="label">PG</div>
    <div class="value"><?= h((string) ((int) $summary['pg'])) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">PE</div>
    <div class="value"><?= h((string) ((int) $summary['pe'])) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">PP</div>
    <div class="value"><?= h((string) ((int) $summary['pp'])) ?></div>
  </article>
</section>

<section class="card profile-player-card-section mb-3">
  <div class="section-toolbar profile-section-toolbar">
    <div>
      <h3>Ficha de jugador</h3>
      <p class="small-muted">Stats actuales, radar y lectura del perfil.</p>
    </div>
    <button class="btn btn-primary" type="button" data-player-scout-open<?= profile_scout_data_attrs($player) ?>>Ver relato completo</button>
  </div>
  <div class="profile-detail-layout grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
    <?= profile_player_card($player, $statLabels, $statHelp) ?>
    <article class="stat-box profile-description-card">
      <div class="label">Descripcion</div>
      <p class="mt-2 text-sm font-semibold leading-relaxed text-emerald-100/85"><?= h(profile_player_description($player, $statLabels)) ?></p>
      <div class="mt-3 flex flex-wrap gap-2">
        <?php foreach (parse_positions_csv((string) $player['positions']) as $position): ?>
          <span class="chip"><?= h($position) ?></span>
        <?php endforeach; ?>
        <span class="chip">GEN <?= h((string) profile_player_fifa_overall(player_overall_rating($player))) ?></span>
      </div>
    </article>
  </div>
</section>

<section class="card profile-functions-section mb-3">
  <h3>Funciones de jugador</h3>
  <div class="grid cols-3 profile-feature-grid">
    <article class="stat-box">
      <div class="label">Estadisticas</div>
      <div class="value">Activo</div>
      <p class="small-muted">Tu jugador aparece primero en listados y estadisticas cuando estas logueado.</p>
    </article>
    <article class="stat-box">
      <div class="label">Votar equipo a jugar</div>
      <div class="value">Pendiente</div>
      <p class="small-muted">Permiso reservado para la proxima pantalla de convocatoria/votacion.</p>
    </article>
    <article class="stat-box">
      <div class="label">Premios y puntajes</div>
      <div class="value">Opcional</div>
      <p class="small-muted">El rol ya identifica al jugador; falta decidir si reemplaza o convive con tokens.</p>
    </article>
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

<script src="assets/jugadores.js"></script>

<?php require __DIR__ . '/includes/footer.php'; ?>
