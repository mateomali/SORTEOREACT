<?php
declare(strict_types=1);

// Pure scheduling and clock rules. Database access lives in live_match_repository.php.
function live_pair_key(array $pair): string
{
    sort($pair, SORT_NUMERIC);
    return implode('-', $pair);
}

function live_score(array $game): array
{
    $score = array_fill_keys($game['teams'], 0);
    foreach ($game['goals'] as $goal) $score[$goal['team']]++;
    return $score;
}

function live_elapsed(array $game, ?float $now = null): float
{
    return $game['elapsed'] + ($game['running_since'] === null ? 0 : max(0, ($now ?? microtime(true)) - $game['running_since']));
}

function live_winner(array $game, bool $useFirstGoal = true): int
{
    [$a, $b] = $game['teams'];
    $score = live_score($game);
    if ($score[$a] !== $score[$b]) return $score[$a] > $score[$b] ? $a : $b;
    if (!$useFirstGoal) return $game['teams'][0];
    return (int) ($game['tie_choice'] ?? ($game['goals'][0]['team'] ?? 0));
}

function live_new_game(array $pair, int $duration, string $reason): array
{
    return ['teams' => array_values($pair), 'duration' => $duration, 'elapsed' => 0,
        'running_since' => null, 'status' => 'ready', 'goals' => [], 'tie_choice' => null, 'first_goal_known' => true, 'reason' => $reason];
}

function live_apply_action(array $state, string $action, array $input, array $teams, array $participants, ?float $now = null): array
{
    $next = live_apply_action_internal($state, $action, $input, $teams, $participants, $now);
    live_validate_pending_scorers($next, $participants);
    return $next;
}

function live_validate_pending_scorers(array $state, array $participants): void
{
    $available = [];
    foreach ($state['games'] as $game) {
        if ($game['status'] !== 'finished') continue;
        foreach ($game['goals'] as $goal) {
            if ($goal['player'] === null && !$goal['own']) $available[$goal['team']] = ($available[$goal['team']] ?? 0) + 1;
        }
    }
    $pending = [];
    foreach ($participants as $player) {
        $team = (int) $player['team_number'];
        $pending[$team] = ($pending[$team] ?? 0) + (int) ($state['pending_scorers'][(int) $player['id']] ?? 0);
    }
    foreach ($pending as $team => $count) {
        if ($count > ($available[$team] ?? 0)) throw new RuntimeException('Primero ajustá los goleadores generales del equipo ' . $team . ': superan los goles que quedarían disponibles.');
    }
}

