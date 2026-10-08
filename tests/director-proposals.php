<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/director_proposals.php';
ensure_director_proposals_schema();
$pdo = db();
$users = [];
$matches = [];
$checks = 0;
function check_proposal(bool $condition, string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function reject_proposal(callable $operation, string $message): void {
    $rejected = false;
    try { $operation(); } catch (RuntimeException) { $rejected = true; }
    check_proposal($rejected, $message);
}
function proposal_session(int $id, string $role): void {
    $_SESSION = ['user_id' => $id, 'user_role' => $role, 'is_admin' => $role === 'admin'];
}
try {
    $settingsBefore = admin_config_settings();
    reject_proposal(fn() => admin_config_save_settings(['director_proposal_start_hours' => 1, 'director_proposal_lock_hours' => 2]), 'Acepta un inicio posterior al cierre.');
    check_proposal(admin_config_settings() === $settingsBefore, 'Una configuracion invalida modifica los ajustes.');
    $prefix = 'proposal_test_' . bin2hex(random_bytes(6));
    foreach (['directivo', 'directivo', 'usuario', 'jugador', 'admin', 'directivo'] as $index => $role) {
        $pdo->prepare('INSERT INTO site_users (username, password_hash, role) VALUES (?, ?, ?)')->execute([$prefix . '_' . $index, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), $role]);
        $users[] = (int) $pdo->lastInsertId();
    }
    $players = array_slice(repo_all_players(true), 0, 12);
    check_proposal(count($players) === 12, 'Se necesitan 12 jugadores locales para la prueba.');
    $teams = [];
    foreach (array_chunk($players, 6) as $index => $roster) {
        $rows = [];
        foreach ($roster as $order => $player) $rows[] = ['id' => (int) $player['id'], 'name' => $player['name'], 'assigned_position' => ['ARQ', 'DEF', 'DEF', 'MED', 'DEL', 'DEL'][$order], 'is_goalkeeper' => $order === 0 ? 1 : 0, 'is_substitute' => $order === 5 ? 1 : 0, 'availability_percent' => 85, 'lineup_order' => $order + 1, 'formation_line_order' => 1, 'rating' => 3];
        $teams[] = ['team_number' => $index + 1, 'team_name' => 'Equipo ' . ($index + 1), 'color_name' => $index ? 'AZUL' : 'ROSA', 'total_skill' => 15, 'formation_name' => '2-1-1', 'players' => $rows];
    }
    foreach (['winner', 'tie', 'no_votes', 'manual', 'timed', 'admin_tie'] as $scenario) {
        $pdo->prepare('INSERT INTO matches (title, match_date, num_teams, players_per_team, status, draw_mode) VALUES (?, ?, 2, 6, "programado", "none")')->execute([$prefix . '_' . $scenario, date('Y-m-d H:i:s', time() + 10 * 86400)]);
        $mid = (int) $pdo->lastInsertId();
        $matches[] = $mid;
        if ($scenario === 'winner') {
            $pdo->prepare('INSERT INTO matches (title, match_date, num_teams, players_per_team, status, draw_mode) VALUES (?, ?, 2, 6, "programado", "none")')->execute([$prefix . '_old', date('Y-m-d H:i:s', time() - 10 * 86400)]);
            $matches[] = (int) $pdo->lastInsertId();
            check_proposal((int) director_proposal_latest_match()['id'] === $mid, 'La pagina de propuestas elige una fecha vieja.');
        }
        if ($scenario === 'winner') {
            proposal_session($users[0], 'directivo');
            check_proposal(!director_proposal_roster_ready(repo_match_by_id($mid)), 'Habilita propuestas sin convocados.');
            reject_proposal(fn() => director_proposals_start($mid), 'Permite iniciar propuestas con la convocatoria incompleta.');
            check_proposal(empty(repo_match_by_id($mid)['director_proposals_enabled']), 'Una convocatoria incompleta habilita propuestas.');
        }
        if ($scenario === 'winner') $pdo->prepare('UPDATE matches SET team_kits_json = ? WHERE id = ?')->execute([json_encode(['CAMISADO', 'DESCAMISADO']), $mid]);
        foreach ($players as $player) $pdo->prepare('INSERT INTO match_players (match_id, player_id) VALUES (?, ?)')->execute([$mid, $player['id']]);
        proposal_session($users[0], 'directivo');
        director_proposals_start($mid);
        $settings = admin_config_settings();
        check_proposal((int) repo_match_by_id($mid)['multi_draw_lock_minutes'] === (int) $settings['director_proposal_lock_minutes'], 'No aplica el cierre configurado.');
        check_proposal((int) repo_match_by_id($mid)['director_vote_start_minutes'] === (int) $settings['director_proposal_start_minutes'], 'No aplica el inicio configurado.');
        director_proposal_publish($mid, $teams, 0);
        if ($scenario === 'winner') check_proposal(array_column(director_proposal_for_user($mid)['teams'], 'color_name') === ['CAMISADO', 'DESCAMISADO'], 'No conserva las camisetas elegidas por el admin.');
        director_proposal_publish($mid, $teams, 0.25);
        check_proposal(count(multiple_draw_options($mid)) === 1 && (float) multiple_draw_options($mid)[0]['total_diff'] === 0.25, 'No actualiza la propuesta propia sin duplicarla.');
        if ($scenario === 'winner') {
            check_proposal(!director_proposals_are_visible(repo_match_by_id($mid)), 'Muestra propuestas antes del inicio sin habilitacion del admin.');
            proposal_session($users[1], 'directivo');
            director_proposal_restart($mid);
            check_proposal(count(multiple_draw_options($mid)) === 1, 'Borra una propuesta de otro directivo.');
            proposal_session($users[0], 'directivo');
            director_proposal_restart($mid);
            check_proposal(!multiple_draw_options($mid), 'No permite reiniciar la propuesta propia.');
            director_proposal_publish($mid, $teams, 0.25);
        }
        reject_proposal(fn() => multiple_draw_generate($mid, 3, true), 'Permite reemplazar propuestas por variantes.');
        proposal_session($users[1], 'directivo');
        director_proposal_publish($mid, $teams, 0);
        $options = multiple_draw_options($mid);
        $first = (int) $options[0]['id']; $second = (int) $options[1]['id'];
        check_proposal(count($options) === 2 && (int) $options[0]['author_user_id'] === $users[0] && !isset($options[0]['author_name']), 'No conserva el autor interno o expone su nombre.');
        if ($scenario === 'tie') {
            proposal_session($users[5], 'directivo');
            director_proposal_publish($mid, $teams, 0.1);
        }
        reject_proposal(fn() => director_proposal_vote($mid, $first), 'El directivo pudo votar.');
        proposal_session($users[2], 'usuario');
        reject_proposal(fn() => director_proposal_vote($mid, $first), 'Permite votar antes del inicio.');
        $scheduled = repo_match_by_id($mid);
        check_proposal(!multiple_draw_is_open($scheduled) && director_proposal_can_edit($scheduled), 'No distingue preparacion de votacion.');
        $minutes = intdiv((int) $scheduled['director_vote_start_minutes'] + (int) $scheduled['multi_draw_lock_minutes'], 2);
        if (in_array($scenario, ['manual', 'timed'], true)) {
            reject_proposal(fn() => director_proposal_open_voting($mid, 60), 'Un usuario abre la votacion.');
            proposal_session($users[4], 'admin');
            reject_proposal(fn() => director_proposal_open_voting($mid, 0), 'Acepta duracion cero.');
            director_proposal_open_voting($mid, 60);
            $opened = repo_match_by_id($mid);
            check_proposal(abs(multiple_draw_deadline($opened) - time() - 3600) <= 2, 'No respeta la duracion manual.');
            check_proposal(director_proposals_are_visible($opened), 'Inicio manual no revela propuestas.');
            reject_proposal(fn() => director_proposal_open_voting($mid, 120), 'Reinicia una votacion abierta.');
        } else {
        $pdo->prepare('UPDATE matches SET match_date = ? WHERE id = ?')->execute([date('Y-m-d H:i:s', time() + $minutes * 60), $mid]);
        }
        check_proposal(multiple_draw_is_open(repo_match_by_id($mid)) && !director_proposal_can_edit(repo_match_by_id($mid)), 'No bloquea al empezar la votacion.');
        proposal_session($users[0], 'directivo');
        reject_proposal(fn() => director_proposal_publish($mid, $teams, 0.5), 'Permite modificar al iniciar la votacion.');
        reject_proposal(fn() => director_proposal_restart($mid), 'Permite reiniciar despues del inicio.');
        proposal_session($users[1], 'directivo');
        reject_proposal(fn() => director_proposals_start($mid), 'Permite crear nuevas propuestas al votar.');

        if ($scenario !== 'no_votes') {
            proposal_session($users[2], 'usuario');
            director_proposal_vote($mid, $first);
            director_proposal_vote($mid, $second);
            $options = multiple_draw_options($mid);
            check_proposal((int) $options[0]['vote_count'] === 0 && (int) $options[1]['vote_count'] === 1, 'Cambiar voto lo duplica.');
            proposal_session($users[0], 'directivo');
            reject_proposal(fn() => director_proposal_publish($mid, $teams, 0.5), 'Permite editar con votos abiertos.');
            check_proposal((int) director_proposal_for_user($mid)['id'] === $first && (int) multiple_draw_options($mid)[1]['vote_count'] === 1, 'Editar cambia la identidad de la propuesta o los votos de otra.');
            proposal_session($users[2], 'usuario');
            reject_proposal(fn() => director_proposal_vote($mid, 0), 'Acepta una opcion invalida.');
            if (in_array($scenario, ['tie', 'admin_tie'], true)) {
                proposal_session($users[3], 'jugador');
                director_proposal_vote($mid, $first);
            }
        }
        reject_proposal(fn() => multiple_draw_apply_option($mid, $second), 'Publica antes del cierre.');
        if ($scenario === 'admin_tie') {
            proposal_session($users[4], 'admin');
            reject_proposal(fn() => director_proposal_close_voting($mid, 999999999), 'Acepta una propuesta inexistente al cerrar.');
            check_proposal(multiple_draw_is_open(repo_match_by_id($mid)), 'Una eleccion invalida cierra la votacion.');
            director_proposal_close_voting($mid, $first);
            check_proposal((int) repo_match_by_id($mid)['multi_draw_winner_option_id'] === $first, 'No respeta la eleccion del admin en empate.');
        } elseif ($scenario === 'manual') {
            reject_proposal(fn() => director_proposal_close_voting($mid), 'Un usuario cierra la votacion.');
            proposal_session($users[4], 'admin');
            director_proposal_close_voting($mid);
            check_proposal((int) repo_match_by_id($mid)['multi_draw_winner_option_id'] === $second, 'Cierre manual no publica ganador.');
        } elseif ($scenario === 'timed') {
            $pdo->prepare('UPDATE matches SET director_vote_closes_at = ? WHERE id = ?')->execute([date('Y-m-d H:i:s', time() - 1), $mid]);
        } else {
        $pdo->prepare('UPDATE matches SET match_date = ? WHERE id = ?')->execute([date('Y-m-d H:i:s', time() - 60), $mid]);
        }
        proposal_session($users[2], 'usuario');
        reject_proposal(fn() => director_proposal_vote($mid, $first), 'Acepta votos tarde.');
        proposal_session($users[0], 'directivo');
        reject_proposal(fn() => director_proposal_publish($mid, $teams, 0), 'Acepta modificar la propuesta despues del cierre.');
        proposal_session($users[2], 'usuario');
        $applied = multiple_draw_finalize_if_due(repo_match_by_id($mid));
        if (in_array($scenario, ['winner', 'manual', 'timed'], true)) {
            check_proposal($applied || $scenario === 'manual', 'No aplica ganador unico.');
            check_proposal((int) repo_match_by_id($mid)['multi_draw_winner_option_id'] === $second, 'No gana el mas votado.');
            check_proposal(!multiple_draw_finalize_if_due(repo_match_by_id($mid)), 'Publicacion no idempotente.');
        } else {
            check_proposal($applied || $scenario === 'admin_tie', 'No sortea el empate o la ausencia de votos.');
            check_proposal(in_array((int) repo_match_by_id($mid)['multi_draw_winner_option_id'], [$first, $second], true), 'El sorteo elige una propuesta ajena.');
            check_proposal(!multiple_draw_finalize_if_due(repo_match_by_id($mid)), 'El sorteo cambia un ganador ya publicado.');
        }
        check_proposal(repo_match_teams_are_public(repo_match_by_id($mid)), 'Ganador no queda publicado.');
        $saved = repo_match_participants($mid);
        check_proposal(count(array_filter($saved, static fn(array $p): bool => !empty($p['is_substitute']))) === 2, 'Se pierden suplentes.');
        check_proposal((int) $saved[0]['availability_percent'] === 85, 'Se pierde disponibilidad.');
    }
    echo "OK: {$checks} verificaciones de propuestas, votos y cierre.\n";
} finally {
    foreach ($matches as $mid) {
        foreach (['captain_picks', 'captain_drafts', 'match_teams', 'match_players'] as $table) $pdo->prepare("DELETE FROM {$table} WHERE match_id = ?")->execute([$mid]);
        $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$mid]);
    }
    foreach ($users as $uid) $pdo->prepare('DELETE FROM site_users WHERE id = ?')->execute([$uid]);
}
