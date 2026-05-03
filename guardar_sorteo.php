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
            'SELECT p.id, p.name, p.positions, p.pace, p.skill
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
    $ordered = [];
    foreach (['ARQ', 'DEF', 'MED', 'DEL'] as $pos) {
        if (in_array($pos, $parts, true)) {
            $ordered[] = $pos;
        }
    }
    return $ordered ?: ['MED'];
}

function get_primary_position_legacy(array $player): string
{
    $positions = parse_positions_legacy((string) ($player['positions'] ?? ''));
    return $positions[0] ?? 'MED';
}

function normalize_assigned_position_legacy(?string $assigned, array $player): string
{
    $candidate = strtoupper(trim((string) $assigned));
    $allowed = ['ARQ', 'DEF', 'MED', 'DEL'];
    if ($candidate !== '' && in_array($candidate, $allowed, true)) {
        return $candidate;
    }

    return get_primary_position_legacy($player);
}

function validate_teams_legacy(array $teams, int $teamSize, float $maxDiff): bool
{
    $scores = [];
    foreach ($teams as $team) {
        if (count($team) !== $teamSize) {
            return false;
        }

        $lineCounts = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
        $fast = 0;
        $slow = 0;
        $score = 0.0;

        foreach ($team as $player) {
            $assigned = normalize_assigned_position_legacy(
                isset($player['assigned_position']) ? (string) $player['assigned_position'] : '',
                $player
            );
            $lineCounts[$assigned] = ($lineCounts[$assigned] ?? 0) + 1;

            $score += (float) ($player['skill'] ?? 0);
            if (($player['pace'] ?? '') === 'lento') {
                $slow++;
            } else {
                $fast++;
            }
        }

        if (($lineCounts['ARQ'] ?? 0) !== 1) {
            return false;
        }
        if (abs($fast - $slow) > 3) {
            return false;
        }
        $scores[] = $score;
    }

    return (max($scores) - min($scores)) <= $maxDiff;
}

function team_formation_summary_legacy(array $team): string
{
    $counts = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
    foreach ($team as $player) {
        $assigned = normalize_assigned_position_legacy(
            isset($player['assigned_position']) ? (string) $player['assigned_position'] : '',
            $player
        );
        $counts[$assigned] = ($counts[$assigned] ?? 0) + 1;
    }
    return implode('-', [$counts['ARQ'], $counts['DEF'], $counts['MED'], $counts['DEL']]);
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
$numTeams = max(2, min(6, (int) ($data['num_teams'] ?? 2)));
$postedTeams = $data['teams'] ?? [];

if ($matchId <= 0 || !is_array($postedTeams) || !$postedTeams) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Faltan datos para guardar el sorteo']);
    exit;
}

$match = repo_match_by_id($matchId);
if (!$match) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'Partido no encontrado']);
    exit;
}
if ($match['status'] === 'finalizado') {
    http_response_code(409);
    echo json_encode(['ok' => false, 'message' => 'El partido ya esta finalizado']);
    exit;
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
            echo json_encode(['ok' => false, 'message' => 'Hay jugadores no validos para el partido']);
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

if (count($allIds) !== count($participantsById)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Deben incluirse todos los convocados en el sorteo']);
    exit;
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
    static fn(array $team): float => array_sum(array_map(static fn(array $p): float => (float) ($p['skill'] ?? 0), $team)),
    $teams
);
$maxDiff = $teamScores ? round(max($teamScores) - min($teamScores), 1) : 0.5;

if (!validate_teams_legacy($teams, $teamSize, $maxDiff)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Los equipos no respetan la diferencia maxima, arquero o ritmo requeridos. Genera nuevamente o revisa el arquero asignado.']);
    exit;
}

$pdo = db();
$pdo->beginTransaction();
try {
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
            $totalSkill += (float) ($p['skill'] ?? 0);
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
            'color_name' => (string) ($teamMeta[$idx]['color_name'] ?? ''),
        ]);

        $lineOrder = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
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
             draw_mode = "random", draw_started_at = COALESCE(draw_started_at, NOW()), draw_completed_at = NOW(),
             formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
         WHERE id = :id'
    );
    $updMatch->execute([
        'status' => 'sorteado',
        'num_teams' => $numTeams,
        'players_per_team' => $teamSize,
        'max_diff' => $maxDiff,
        'id' => $matchId,
    ]);

    $pdo->commit();
    echo json_encode(['ok' => true, 'message' => 'Sorteo guardado correctamente en el partido']);
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error al guardar: ' . $e->getMessage()]);
}
