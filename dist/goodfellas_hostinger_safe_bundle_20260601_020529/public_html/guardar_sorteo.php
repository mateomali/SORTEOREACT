<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

require_admin();
ensure_control_schema();

if (!function_exists('repo_match_participants_basic')) {
    function repo_match_participants_basic(int $matchId): array
    {
        $stmt = db()->prepare(
            'SELECT p.id, p.name, p.positions, p.pace, p.skill, p.photo_path,
                    p.technique, p.rhythm, p.defense_physical, p.attack, p.teamwork, p.mentality, p.regularity, p.goalkeeper_skill
             FROM match_players mp
             INNER JOIN players p ON p.id = mp.player_id
             WHERE mp.match_id = :mid
             ORDER BY p.name ASC'
        );
        $stmt->execute(['mid' => $matchId]);
        return $stmt->fetchAll();
    }
}

function parse_positions_legacy(string $positions): array
{
    $parts = array_map(
        static fn($p): string => strtoupper(trim((string) $p)),
        explode('/', $positions)
    );
    $parts = array_values(array_filter($parts, static fn($p): bool => $p !== ''));
    $allowed = allowed_positions();
    $ordered = [];
    foreach ($parts as $pos) {
        if (in_array($pos, $allowed, true) && !in_array($pos, $ordered, true)) {
            $ordered[] = $pos;
        }
    }
    return array_slice($ordered, 0, 2) ?: ['MED'];
}

function get_primary_position_legacy(array $player): string
{
    $positions = parse_positions_legacy((string) ($player['positions'] ?? ''));
    return $positions[0] ?? 'MED';
}

function normalize_assigned_position_legacy(?string $assigned, array $player): string
{
    $candidate = strtoupper(trim((string) $assigned));
    $allowed = allowed_positions();
    if ($candidate !== '' && in_array($candidate, $allowed, true)) {
        return $candidate;
    }

    return get_primary_position_legacy($player);
}

function position_base_rating_legacy(array $player, string $assigned): float
{
    if ($assigned === 'ARQ' && !in_array('ARQ', parse_positions_legacy((string) ($player['positions'] ?? '')), true)) {
        return 2.0;
    }

    return player_position_rating($player, $assigned);
}

function adjusted_position_rating_legacy(array $player, string $assigned): float
{
    if ($assigned === '') {
        return player_overall_rating($player);
    }
    return position_base_rating_legacy($player, $assigned);
}

function normalize_team_color_name_legacy(string $color): string
{
    return strtoupper(trim($color));
}

function validate_unique_team_colors_legacy(array $teamMeta, int $numTeams): ?string
{
    $seen = [];
    for ($idx = 0; $idx < $numTeams; $idx++) {
        $color = normalize_team_color_name_legacy((string) ($teamMeta[$idx]['color_name'] ?? ''));
        if ($color === '') {
            return 'Todos los equipos deben tener color de camiseta.';
        }
        if (isset($seen[$color])) {
            return 'No se puede guardar: hay equipos con el mismo color de camiseta.';
        }
        $seen[$color] = true;
    }

    return null;
}

function team_formation_summary_legacy(array $team): string
{
    $counts = array_fill_keys(player_formation_lines(), 0);
    foreach ($team as $player) {
        $assigned = normalize_assigned_position_legacy(
            isset($player['assigned_position']) ? (string) $player['assigned_position'] : '',
            $player
        );
        $counts[$assigned] = ($counts[$assigned] ?? 0) + 1;
    }
    return implode('-', [
        (int) ($counts['DEF'] ?? 0) + (int) ($counts['LAT'] ?? 0),
        (int) ($counts['MED'] ?? 0),
        (int) ($counts['DEL'] ?? 0),
    ]);
}

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Metodo no permitido']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode((string) $raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'JSON invalido']);
    exit;
}

$matchId = (int) ($data['match_id'] ?? 0);
$numTeams = max(2, min(4, (int) ($data['num_teams'] ?? 2)));
$drawMode = (string) ($data['draw_mode'] ?? 'random');
if (!in_array($drawMode, ['random', 'manual'], true)) {
    $drawMode = 'random';
}
$redrawIncrement = max(0, min(20, (int) ($data['redraw_increment'] ?? 0)));
$postedTeams = $data['teams'] ?? [];