function live_apply_action_internal(array $state, string $action, array $input, array $teams, array $participants, ?float $now = null): array
{
    $now ??= microtime(true);
    if ($state['closed'] && !in_array($action, ['edit_goal', 'correct_game', 'remove_goal', 'add_finished_goal', 'add_finished_game', 'delete_game', 'set_pending_scorers'], true)) throw new RuntimeException('La fecha ya está finalizada.');
    $games = &$state['games'];
    $index = count($games) - 1;
    if ($action === 'add_finished_game') {
        if (!$state['closed']) throw new RuntimeException('Esta carga es para fechas finalizadas.');
        if (count($games) >= 240) throw new RuntimeException('Se alcanzó el máximo de partidos por fecha.');
        $pair = is_array($input['teams'] ?? null) ? $input['teams'] : [];
        if (count($pair) !== 2 || !is_int($pair[0]) || !is_int($pair[1]) || $pair[0] === $pair[1] || array_diff($pair, $teams)) throw new RuntimeException('Elegí dos equipos distintos de esta fecha.');
        if (isset($state['summary']) && ($input['replace_summary'] ?? false) !== true) throw new RuntimeException('Confirmá el reemplazo de la carga general por los partidos detallados.');
        $newGame = live_new_game($pair, $state['duration'], 'Partido cargado después del cierre.');
        $newGame['status'] = 'finished';
        $newGame['first_goal_known'] = false;
        foreach ($pair as $team) {
            $value = filter_var($input['scores'][$team] ?? null, FILTER_VALIDATE_INT);
            if ($value === false || $value < 0 || $value > 100) throw new RuntimeException('Los goles deben estar entre 0 y 100.');
            for ($i = 0; $i < $value; $i++) $newGame['goals'][] = ['team' => $team, 'player' => null, 'own' => false, 'at' => null];
        }
        unset($state['summary']);
        $games[] = $newGame;
        return $state;
    }
    if ($action === 'set_pending_scorers') {
        if (!isset($state['pending_scorers']) || !is_array($input['goals'] ?? null)) throw new RuntimeException('No hay goleadores generales pendientes.');
        foreach ($participants as $player) {
            $id = (int) $player['id'];
            $count = filter_var($input['goals'][$id] ?? null, FILTER_VALIDATE_INT);
            if ($count === false || $count < 0 || $count > 24000) throw new RuntimeException('Ingresá cantidades enteras de goles.');
            $state['pending_scorers'][$id] = $count;
        }
        return $state;
    }
    if ($action === 'delete_game') {
        $editIndex = filter_var($input['game'] ?? null, FILTER_VALIDATE_INT);
        if (!$state['closed'] || $editIndex === false || !isset($games[$editIndex]) || $games[$editIndex]['status'] !== 'finished') throw new RuntimeException('Solo se pueden quitar partidos de una fecha finalizada.');
        array_splice($games, $editIndex, 1);
        return $state;
    }
    if ($action === 'add_finished_goal' || ($action === 'remove_goal' && $state['closed'])) {
        $editIndex = filter_var($input['game'] ?? null, FILTER_VALIDATE_INT);
        if ($editIndex === false || !isset($games[$editIndex]) || $games[$editIndex]['status'] !== 'finished') throw new RuntimeException('Elegí un partido finalizado.');
        if ($action === 'add_finished_goal') {
            if (count($games[$editIndex]['goals']) >= 200) throw new RuntimeException('Se alcanzó el máximo de goles del partido.');
            $games[$editIndex]['goals'][] = live_validate_goal((int) ($input['team'] ?? 0), $input, $games[$editIndex], $participants) + ['at' => null];
        } else {
            $goalIndex = filter_var($input['goal'] ?? null, FILTER_VALIDATE_INT);
            if ($goalIndex === false || !isset($games[$editIndex]['goals'][$goalIndex])) throw new RuntimeException('Gol inválido.');
            array_splice($games[$editIndex]['goals'], $goalIndex, 1);
        }
        return $state;
    }
    if ($action === 'duration') {
        $minutes = filter_var($input['minutes'] ?? null, FILTER_VALIDATE_INT);
        if ($minutes === false || $minutes < 1 || $minutes > 120) throw new RuntimeException('La duración debe estar entre 1 y 120 minutos.');
        if ($index >= 0 && $games[$index]['status'] !== 'finished') throw new RuntimeException('Cambia la duración entre partidos.');
        $state['duration'] = $minutes * 60;
        return $state;
    }
    if ($action === 'next') {
        if ($index >= 0 && $games[$index]['status'] !== 'finished') throw new RuntimeException('Finaliza el partido actual antes de continuar.');
        $target = count($teams) * (count($teams) - 1);
        if (count($games) >= $target && empty($input['extra'])) throw new RuntimeException('Confirma que querés agregar un partido adicional.');
        if (count($games) >= 240) throw new RuntimeException('Se alcanzó el máximo de partidos por fecha.');
        if (!$games) {
            $pair = array_map('intval', is_array($input['teams'] ?? null) ? $input['teams'] : []);
            if (count($pair) !== 2 || $pair[0] === $pair[1] || array_diff($pair, $teams)) throw new RuntimeException('Elegí dos equipos distintos para comenzar.');
            $next = ['pair' => $pair, 'reason' => 'Primer cruce elegido para la fecha.'];
        } else {
            $next = count($teams) === 4 ? live_four_next($state, $teams) : live_three_next($state, $teams);
        }
        $games[] = live_new_game($next['pair'], $state['duration'], $next['reason']);
        return $state;
    }
    if ($action === 'close') {
        if (!$games || $games[$index]['status'] !== 'finished') throw new RuntimeException('Finaliza el partido en curso antes de cerrar la fecha.');
        $state['closed'] = true;
        return $state;
    }
    if ($index < 0) throw new RuntimeException('Primero elegí los equipos iniciales.');
    $game = &$games[$index];
    if ($action === 'correct_game') {
        $editIndex = (int) ($input['game'] ?? -1);
        if (!isset($games[$editIndex]) || $games[$editIndex]['status'] !== 'finished') throw new RuntimeException('Solo se pueden corregir partidos finalizados.');
        $edited = &$games[$editIndex];
        $scores = $input['scores'] ?? [];
        foreach ($edited['teams'] as $t) {
            $value = filter_var($scores[$t] ?? null, FILTER_VALIDATE_INT);
            if ($value === false || $value < 0 || $value > 100) throw new RuntimeException('Los goles deben estar entre 0 y 100.');
            while (live_score($edited)[$t] > $value) {
                for ($i = count($edited['goals']) - 1; $i >= 0; $i--) {
                    if ($edited['goals'][$i]['team'] === $t) { array_splice($edited['goals'], $i, 1); break; }
                }
            }
            while (live_score($edited)[$t] < $value) $edited['goals'][] = ['team' => $t, 'player' => null, 'own' => false, 'at' => null];
        }
        $edited['first_goal_known'] = false;
        $edited['tie_choice'] = null;
        [$a, $b] = $edited['teams'];
        if (!$state['closed'] && $editIndex === 0 && (int) $scores[$a] === (int) $scores[$b]) {
            $choice = (int) ($input['tie_choice'] ?? 0);
            if (!in_array($choice, $edited['teams'], true)) throw new RuntimeException('En empate, indicá el primer equipo en marcar; con 0–0, quién tiene prioridad.');
            $edited['tie_choice'] = $choice;
        }
        return $state;
    }
    if ($action === 'edit_goal') {
        // Attribution remains editable after the game; results and subsequent pairings do not change.
        $editIndex = (int) ($input['game'] ?? $index);
        if (!isset($games[$editIndex])) throw new RuntimeException('Partido inválido.');
        $goalIndex = (int) ($input['goal'] ?? -1);
        if (!isset($games[$editIndex]['goals'][$goalIndex])) throw new RuntimeException('Gol inválido.');
        $goal = &$games[$editIndex]['goals'][$goalIndex];
        $newPlayer = (int) ($input['player'] ?? 0);
        if ($goal['player'] === null && !$goal['own'] && empty($input['own']) && $newPlayer > 0 && ($state['pending_scorers'][$newPlayer] ?? 0) > 0) $state['pending_scorers'][$newPlayer]--;
        $goal = live_validate_goal($goal['team'], $input, $games[$editIndex], $participants) + ['at' => $goal['at']];
        return $state;
    }
    if ($action === 'remove_goal' && (int) ($input['game'] ?? $index) !== $index) throw new RuntimeException('Solo podés quitar goles del último partido antes de preparar el siguiente.');
    if ($action === 'remove_goal' && $game['status'] === 'finished') {
        $editIndex = (int) ($input['game'] ?? $index);
        if ($editIndex !== $index) throw new RuntimeException('Solo podés quitar goles del último partido antes de preparar el siguiente.');
        $goalIndex = (int) ($input['goal'] ?? -1);
        if (!isset($game['goals'][$goalIndex])) throw new RuntimeException('Gol inválido.');
        array_splice($game['goals'], $goalIndex, 1);
        $game['tie_choice'] = null;
        $score = live_score($game);
        if ($index === 0 && $score[$game['teams'][0]] === $score[$game['teams'][1]] && (!$game['goals'] || !$game['first_goal_known'])) {
            $choice = (int) ($input['tie_choice'] ?? 0);
            if (!in_array($choice, $game['teams'], true)) throw new RuntimeException('En empate, indicá el primer equipo en marcar; con 0–0, quién tiene prioridad.');
            $game['tie_choice'] = $choice;
        }
        return $state;
    }
    if ($game['status'] === 'finished') throw new RuntimeException('El partido ya terminó. Podés completar sus goleadores.');
    if ($action === 'start') {
        if ($game['running_since'] !== null) throw new RuntimeException('El cronómetro ya está en marcha.');
        $game['status'] = 'playing';
        $game['running_since'] = $now;
    } elseif ($action === 'pause') {
        if ($game['running_since'] === null) throw new RuntimeException('El cronómetro ya está pausado.');
        $game['elapsed'] = live_elapsed($game, $now);
        $game['running_since'] = null;
        $game['status'] = 'paused';
    } elseif ($action === 'goal') {
        if (count($game['goals']) >= 200) throw new RuntimeException('Se alcanzó el máximo de goles del partido.');
        $goal = live_validate_goal((int) ($input['team'] ?? 0), $input, $game, $participants);
        $game['goals'][] = $goal + ['at' => (int) floor(live_elapsed($game, $now))];
        if ($game['status'] === 'ready') $game['first_goal_known'] = false;
        $game['tie_choice'] = null;
    } elseif ($action === 'remove_goal') {
        $goalIndex = (int) ($input['goal'] ?? -1);
        if (!isset($game['goals'][$goalIndex])) throw new RuntimeException('Gol inválido.');
        array_splice($game['goals'], $goalIndex, 1);
        $game['tie_choice'] = null;
    } elseif ($action === 'set_score') {
        $scores = $input['scores'] ?? [];
        foreach ($game['teams'] as $t) {
            $value = filter_var($scores[$t] ?? null, FILTER_VALIDATE_INT);
            if ($value === false || $value < 0 || $value > 100) throw new RuntimeException('Los goles deben ser números enteros entre 0 y 100.');
            $current = live_score($game)[$t];
            if ($value < $current) throw new RuntimeException('Para bajar el resultado, quitá el gol correspondiente del historial.');
            for ($i = $current; $i < $value; $i++) $game['goals'][] = ['team' => $t, 'player' => null, 'own' => false, 'at' => null];
        }
        $game['first_goal_known'] = false;
        $game['tie_choice'] = null;
    } elseif ($action === 'finish') {
        $score = live_score($game);
        [$a, $b] = $game['teams'];
        if ($index === 0 && $score[$a] === $score[$b] && (!$game['goals'] || !$game['first_goal_known'])) {
            $choice = (int) ($input['tie_choice'] ?? 0);
            if (!in_array($choice, $game['teams'], true)) throw new RuntimeException($game['goals'] ? 'Indicá qué equipo marcó el primer gol.' : 'El partido terminó 0–0. Elegí quién sigue o toma el lugar del ganador.');
            $game['tie_choice'] = $choice;
        }
        $game['elapsed'] = live_elapsed($game, $now);
        $game['running_since'] = null;
        $game['status'] = 'finished';
    } else throw new RuntimeException('Acción desconocida.');
    return $state;
}

