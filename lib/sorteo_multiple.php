<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/formation_view.php';
require_once __DIR__ . '/repository.php';
require_once __DIR__ . '/sorteo.php';
require_once __DIR__ . '/schema.php';

function ensure_multiple_draw_schema(): void
{
    ensure_auth_schema();
    ensure_control_schema();
    $pdo = db();
    if (!schema_column_exists($pdo, 'matches', 'multi_draw_count')) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN multi_draw_count TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER redraw_count');
    }
    if (!schema_column_exists($pdo, 'matches', 'multi_draw_lock_minutes')) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN multi_draw_lock_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER multi_draw_count');
    }
    if (!schema_column_exists($pdo, 'matches', 'multi_draw_winner_option_id')) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN multi_draw_winner_option_id INT UNSIGNED NULL AFTER multi_draw_lock_minutes');
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS match_draw_options (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            match_id INT UNSIGNED NOT NULL,
            option_number TINYINT UNSIGNED NOT NULL,
            teams_json MEDIUMTEXT NOT NULL,
            total_diff DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            selected_at DATETIME NULL,
            UNIQUE KEY uniq_match_draw_option (match_id, option_number),
            INDEX idx_match_draw_option_match (match_id),
            CONSTRAINT fk_match_draw_options_match
              FOREIGN KEY (match_id) REFERENCES matches(id)
              ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS match_draw_option_votes (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            match_id INT UNSIGNED NOT NULL,
            option_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            player_id INT UNSIGNED NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_match_draw_vote_user (match_id, user_id),
            INDEX idx_match_draw_vote_option (option_id),
            CONSTRAINT fk_match_draw_votes_match
              FOREIGN KEY (match_id) REFERENCES matches(id)
              ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_match_draw_votes_option
              FOREIGN KEY (option_id) REFERENCES match_draw_options(id)
              ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_match_draw_votes_user
              FOREIGN KEY (user_id) REFERENCES site_users(id)
              ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_match_draw_votes_player
              FOREIGN KEY (player_id) REFERENCES players(id)
              ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function multiple_draw_deadline(array $match): int
{
    $matchTime = strtotime((string) ($match['match_date'] ?? ''));
    if ($matchTime === false) {
        return time();
    }
    $minutes = max(0, (int) ($match['multi_draw_lock_minutes'] ?? 60));
    return $matchTime - ($minutes * 60);
}

function multiple_draw_is_open(array $match): bool
{
    return (string) ($match['status'] ?? '') === 'programado'
        && empty($match['multi_draw_winner_option_id'])
        && time() < multiple_draw_deadline($match);
}

function multiple_draw_participant_ids(int $matchId): array
{
    $stmt = db()->prepare('SELECT player_id FROM match_players WHERE match_id = :mid ORDER BY player_id ASC');
    $stmt->execute(['mid' => $matchId]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function multiple_draw_user_can_vote(array $match): bool
{
    if (!is_player_user()) {
        return false;
    }
    $playerId = current_player_id();
    if ($playerId <= 0 || !multiple_draw_is_open($match)) {
        return false;
    }
    return in_array($playerId, multiple_draw_participant_ids((int) $match['id']), true);
}

function multiple_draw_options(int $matchId): array
{
    ensure_multiple_draw_schema();
    $stmt = db()->prepare(
        'SELECT o.*,
                (SELECT COUNT(*) FROM match_draw_option_votes v WHERE v.option_id = o.id) AS vote_count
         FROM match_draw_options o
         WHERE o.match_id = :mid
         ORDER BY o.option_number ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    $options = $stmt->fetchAll();
    foreach ($options as &$option) {
        $decoded = json_decode((string) $option['teams_json'], true);
        $option['teams'] = is_array($decoded) ? $decoded : [];
    }
    unset($option);
    return $options;
}

function multiple_draw_vote_for_user(int $matchId, int $userId): int
{
    ensure_multiple_draw_schema();
    $stmt = db()->prepare('SELECT option_id FROM match_draw_option_votes WHERE match_id = :mid AND user_id = :uid LIMIT 1');
    $stmt->execute(['mid' => $matchId, 'uid' => $userId]);
    return (int) ($stmt->fetchColumn() ?: 0);
}

function multiple_draw_generate(int $matchId, int $count, bool $replace = false): void
{
    ensure_multiple_draw_schema();
    $match = repo_match_by_id($matchId);
    if (!$match) {
        throw new RuntimeException('Fecha no encontrada.');
    }
    if ((string) ($match['status'] ?? '') === 'finalizado') {
        throw new RuntimeException('La fecha ya esta finalizada.');
    }
    $players = repo_match_participants_basic($matchId);
    $numTeams = max(2, min(4, (int) ($match['num_teams'] ?? 2)));
    if (!$players || (count($players) % $numTeams) !== 0) {
        throw new RuntimeException('La cantidad de jugadores debe ser divisible por la cantidad de equipos.');
    }
    $count = max(1, min(10, $count));
    $maxDiff = max(0.1, (float) ($match['max_diff'] ?? 0.5));
    $colors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO'];

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($replace) {
            $pdo->prepare('DELETE FROM match_draw_options WHERE match_id = :mid')->execute(['mid' => $matchId]);
            $pdo->prepare('UPDATE matches SET multi_draw_winner_option_id = NULL WHERE id = :mid')->execute(['mid' => $matchId]);
        }

        $signatureSeen = [];
        $insert = $pdo->prepare(
            'INSERT INTO match_draw_options (match_id, option_number, teams_json, total_diff)
             VALUES (:mid, :option_number, :teams_json, :total_diff)
             ON DUPLICATE KEY UPDATE teams_json = VALUES(teams_json), total_diff = VALUES(total_diff), generated_at = CURRENT_TIMESTAMP, selected_at = NULL'
        );
        $created = 0;
        for ($attempt = 0; $created < $count && $attempt < ($count * 20); $attempt++) {
            $teams = generate_valid_teams($players, $numTeams, $maxDiff, 25000);
            if (!$teams) {
                throw new RuntimeException('No se pudo generar un sorteo valido con la configuracion actual.');
            }
            $teamSignatures = [];
            foreach ($teams as $team) {
                $ids = array_map(static fn(array $p): string => (string) (int) $p['id'], $team['players']);
                sort($ids, SORT_STRING);
                $teamSignatures[] = implode(',', $ids);
            }
            sort($teamSignatures, SORT_STRING);
            $signature = implode('|', $teamSignatures);
            if (isset($signatureSeen[$signature])) {
                continue;
            }
            $signatureSeen[$signature] = true;

            $scores = [];
            $payload = [];
            foreach ($teams as $team) {
                $teamNumber = (int) $team['team_number'];
                $scores[] = (float) $team['total_skill'];
                $playersPayload = [];
                foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $line) {
                    foreach (($team['line_players'][$line] ?? []) as $lineOrder => $player) {
                        $playersPayload[] = [
                            'id' => (int) $player['id'],
                            'name' => (string) $player['name'],
                            'assigned_position' => $line,
                            'is_goalkeeper' => $line === 'ARQ' ? 1 : 0,
                            'lineup_order' => count($playersPayload) + 1,
                            'formation_line_order' => $lineOrder + 1,
                            'rating' => player_overall_rating($player),
                        ];
                    }
                }
                $payload[] = [
                    'team_number' => $teamNumber,
                    'team_name' => 'Equipo ' . $teamNumber,
                    'color_name' => $colors[$teamNumber] ?? '',
                    'total_skill' => round((float) $team['total_skill'], 1),
                    'formation_name' => implode('-', [
                        count($team['line_players']['ARQ'] ?? []),
                        count($team['line_players']['DEF'] ?? []),
                        count($team['line_players']['MED'] ?? []),
                        count($team['line_players']['DEL'] ?? []),
                    ]),
                    'players' => $playersPayload,
                ];
            }
            $insert->execute([
                'mid' => $matchId,
                'option_number' => $created + 1,
                'teams_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'total_diff' => $scores ? round(max($scores) - min($scores), 2) : 0,
            ]);
            $created++;
        }
        if ($created < $count) {
            throw new RuntimeException('No se pudieron generar suficientes variantes distintas.');
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function multiple_draw_save_vote(int $matchId, int $optionId): void
{
    ensure_multiple_draw_schema();
    $match = repo_match_by_id($matchId);
    if (!$match || !multiple_draw_user_can_vote($match)) {
        throw new RuntimeException('No podes votar este sorteo.');
    }
    $stmt = db()->prepare('SELECT COUNT(*) FROM match_draw_options WHERE id = :oid AND match_id = :mid');
    $stmt->execute(['oid' => $optionId, 'mid' => $matchId]);
    if ((int) $stmt->fetchColumn() <= 0) {
        throw new RuntimeException('Opcion invalida.');
    }
    $save = db()->prepare(
        'INSERT INTO match_draw_option_votes (match_id, option_id, user_id, player_id)
         VALUES (:mid, :oid, :uid, :pid)
         ON DUPLICATE KEY UPDATE option_id = VALUES(option_id), player_id = VALUES(player_id), updated_at = CURRENT_TIMESTAMP'
    );
    $save->execute([
        'mid' => $matchId,
        'oid' => $optionId,
        'uid' => current_user_id(),
        'pid' => current_player_id(),
    ]);
}

function multiple_draw_winning_option_id(int $matchId): int
{
    $stmt = db()->prepare(
        'SELECT o.id
         FROM match_draw_options o
         LEFT JOIN match_draw_option_votes v ON v.option_id = o.id
         WHERE o.match_id = :mid
         GROUP BY o.id, o.option_number, o.total_diff
         ORDER BY COUNT(v.id) DESC, o.total_diff ASC, o.option_number ASC
         LIMIT 1'
    );
    $stmt->execute(['mid' => $matchId]);
    return (int) ($stmt->fetchColumn() ?: 0);
}

function multiple_draw_apply_option(int $matchId, int $optionId): void
{
    ensure_multiple_draw_schema();
    $match = repo_match_by_id($matchId);
    if (!$match) {
        throw new RuntimeException('Fecha no encontrada.');
    }
    if ((string) ($match['status'] ?? '') === 'finalizado') {
        throw new RuntimeException('La fecha ya esta finalizada.');
    }
    $stmt = db()->prepare('SELECT * FROM match_draw_options WHERE id = :oid AND match_id = :mid LIMIT 1');
    $stmt->execute(['oid' => $optionId, 'mid' => $matchId]);
    $option = $stmt->fetch();
    if (!$option) {
        throw new RuntimeException('Opcion invalida.');
    }
    $teams = json_decode((string) $option['teams_json'], true);
    if (!is_array($teams) || !$teams) {
        throw new RuntimeException('La opcion ganadora no tiene equipos validos.');
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare(
            'UPDATE match_players
             SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0, lineup_order = NULL, formation_line_order = NULL
             WHERE match_id = :mid'
        )->execute(['mid' => $matchId]);

        $saveTeam = $pdo->prepare(
            'INSERT INTO match_teams (match_id, team_number, team_name, total_skill, formation_name, formation_data, color_name)
             VALUES (:mid, :team_number, :team_name, :total_skill, :formation_name, :formation_data, :color_name)'
        );
        $savePlayer = $pdo->prepare(
            'UPDATE match_players
             SET team_number = :team_number, assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper,
                 lineup_order = :lineup_order, formation_line_order = :formation_line_order
             WHERE match_id = :mid AND player_id = :player_id'
        );
        foreach ($teams as $team) {
            $teamNumber = (int) ($team['team_number'] ?? 0);
            $players = is_array($team['players'] ?? null) ? $team['players'] : [];
            $saveTeam->execute([
                'mid' => $matchId,
                'team_number' => $teamNumber,
                'team_name' => (string) ($team['team_name'] ?? ('Equipo ' . $teamNumber)),
                'total_skill' => (float) ($team['total_skill'] ?? 0),
                'formation_name' => (string) ($team['formation_name'] ?? ''),
                'formation_data' => json_encode(array_map(static fn(array $p): array => [
                    'id' => (int) ($p['id'] ?? 0),
                    'position' => (string) ($p['assigned_position'] ?? 'MED'),
                ], $players), JSON_UNESCAPED_UNICODE),
                'color_name' => (string) ($team['color_name'] ?? ''),
            ]);
            foreach ($players as $player) {
                $savePlayer->execute([
                    'mid' => $matchId,
                    'player_id' => (int) ($player['id'] ?? 0),
                    'team_number' => $teamNumber,
                    'assigned_position' => (string) ($player['assigned_position'] ?? 'MED'),
                    'is_goalkeeper' => (int) ($player['is_goalkeeper'] ?? 0),
                    'lineup_order' => (int) ($player['lineup_order'] ?? 0),
                    'formation_line_order' => (int) ($player['formation_line_order'] ?? 0),
                ]);
            }
        }
        $teamSize = count($teams[0]['players'] ?? []);
        $pdo->prepare(
            'UPDATE matches
             SET status = "sorteado",
                 draw_mode = "random",
                 draw_started_at = COALESCE(draw_started_at, NOW()),
                 draw_completed_at = NOW(),
                 multi_draw_winner_option_id = :oid,
                 players_per_team = :players_per_team,
                 formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
             WHERE id = :mid'
        )->execute(['oid' => $optionId, 'players_per_team' => $teamSize, 'mid' => $matchId]);
        $pdo->prepare('UPDATE match_draw_options SET selected_at = IF(id = :oid, NOW(), NULL) WHERE match_id = :mid')
            ->execute(['oid' => $optionId, 'mid' => $matchId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function multiple_draw_finalize_if_due(array $match): bool
{
    if ((string) ($match['status'] ?? '') !== 'programado' || !empty($match['multi_draw_winner_option_id'])) {
        return false;
    }
    if (time() < multiple_draw_deadline($match)) {
        return false;
    }
    $winner = multiple_draw_winning_option_id((int) $match['id']);
    if ($winner <= 0) {
        return false;
    }
    multiple_draw_apply_option((int) $match['id'], $winner);
    return true;
}

function multiple_draw_player_card_rating(float $value): int
{
    return formation_view_card_rating($value);
}

function multiple_draw_render_pitch_view(array $option): string
{
    $html = '<div data-multi-draw-pitch-view hidden>';
    $html .= formation_view_render_pitch((array) ($option['teams'] ?? []), [
        'highlight_player_id' => current_player_id(),
    ]);
    $html .= '</div>';
    return $html;
}

function multiple_draw_render_option(array $option, bool $selected = false): string
{
    $currentPlayerId = current_player_id();
    $selectedClasses = $selected
        ? ' border-lime-200 bg-emerald-900/85 shadow-xl shadow-lime-200/10 ring-4 ring-lime-200/20'
        : ' border-lime-200/35 bg-emerald-950/85 shadow-md shadow-emerald-950/15';
    $html = '<article class="multi-draw-option h-full overflow-hidden rounded-2xl border p-3 text-lime-50 transition' . $selectedClasses . '">';
    $html .= '<button class="mb-3 flex w-full items-start justify-between gap-2 border-b border-lime-200/20 bg-transparent p-0 pb-2 text-left hover:[&_strong]:text-lime-200 focus-visible:[&_strong]:text-lime-200" type="button" data-multi-draw-pitch-toggle><div><strong class="block text-base font-black text-lime-50"><span data-multi-draw-pitch-label>Ver en cancha</span>: Opcion ' . h((string) $option['option_number']) . '</strong><small class="block text-xs font-semibold text-emerald-100/70">Diferencia ' . h(number_format((float) $option['total_diff'], 1)) . '</small></div><span class="inline-flex rounded-full bg-lime-100 px-2.5 py-1 text-xs font-black text-emerald-950">' . h((string) (int) ($option['vote_count'] ?? 0)) . ' votos</span></button>';
    $html .= '<div class="grid gap-2" data-multi-draw-list-view>';
    foreach (($option['teams'] ?? []) as $team) {
        $teamTotal = (float) ($team['total_skill'] ?? 0);
        $html .= '<section class="rounded-xl border border-lime-200/24 bg-emerald-900/45 p-2.5 max-[760px]:p-2">';
        $html .= '<h4 class="mb-2 flex items-center justify-between gap-2 text-sm leading-tight max-[760px]:mb-1.5 max-[760px]:flex-wrap max-[760px]:text-xs"><span class="min-w-0 flex-1 text-base font-black text-lime-50 max-[760px]:min-w-20 max-[760px]:text-sm">' . h((string) ($team['team_name'] ?? 'Equipo')) . '</span><em class="rounded-lg border border-lime-200/35 bg-emerald-950/70 px-2 py-1 text-[10px] font-black not-italic text-lime-100 max-[760px]:px-1.5 max-[760px]:py-0.5 max-[760px]:text-[9px]">General ' . h(number_format($teamTotal, 1)) . '</em><span class="rounded-lg bg-lime-100 px-2 py-1 text-[10px] font-black text-emerald-950 max-[760px]:rounded-md max-[760px]:px-1.5 max-[760px]:py-0.5 max-[760px]:text-[9px]">' . h((string) ($team['color_name'] ?? '')) . '</span></h4>';
        $html .= '<div class="grid gap-1">';
        foreach (($team['players'] ?? []) as $player) {
            $rating = (float) ($player['rating'] ?? 0);
            $position = (string) ($player['assigned_position'] ?? 'MED');
            $isCurrentPlayer = $currentPlayerId > 0 && (int) ($player['id'] ?? 0) === $currentPlayerId;
            $rowClasses = $isCurrentPlayer
                ? ' bg-lime-100 text-emerald-950 shadow-md shadow-lime-200/20 ring-2 ring-lime-200/35 [&_small]:text-emerald-950 [&_strong]:text-emerald-950'
                : ' bg-emerald-950/65 text-emerald-100';
            $chipClasses = $isCurrentPlayer ? 'bg-emerald-950 text-lime-100' : 'bg-emerald-800 text-lime-100';
            $html .= '<div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold max-[760px]:gap-1 max-[760px]:px-1.5 max-[760px]:py-1' . $rowClasses . '">';
            $html .= '<span class="inline-flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg border border-lime-200/20 bg-emerald-900 text-lime-100 leading-none max-[760px]:h-8 max-[760px]:w-8"><strong class="text-base font-black leading-none max-[760px]:text-xs">' . h((string) multiple_draw_player_card_rating($rating)) . '</strong><span class="mt-0.5 text-[7px] font-black leading-none max-[760px]:text-[6px]">GEN</span></span>';
            $html .= '<span class="min-w-0"><strong class="block min-w-0 truncate text-sm font-black text-lime-50 max-[760px]:text-[10px] max-[760px]:leading-tight">' . h((string) ($player['name'] ?? 'Jugador')) . ($isCurrentPlayer ? ' <em class="ml-1 rounded-full bg-emerald-950 px-1.5 py-0.5 text-[9px] font-black not-italic text-lime-100">Vos</em>' : '') . '</strong><small class="block min-w-0 truncate text-[10px] font-bold text-emerald-100/70 max-[760px]:text-[9px] max-[760px]:leading-tight">' . h(number_format($rating, 1)) . ' estrellas promedio</small></span>';
            $html .= '<strong class="inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-[10px] font-black max-[760px]:min-w-7 max-[760px]:rounded max-[760px]:px-1 max-[760px]:text-[9px] ' . $chipClasses . '">' . h($position) . '</strong>';
            $html .= '</div>';
        }
        $html .= '</div></section>';
    }
    $html .= '</div>';
    $html .= multiple_draw_render_pitch_view($option);
    $html .= '</article>';
    return $html;
}
