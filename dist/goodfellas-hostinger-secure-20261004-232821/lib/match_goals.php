<?php
declare(strict_types=1);

function match_validate_scorers(array $participants, array $teamGoals, array $input): array
{
    $totals = array_fill_keys(array_keys($teamGoals), 0);
    $goals = [];
    foreach ($participants as $player) {
        if ($player['team_number'] === null) continue;
        $id = (int) $player['id'];
        $team = (int) $player['team_number'];
        $value = $input[$id] ?? 0;
        if (!is_scalar($value) || !preg_match('/^\d+$/', (string) $value)) {
            throw new RuntimeException('Carga una cantidad entera de goles para ' . $player['name'] . '.');
        }
        $goals[$id] = (int) $value;
        $totals[$team] = ($totals[$team] ?? 0) + $goals[$id];
    }
    foreach ($teamGoals as $team => $expected) {
        if (!is_scalar($expected) || !preg_match('/^\d+$/', (string) $expected)) {
            throw new RuntimeException('Carga un resultado entero y no negativo para cada equipo.');
        }
        $loaded = $totals[$team] ?? 0;
        if ($loaded !== (int) $expected) {
            throw new RuntimeException("Equipo {$team}: asignaste {$loaded} goles a jugadores y el resultado indica {$expected}. Completa los goleadores antes de finalizar.");
        }
    }
    return $goals;
}

function match_render_scorers(array $participants, array $teamLabels, bool $editable = false, ?array $teamGoals = null): void
{
    echo '<section class="match-scorers">';
    if ($editable && $teamGoals !== null) {
        echo '<div class="finish-match-result"><h4>Resultado del partido</h4><div class="finish-match-scoreboard">';
        foreach ($teamLabels as $team => $label) {
            echo '<label class="finish-match-score"><span>' . h($label) . '</span><input class="finish-number-input" aria-label="Resultado de ' . h($label) . '" type="number" min="0" step="1" name="team_goals[' . (int) $team . ']" value="' . (int) ($teamGoals[$team] ?? 0) . '" required data-finish-team-goals data-team-number="' . (int) $team . '" data-finish-score-input data-finish-default-value="0"></label>';
        }
        echo '</div></div>';
    }
    if ($editable) {
        echo '<div class="finish-player-goals-head"><h4>Goles por jugador</h4><p class="small-muted">Asigna los goles a sus autores. La suma de cada equipo debe coincidir con el resultado.</p></div>';
    } elseif ($teamGoals === null) {
        echo '<h4>Goleadores por equipo</h4>';
    }
    echo '<div class="grid cols-2 finish-scorers-grid">';
    foreach ($teamLabels as $team => $label) {
        echo '<div class="stat-box finish-scorers-team" data-finish-goals-team="' . (int) $team . '"><strong>' . h($label) . '</strong>';
        if ($editable && $teamGoals !== null) {
            echo '<p class="small-muted" data-finish-goals-progress aria-live="polite"></p>';
        }
        if ($editable) echo '<div class="finish-scorers-columns"><span>Jugador</span><span>Goles</span></div>';
        $hasGoals = false;
        foreach ($participants as $player) {
            if ($player['team_number'] === null || (int) $player['team_number'] !== (int) $team) continue;
            $count = (int) ($player['goals'] ?? 0);
            if (!$editable && $count === 0) continue;
            $hasGoals = true;
            if ($editable) {
                echo '<label class="finish-scorer-row flex items-center justify-between gap-2 mt-2"><span>' . h($player['name']) . '</span><input class="finish-number-input" style="width:72px;max-width:40%;flex:0 0 auto" aria-label="Goles de ' . h($player['name']) . '" type="number" min="0" step="1" name="goals[' . (int) $player['id'] . ']" value="' . $count . '" required data-finish-player-goals data-finish-score-input data-finish-default-value="0"></label>';
            } else {
                echo '<p>' . h($player['name']) . ' · ' . $count . ($count === 1 ? ' gol' : ' goles') . '</p>';
            }
        }
        if (!$editable && !$hasGoals) echo '<p class="small-muted">Sin goleadores registrados</p>';
        echo '</div>';
    }
    echo '</div></section>';
}