if ($matchId <= 0 || !is_array($postedTeams) || !$postedTeams) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Faltan datos para guardar el sorteo']);
    exit;
}

$match = repo_match_by_id($matchId);
if (!$match) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'Fecha no encontrada']);
    exit;
}
if ($match['status'] === 'finalizado') {
    http_response_code(409);
    echo json_encode(['ok' => false, 'message' => 'La fecha ya esta finalizada']);
    exit;
}

$hasExistingRandomDraw = (string) ($match['status'] ?? '') === 'sorteado' && (string) ($match['draw_mode'] ?? '') === 'random';
if ($drawMode === 'random' && $hasExistingRandomDraw && $redrawIncrement < 1) {
    $redrawIncrement = 1;
}
if ($drawMode !== 'random') {
    $redrawIncrement = 0;
}
if ($redrawIncrement > 0) {
    $allowRedraw = (int) ($match['allow_redraw'] ?? 1) === 1;
    $redrawLimit = max(0, (int) ($match['redraw_limit'] ?? 3));
    $redrawCount = max(0, (int) ($match['redraw_count'] ?? 0));
    if (!$allowRedraw) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'message' => 'Esta fecha no permite rehacer el sorteo.']);
        exit;
    }
    if ($redrawCount + $redrawIncrement > $redrawLimit) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'message' => 'Ya se alcanzo el limite de re-sorteos para esta fecha.']);
        exit;
    }
}

$participants = repo_match_participants_basic($matchId);
$participantsById = [];
foreach ($participants as $p) {
    $participantsById[(int) $p['id']] = $p;
}

$teams = [];
$teamMeta = [];
$allIds = [];
foreach ($postedTeams as $teamIdx => $teamPayload) {
    $teamRows = $teamPayload;
    $teamMeta[$teamIdx] = ['color_name' => ''];
    if (is_array($teamPayload) && array_key_exists('players', $teamPayload)) {
        $teamRows = $teamPayload['players'];
        $teamMeta[$teamIdx]['color_name'] = trim((string) ($teamPayload['color_name'] ?? ''));
    }
    if (!is_array($teamRows) || !$teamRows) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'message' => 'Todos los equipos deben tener jugadores']);
        exit;
    }
        $team = [];
        foreach ($teamRows as $row) {
            $pid = (int) ($row['id'] ?? 0);
            if ($pid <= 0 || !isset($participantsById[$pid])) {
                http_response_code(422);
            echo json_encode(['ok' => false, 'message' => 'Hay jugadores no validos para la fecha']);
            exit;
        }
        if (in_array($pid, $allIds, true)) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'message' => 'Un jugador aparece repetido en mas de un equipo']);
            exit;
            }
            $allIds[] = $pid;
            $player = $participantsById[$pid];
            $player['assigned_position'] = isset($row['assigned_position']) ? (string) $row['assigned_position'] : '';
            $team[] = $player;
        }
        $teams[] = $team;
}

if (count($teams) !== $numTeams) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'La cantidad de equipos no coincide con la configuracion']);
    exit;
}

$teamColorError = validate_unique_team_colors_legacy($teamMeta, $numTeams);
if ($teamColorError !== null) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => $teamColorError]);
    exit;
}

if (count($allIds) !== count($participantsById)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Deben incluirse todos los convocados en el sorteo']);
    exit;
}

if ($drawMode === 'random' && $hasExistingRandomDraw) {
    $newTeamSignatures = [];
    foreach ($teams as $team) {
        $ids = array_map(static fn(array $p): string => (string) (int) $p['id'], $team);
        sort($ids, SORT_STRING);
        $newTeamSignatures[] = implode(',', $ids);
    }
    sort($newTeamSignatures, SORT_STRING);
    $newSignature = implode('|', $newTeamSignatures);

    $oldStmt = db()->prepare(
        'SELECT team_number, player_id
         FROM match_players
         WHERE match_id = :mid
           AND team_number IS NOT NULL
         ORDER BY team_number ASC, player_id ASC'
    );
    $oldStmt->execute(['mid' => $matchId]);
    $oldTeams = [];
    foreach ($oldStmt->fetchAll() as $row) {
        $oldTeams[(int) $row['team_number']][] = (string) (int) $row['player_id'];
    }
    $oldTeamSignatures = [];
    foreach ($oldTeams as $ids) {
        sort($ids, SORT_STRING);
        $oldTeamSignatures[] = implode(',', $ids);
    }
    sort($oldTeamSignatures, SORT_STRING);
    if ($newSignature !== '' && $newSignature === implode('|', $oldTeamSignatures)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'message' => 'El re-sorteo debe generar equipos diferentes al sorteo guardado.']);
        exit;
    }
}

