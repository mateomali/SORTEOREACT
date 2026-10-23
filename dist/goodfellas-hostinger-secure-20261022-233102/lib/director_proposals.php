<?php
declare(strict_types=1);

require_once __DIR__ . '/sorteo_multiple.php';
require_once __DIR__ . '/admin_config.php';
require_once __DIR__ . '/match_team_kits.php';

function ensure_director_proposals_schema(): void
{
    static $ready = false;
    if ($ready) return;
    ensure_multiple_draw_schema();
    ensure_admin_config_schema();
    foreach (['director_vote_opened_at', 'director_vote_closes_at'] as $column) {
        if (!schema_column_exists(db(), 'matches', $column)) db()->exec("ALTER TABLE matches ADD COLUMN {$column} DATETIME NULL");
    }
    $ready = true;
}

function director_proposal_latest_match(): ?array
{
    $id = (int) db()->query('SELECT id FROM matches WHERE status != "finalizado" AND match_date >= NOW() ORDER BY id DESC LIMIT 1')->fetchColumn();
    return $id > 0 ? repo_match_by_id($id) : null;
}

function director_proposal_open_voting(int $matchId, int $minutes): void
{
    ensure_director_proposals_schema();
    if (!is_admin()) throw new RuntimeException('Solo el administrador puede iniciar la votación.');
    if ($minutes < 1 || $minutes > 10080) throw new RuntimeException('Elegí una duración entre 1 y 10080 minutos.');
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $match = director_proposal_lock($matchId);
        if (empty($match['director_proposals_enabled']) || $match['status'] !== 'programado' || !empty($match['multi_draw_winner_option_id'])
            || !director_proposal_roster_ready($match) || !multiple_draw_options($matchId)) throw new RuntimeException('Se necesita una fecha completa con propuestas guardadas y sin ganador.');
        if (!empty($match['director_vote_opened_at']) || time() >= director_proposal_voting_start($match)) throw new RuntimeException('La votación ya comenzó; no se puede reiniciar.');
        $now = time();
        $pdo->prepare('UPDATE matches SET director_vote_opened_at = ?, director_vote_closes_at = ?, director_proposals_revealed_at = COALESCE(director_proposals_revealed_at, NOW()) WHERE id = ?')
            ->execute([date('Y-m-d H:i:s', $now), date('Y-m-d H:i:s', $now + $minutes * 60), $matchId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function director_proposal_close_voting(int $matchId, int $selectedOptionId = 0): void
{
    ensure_director_proposals_schema();
    if (!is_admin()) throw new RuntimeException('Solo el administrador puede terminar la votación.');
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $match = director_proposal_lock($matchId);
        if (empty($match['director_proposals_enabled']) || !multiple_draw_is_open($match)) throw new RuntimeException('La votación no está abierta.');
        if ($selectedOptionId > 0) {
            $options = multiple_draw_options($matchId);
            $maxVotes = $options ? max(array_column($options, 'vote_count')) : 0;
            $eligible = array_filter($options, static fn(array $option): bool => (int) $option['id'] === $selectedOptionId && (int) $option['vote_count'] === (int) $maxVotes);
            if (!$eligible) throw new RuntimeException('Elegí una de las propuestas con más votos.');
        }
        $pdo->prepare('UPDATE matches SET director_vote_closes_at = ? WHERE id = ?')->execute([date('Y-m-d H:i:s'), $matchId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    if ($selectedOptionId > 0) multiple_draw_apply_option($matchId, $selectedOptionId);
    else multiple_draw_finalize_if_due(repo_match_by_id($matchId));
}

function director_proposal_csrf(): string
{
    if (empty($_SESSION['director_proposal_csrf'])) $_SESSION['director_proposal_csrf'] = bin2hex(random_bytes(32));
    return (string) $_SESSION['director_proposal_csrf'];
}

function director_proposal_check_csrf(string $token): void
{
    if (!hash_equals(director_proposal_csrf(), $token)) throw new RuntimeException('La sesion vencio. Recarga la pagina.');
}

function director_proposal_lock(int $matchId): array
{
    $stmt = db()->prepare('SELECT * FROM matches WHERE id = ? FOR UPDATE');
    $stmt->execute([$matchId]);
    $match = $stmt->fetch();
    if (!$match) throw new RuntimeException('Fecha no encontrada.');
    return $match;
}

function director_proposal_roster_ready(array $match): bool
{
    $matchId = (int) ($match['id'] ?? 0);
    $teams = (int) ($match['num_teams'] ?? 0);
    $perTeam = (int) ($match['players_per_team'] ?? 0);
    if ($matchId <= 0 || $teams < 2 || $perTeam <= 0 || strtotime((string) ($match['match_date'] ?? '')) === false) return false;
    $count = isset($match['participants_count']) ? (int) $match['participants_count'] : count(multiple_draw_participant_ids($matchId));
    return $count === $teams * $perTeam;
}

function director_proposals_are_visible(array $match): bool
{
    return !empty($match['director_proposals_enabled']) && (is_admin()
        || !empty($match['director_proposals_revealed_at']) || time() >= director_proposal_voting_start($match));
}

function director_proposal_restart(int $matchId): void
{
    ensure_director_proposals_schema();
    if (!is_directivo() || current_user_id() <= 0) throw new RuntimeException('Acceso no permitido.');
    $pdo = db();
    $pdo->beginTransaction();
    try {
        director_proposal_assert_open(director_proposal_lock($matchId));
        $pdo->prepare('DELETE FROM match_draw_options WHERE match_id = ? AND author_user_id = ?')->execute([$matchId, current_user_id()]);
        $pdo->commit();
        unset($_SESSION['proposal_manual_drafts'][current_user_id()][$matchId]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function director_proposal_can_create(array $match, ?array $settings = null): bool
{
    if (($match['status'] ?? '') !== 'programado' || !director_proposal_roster_ready($match)) return false;
    if (!empty($match['director_proposals_enabled'])) return director_proposal_can_edit($match);
    $settings ??= admin_config_settings();
    return strtotime((string) $match['match_date']) - (int) ($settings['director_proposal_start_minutes'] ?? 1440) * 60 > time()
        && !multiple_draw_options((int) $match['id']);
}

function director_proposal_can_edit(array $match): bool
{
    return !empty($match['director_proposals_enabled']) && director_proposal_roster_ready($match) && ($match['status'] ?? '') === 'programado'
        && empty($match['multi_draw_winner_option_id']) && time() < director_proposal_voting_start($match)
        && time() < multiple_draw_deadline($match);
}

function director_proposal_assert_open(array $match): void
{
    if (!director_proposal_can_edit($match)) {
        throw new RuntimeException('La propuesta esta bloqueada: la votacion ya comenzo.');
    }
}

function director_proposals_start(int $matchId): void
{
    ensure_director_proposals_schema();
    if (!is_directivo() && !is_admin()) throw new RuntimeException('Acceso no permitido.');
    $settings = admin_config_settings();
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $match = director_proposal_lock($matchId);
        if (!director_proposal_roster_ready($match)) throw new RuntimeException('El administrador debe completar la fecha y la lista de jugadores antes de crear propuestas.');
        if (!empty($match['director_proposals_enabled'])) {
            director_proposal_assert_open($match);
        } else {
            if ($match['status'] !== 'programado' || multiple_draw_options($matchId)) {
                throw new RuntimeException('Esta fecha ya tiene equipos o una votacion de variantes.');
            }
            $minutes = (int) ($settings['director_proposal_lock_minutes'] ?? 120);
            $startMinutes = (int) ($settings['director_proposal_start_minutes'] ?? 1440);
            if ($startMinutes <= $minutes) throw new RuntimeException('El inicio de votacion debe ser anterior al cierre.');
            if (strtotime((string) $match['match_date']) - $startMinutes * 60 <= time()) {
                throw new RuntimeException('La votacion ya comenzo. No se pueden agregar propuestas.');
            }
            $pdo->prepare('UPDATE matches SET director_proposals_enabled = 1, multi_draw_lock_minutes = ?, director_vote_start_minutes = ? WHERE id = ?')
                ->execute([$minutes, $startMinutes, $matchId]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function director_proposal_for_user(int $matchId): ?array
{
    ensure_director_proposals_schema();
    $stmt = db()->prepare('SELECT * FROM match_draw_options WHERE match_id = ? AND author_user_id = ?');
    $stmt->execute([$matchId, current_user_id()]);
    $option = $stmt->fetch();
    if (!$option) return null;
    $option['teams'] = json_decode((string) $option['teams_json'], true) ?: [];
    return $option;
}

function director_proposal_publish(int $matchId, array $teams, float $diff): void
{
    ensure_director_proposals_schema();
    if (!is_directivo() || current_user_id() <= 0) throw new RuntimeException('Solo los directivos pueden publicar propuestas.');
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $match = director_proposal_lock($matchId);
        director_proposal_assert_open($match);
        $kits = match_team_kits($match);
        foreach ($teams as $index => &$team) $team['color_name'] = $kits[$index] ?? '';
        unset($team);
        if (count($teams) !== (int) $match['num_teams']) throw new RuntimeException('La cantidad de equipos cambio. Recarga la fecha.');
        $ids = [];
        foreach ($teams as $team) foreach ($team['players'] as $player) $ids[] = (int) $player['id'];
        sort($ids);
        if ($ids !== multiple_draw_participant_ids($matchId)) throw new RuntimeException('Los convocados cambiaron. Recarga la fecha.');
        $stmt = $pdo->prepare('SELECT id FROM match_draw_options WHERE match_id = ? AND author_user_id = ?');
        $stmt->execute([$matchId, current_user_id()]);
        $existingId = (int) $stmt->fetchColumn();
        if ($existingId > 0) {
            $pdo->prepare('UPDATE match_draw_options SET teams_json = ?, total_diff = ? WHERE id = ? AND author_user_id = ?')
                ->execute([json_encode($teams, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $diff, $existingId, current_user_id()]);
            $pdo->commit();
            return;
        }
        $stmt = $pdo->prepare('SELECT COALESCE(MAX(option_number), 0) + 1 FROM match_draw_options WHERE match_id = ?');
        $stmt->execute([$matchId]);
        $number = (int) $stmt->fetchColumn();
        if ($number > 255) throw new RuntimeException('Se alcanzo el limite de propuestas.');
        $pdo->prepare('INSERT INTO match_draw_options (match_id, option_number, author_user_id, teams_json, total_diff) VALUES (?, ?, ?, ?, ?)')
            ->execute([$matchId, $number, current_user_id(), json_encode($teams, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $diff]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function director_proposal_vote(int $matchId, int $optionId): void
{
    ensure_director_proposals_schema();
    if (current_user_id() <= 0 || !in_array(current_role(), ['usuario', 'jugador'], true)) throw new RuntimeException('Solo los usuarios comunes pueden votar.');
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $match = director_proposal_lock($matchId);
        if (empty($match['director_proposals_enabled']) || !multiple_draw_is_open($match)) throw new RuntimeException('La votacion no esta abierta.');
        $stmt = $pdo->prepare('SELECT id FROM match_draw_options WHERE id = ? AND match_id = ? AND author_user_id IS NOT NULL');
        $stmt->execute([$optionId, $matchId]);
        if (!$stmt->fetchColumn()) throw new RuntimeException('Propuesta invalida.');
        $pdo->prepare('INSERT INTO director_proposal_votes (match_id, user_id, option_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE option_id = VALUES(option_id), updated_at = CURRENT_TIMESTAMP')
            ->execute([$matchId, current_user_id(), $optionId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function director_proposals_finalize_due(): void
{
    ensure_director_proposals_schema();
    $matches = db()->query('SELECT * FROM matches WHERE director_proposals_enabled = 1 AND status = "programado" AND multi_draw_winner_option_id IS NULL')->fetchAll();
    foreach ($matches as $match) {
        if (time() >= multiple_draw_deadline($match)) multiple_draw_finalize_if_due($match);
    }
}