function live_validate_goal(int $team, array $input, array $game, array $participants): array
{
    if (!in_array($team, $game['teams'], true)) throw new RuntimeException('El equipo no juega este partido.');
    $playerId = (int) ($input['player'] ?? 0);
    $own = !empty($input['own']);
    if ($own) $playerId = 0;
    if ($playerId > 0) {
        $found = false;
        foreach ($participants as $p) {
            if ((int) $p['id'] !== $playerId) continue;
            $playerTeam = (int) $p['team_number'];
            $found = in_array($playerTeam, $game['teams'], true) && ($own ? $playerTeam !== $team : $playerTeam === $team);
        }
        if (!$found) throw new RuntimeException('El goleador debe pertenecer al equipo correspondiente.');
    }
    return ['team' => $team, 'player' => $playerId > 0 ? $playerId : null, 'own' => $own];
}

function live_pairs(array $teams): array
{
    $pairs = [];
    foreach ($teams as $i => $a) foreach (array_slice($teams, $i + 1) as $b) $pairs[] = [$a, $b];
    return $pairs;
}

function live_streak(array $games, int $team): int
{
    $count = 0;
    foreach (array_reverse($games) as $game) {
        if (!in_array($team, $game['teams'], true)) break;
        $count++;
    }
    return $count;
}