$teamSize = count($allIds) / $numTeams;
if ((int) $teamSize !== $teamSize) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'La cantidad de jugadores no es divisible por los equipos']);
    exit;
}
$teamSize = (int) $teamSize;

foreach ($teams as $team) {
    if (count($team) !== $teamSize) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'message' => 'Todos los equipos deben tener la misma cantidad de jugadores']);
        exit;
    }
}

$teamScores = array_map(
    static fn(array $team): float => array_sum(array_map(static function (array $p): float {
        return player_overall_rating($p);
    }, $team)),
    $teams
);
$maxDiff = $teamScores ? round(max($teamScores) - min($teamScores), 1) : 0.5;

$pdo = db();
$pdo->beginTransaction();
try {
    $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);

    $clearPlayers = $pdo->prepare(
        'UPDATE match_players
         SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0
         WHERE match_id = :mid'
    );
    $clearPlayers->execute(['mid' => $matchId]);

    $clearTeams = $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid');
    $clearTeams->execute(['mid' => $matchId]);

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

    foreach ($teams as $idx => $team) {
        $teamNumber = $idx + 1;
        $totalSkill = 0.0;
        foreach ($team as $p) {
            $assigned = normalize_assigned_position_legacy((string) ($p['assigned_position'] ?? ''), $p);
            $totalSkill += adjusted_position_rating_legacy($p, $assigned);
        }
        $saveTeam->execute([
            'mid' => $matchId,
            'team_number' => $teamNumber,
            'team_name' => 'Equipo ' . $teamNumber,
            'total_skill' => $totalSkill,
            'formation_name' => team_formation_summary_legacy($team),
            'formation_data' => json_encode(array_map(static fn(array $p): array => [
                'id' => (int) $p['id'],
                'position' => normalize_assigned_position_legacy((string) ($p['assigned_position'] ?? ''), $p),
            ], $team), JSON_UNESCAPED_UNICODE),
            'color_name' => normalize_team_color_name_legacy((string) ($teamMeta[$idx]['color_name'] ?? '')),
        ]);

        $lineOrder = array_fill_keys(player_formation_lines(), 0);
        foreach ($team as $lineupIndex => $player) {
            $assigned = normalize_assigned_position_legacy(
                isset($player['assigned_position']) ? (string) $player['assigned_position'] : '',
                $player
            );
            $lineOrder[$assigned] = ($lineOrder[$assigned] ?? 0) + 1;
            $savePlayer->execute([
                'mid' => $matchId,
                'player_id' => (int) $player['id'],
                'team_number' => $teamNumber,
                'assigned_position' => $assigned,
                'is_goalkeeper' => $assigned === 'ARQ' ? 1 : 0,
                'lineup_order' => $lineupIndex + 1,
                'formation_line_order' => $lineOrder[$assigned],
            ]);
        }
    }

    $updMatch = $pdo->prepare(
        'UPDATE matches
         SET status = :status, num_teams = :num_teams, players_per_team = :players_per_team, max_diff = :max_diff,
             draw_mode = :draw_mode, draw_started_at = COALESCE(draw_started_at, NOW()), draw_completed_at = NOW(),
             redraw_count = redraw_count + :redraw_increment,
             formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
         WHERE id = :id'
    );
    $updMatch->execute([
        'status' => 'sorteado',
        'num_teams' => $numTeams,
        'players_per_team' => $teamSize,
        'max_diff' => $maxDiff,
        'draw_mode' => $drawMode,
        'redraw_increment' => $redrawIncrement,
        'id' => $matchId,
    ]);

    $pdo->commit();
    echo json_encode(['ok' => true, 'message' => $drawMode === 'manual' ? 'Equipos manuales guardados correctamente' : 'Sorteo guardado correctamente en la fecha']);
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error al guardar: ' . $e->getMessage()]);
}