function live_four_next(array $state, array $teams): array
{
    $games = $state['games'];
    $n = count($games);
    // The return leg, then optional individual games, repeat the agreed six-game sequence.
    if ($n >= 6) return ['pair' => $games[$n % 6]['teams'], 'reason' => $n < 12 ? 'Vuelta: se repite el orden de la ida.' : 'Partido adicional: continúa la secuencia.'];
    if ($n === 1) return ['pair' => array_values(array_diff($teams, $games[0]['teams'])), 'reason' => 'Salen ambos equipos; entran los dos que descansaban.'];
    if ($n === 2) {
        $winnerA = live_winner($games[0]);
        $winnerB = live_winner($games[1], false);
        $loserA = array_values(array_diff($games[0]['teams'], [$winnerA]))[0];
        $loserB = array_values(array_diff($games[1]['teams'], [$winnerB]))[0];
        $crosses = [[$winnerA, $loserB], [$loserA, $winnerB]];
        return ['pair' => $crosses[random_int(0, 1)], 'reason' => 'Sorteo entre los cruces de ganador contra perdedor.'];
    }
    if ($n === 3 || $n === 5) return ['pair' => array_values(array_diff($teams, $games[$n - 1]['teams'])), 'reason' => 'Entran los dos equipos que descansaban.'];
    $played = array_map(static fn(array $g): string => live_pair_key($g['teams']), $games);
    $remaining = array_values(array_filter(live_pairs($teams), static fn(array $p): bool => !in_array(live_pair_key($p), $played, true)));
    return ['pair' => $remaining[random_int(0, count($remaining) - 1)], 'reason' => 'Sorteo entre los cruces pendientes de la ida.'];
}

function live_three_can_complete(array $pairs, array $remaining, array $history): bool
{
    if (array_sum($remaining) === 0) return true;
    foreach ($pairs as $i => $pair) {
        if ($remaining[$i] === 0) continue;
        if (array_filter($pair, static fn(int $t): bool => live_streak($history, $t) >= 2)) continue;
        $next = $remaining;
        $next[$i]--;
        if (live_three_can_complete($pairs, $next, [...$history, ['teams' => $pair]])) return true;
    }
    return false;
}

function live_three_next(array $state, array $teams): array
{
    $games = $state['games'];
    $last = $games[count($games) - 1];
    $waiting = array_values(array_diff($teams, $last['teams']))[0];
    $winner = live_winner($last, count($games) === 1);
    $stay = $winner;
    foreach ($last['teams'] as $team) {
        if (live_streak($games, $team) >= 2) $stay = array_values(array_diff($last['teams'], [$team]))[0];
    }
    $preferred = [$stay, $waiting];
    if (count($games) >= 6) return ['pair' => $preferred, 'reason' => 'Partido adicional: ganador sigue, con salida obligatoria al completar dos partidos seguidos.'];
    $pairs = live_pairs($teams);
    $remaining = array_fill(0, count($pairs), 2);
    foreach ($games as $game) foreach ($pairs as $i => $pair) {
        if (live_pair_key($game['teams']) === live_pair_key($pair)) $remaining[$i]--;
    }
    usort($pairs, static fn(array $a, array $b): int => (live_pair_key($a) === live_pair_key($preferred) ? 0 : 1) <=> (live_pair_key($b) === live_pair_key($preferred) ? 0 : 1));
    // Re-key counts after ordering by sporting preference.
    $remaining = [];
    foreach ($pairs as $pair) $remaining[] = 2 - count(array_filter($games, static fn(array $g): bool => live_pair_key($g['teams']) === live_pair_key($pair)));
    foreach ($pairs as $i => $pair) {
        if ($remaining[$i] <= 0 || array_filter($pair, static fn(int $t): bool => live_streak($games, $t) >= 2)) continue;
        $rest = $remaining;
        $rest[$i]--;
        if (!live_three_can_complete($pairs, $rest, [...$games, ['teams' => $pair]])) continue;
        return ['pair' => $pair, 'reason' => live_pair_key($pair) === live_pair_key($preferred)
            ? ($stay === $winner ? 'Sigue el ganador o quien tiene prioridad en el empate; entra el equipo que descansaba.' : 'El equipo que completó dos partidos seguidos descansa.')
            : 'Cruce pendiente: se prioriza completar dos enfrentamientos por pareja, sin jugar tres partidos seguidos.'];
    }
    throw new RuntimeException('No se pudo completar la secuencia de cruces.');
}

function live_standings(array $state, array $teams): array
{
    $rows = [];
    foreach ($teams as $t) $rows[$t] = ['team' => $t, 'played' => 0, 'points' => 0, 'gf' => 0, 'ga' => 0, 'wins' => 0, 'draws' => 0, 'losses' => 0];
    foreach ($state['games'] as $game) {
        if ($game['status'] !== 'finished') continue;
        [$a, $b] = $game['teams'];
        $score = live_score($game);
        foreach ([[$a, $b], [$b, $a]] as [$t, $opponent]) {
            $rows[$t]['played']++;
            $rows[$t]['gf'] += $score[$t];
            $rows[$t]['ga'] += $score[$opponent];
            $result = $score[$t] <=> $score[$opponent];
            $rows[$t]['points'] += $result > 0 ? 3 : ($result === 0 ? 1 : 0);
            $rows[$t][$result > 0 ? 'wins' : ($result === 0 ? 'draws' : 'losses')]++;
        }
    }
    usort($rows, static fn(array $a, array $b): int => ($b['points'] <=> $a['points']) ?: (($b['gf'] - $b['ga']) <=> ($a['gf'] - $a['ga'])) ?: ($b['gf'] <=> $a['gf']) ?: ($a['team'] <=> $b['team']));
    return $rows;
}
