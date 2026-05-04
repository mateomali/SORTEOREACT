<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/sorteo.php';

header('Content-Type: application/json; charset=utf-8');

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function captain_draft_row(int $matchId): ?array
{
    $stmt = db()->prepare(
        'SELECT d.*,
                p1.name AS captain1_name,
                p1.skill AS captain1_skill,
                p2.name AS captain2_name,
                p2.skill AS captain2_skill
         FROM captain_drafts d
         INNER JOIN players p1 ON p1.id = d.captain1_player_id
         INNER JOIN players p2 ON p2.id = d.captain2_player_id
         WHERE d.match_id = :mid
         LIMIT 1'
    );
    $stmt->execute(['mid' => $matchId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function primary_position(array $player): string
{
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    return $positions[0] ?? 'MED';
}

function can_edit_captain_formation(array $match): bool
{
    return (string) ($match['status'] ?? '') !== 'finalizado';
}

function skill_allowed_ids_in_range(array $available, float $targetSkill, float $range = 1.0): array
{
    $ids = [];
    foreach ($available as $player) {
        if (abs((float) ($player['skill'] ?? 0) - $targetSkill) <= $range) {
            $ids[] = (int) $player['id'];
        }
    }
    if ($ids) {
        return $ids;
    }

    $closestDistance = null;
    $closestIds = [];
    foreach ($available as $player) {
        $distance = abs((float) ($player['skill'] ?? 0) - $targetSkill);
        if ($closestDistance === null || $distance < $closestDistance) {
            $closestDistance = $distance;
            $closestIds = [(int) $player['id']];
        } elseif ($distance === $closestDistance) {
            $closestIds[] = (int) $player['id'];
        }
    }
    return $closestIds;
}

function captain_pick_rule(int $matchId, array $available, array $draft): array
{
    $stmt = db()->prepare(
        'SELECT p.skill
         FROM captain_picks cp
         INNER JOIN players p ON p.id = cp.player_id
         WHERE cp.match_id = :mid AND cp.pick_order > 2
         ORDER BY cp.pick_order DESC
         LIMIT 1'
    );
    $stmt->execute(['mid' => $matchId]);
    $lastSkill = $stmt->fetchColumn();
    if ($lastSkill === false) {
        $currentTeam = $draft['current_team'] !== null ? (int) $draft['current_team'] : null;
        if (($currentTeam === 1 || $currentTeam === 2) && $available) {
            $referenceSkill = $currentTeam === 1 ? (float) $draft['captain2_skill'] : (float) $draft['captain1_skill'];
            $allowedIds = skill_allowed_ids_in_range($available, $referenceSkill, 1.0);
            $allowedSkills = [];
            foreach ($available as $player) {
                if (in_array((int) $player['id'], $allowedIds, true)) {
                    $allowedSkills[] = number_format((float) $player['skill'], 1);
                }
            }
            $allowedSkills = array_values(array_unique($allowedSkills));
            sort($allowedSkills);
            return [
                'active' => true,
                'enforced' => true,
                'mode' => 'initial',
                'reference_skill' => $referenceSkill,
                'last_skill' => null,
                'min_skill' => null,
                'max_skill' => null,
                'allowed_ids' => $allowedIds,
                'message' => 'Primera eleccion: jugadores entre ' . number_format($referenceSkill - 1.0, 1) . ' y ' . number_format($referenceSkill + 1.0, 1) . ' puntos. Habilitado: ' . implode(', ', $allowedSkills) . '.',
            ];
        }
        return [
            'active' => false,
            'enforced' => false,
            'mode' => 'free',
            'reference_skill' => null,
            'last_skill' => null,
            'min_skill' => null,
            'max_skill' => null,
            'allowed_ids' => [],
            'message' => 'Primera eleccion libre.',
        ];
    }

    $lastSkill = (float) $lastSkill;
    $range = 1.0;
    $allowedIds = [];
    while ($range <= 10.0 && !$allowedIds) {
        foreach ($available as $player) {
            $skill = (float) ($player['skill'] ?? 0);
            if (abs($skill - $lastSkill) <= $range) {
                $allowedIds[] = (int) $player['id'];
            }
        }
        if (!$allowedIds) {
            $range += 0.5;
        }
    }
    $minSkill = $lastSkill - $range;
    $maxSkill = $lastSkill + $range;

    if (!$allowedIds) {
        return [
            'active' => true,
            'enforced' => false,
            'mode' => 'chain',
            'reference_skill' => null,
            'last_skill' => $lastSkill,
            'min_skill' => $minSkill,
            'max_skill' => $maxSkill,
            'range' => $range,
            'allowed_ids' => [],
            'message' => 'No quedan jugadores dentro de la banda de puntaje. Eleccion libre.',
        ];
    }

    return [
        'active' => true,
        'enforced' => true,
        'mode' => 'chain',
        'reference_skill' => null,
        'last_skill' => $lastSkill,
        'min_skill' => $minSkill,
        'max_skill' => $maxSkill,
        'range' => $range,
        'allowed_ids' => $allowedIds,
        'message' => 'Elegir jugadores entre ' . number_format($minSkill, 1) . ' y ' . number_format($maxSkill, 1) . ' puntos.',
    ];
}

function captain_state(int $matchId): array
{
    $match = repo_match_by_id($matchId);
    if (!$match) {
        return ['ok' => false, 'message' => 'Fecha no encontrada'];
    }

    $draft = captain_draft_row($matchId);
    if (!$draft) {
        if (!is_admin() || !in_array((string) ($match['status'] ?? ''), ['sorteado', 'finalizado'], true)) {
            return ['ok' => false, 'message' => 'No hay modo capitanes iniciado para esta fecha'];
        }
    }

    $participants = repo_match_participants($matchId);
    $teams = [1 => [], 2 => []];
    $available = [];

    foreach ($participants as $p) {
        $row = [
            'id' => (int) $p['id'],
            'name' => (string) $p['name'],
            'positions' => (string) $p['positions'],
            'primary_position' => primary_position($p),
            'pace' => (string) $p['pace'],
            'pace_label' => pace_label((string) $p['pace']),
            'skill' => (float) $p['skill'],
            'team_number' => $p['team_number'] !== null ? (int) $p['team_number'] : null,
            'assigned_position' => $p['assigned_position'] !== null ? (string) $p['assigned_position'] : primary_position($p),
            'lineup_order' => $p['lineup_order'] !== null ? (int) $p['lineup_order'] : null,
            'formation_line_order' => $p['formation_line_order'] !== null ? (int) $p['formation_line_order'] : null,
        ];
        if ($row['team_number'] === 1 || $row['team_number'] === 2) {
            $teams[$row['team_number']][] = $row;
        } else {
            $available[] = $row;
        }
    }

    foreach ([1, 2] as $teamNumber) {
        usort($teams[$teamNumber], static function (array $a, array $b): int {
            $positionOrder = ['ARQ' => 1, 'DEF' => 2, 'MED' => 3, 'DEL' => 4];
            $positionCompare = ($positionOrder[$a['assigned_position']] ?? 99) <=> ($positionOrder[$b['assigned_position']] ?? 99);
            if ($positionCompare !== 0) {
                return $positionCompare;
            }
            $lineOrderA = $a['formation_line_order'] ?? 999;
            $lineOrderB = $b['formation_line_order'] ?? 999;
            if ($lineOrderA !== $lineOrderB) {
                return $lineOrderA <=> $lineOrderB;
            }
            $lineupA = $a['lineup_order'] ?? 999;
            $lineupB = $b['lineup_order'] ?? 999;
            if ($lineupA !== $lineupB) {
                return $lineupA <=> $lineupB;
            }
            if ((float) $b['skill'] !== (float) $a['skill']) {
                return (float) $b['skill'] <=> (float) $a['skill'];
            }
            return strcmp((string) $a['name'], (string) $b['name']);
        });
    }
    usort($available, static function (array $a, array $b): int {
        $order = ['ARQ' => 1, 'DEF' => 2, 'MED' => 3, 'DEL' => 4];
        $pos = ($order[$a['primary_position']] ?? 99) <=> ($order[$b['primary_position']] ?? 99);
        if ($pos !== 0) {
            return $pos;
        }
        if ((float) $b['skill'] !== (float) $a['skill']) {
            return (float) $b['skill'] <=> (float) $a['skill'];
        }
        return strcmp((string) $a['name'], (string) $b['name']);
    });

    $pickRule = $draft ? captain_pick_rule($matchId, $available, $draft) : [
        'active' => false,
        'enforced' => false,
        'mode' => 'admin_formations',
        'allowed_ids' => [],
        'message' => '',
    ];
    $allowedLookup = array_flip(array_map('intval', $pickRule['allowed_ids'] ?? []));
    foreach ($available as &$player) {
        $player['pick_allowed'] = !$pickRule['enforced'] || isset($allowedLookup[(int) $player['id']]);
    }
    unset($player);

    $targetTeamSize = count($participants) > 0 ? (int) (count($participants) / 2) : 0;
    $currentTeam = $draft && $draft['current_team'] !== null ? (int) $draft['current_team'] : null;
    $teamLabels = repo_match_team_labels($match, repo_match_teams($matchId));

    return [
        'ok' => true,
        'match' => [
            'id' => (int) $match['id'],
            'title' => (string) ($match['title'] ?: 'Fecha #' . $match['id']),
            'status' => (string) $match['status'],
            'match_date' => (string) $match['match_date'],
            'participants_count' => count($participants),
            'target_team_size' => $targetTeamSize,
            'can_edit_formations' => can_edit_captain_formation($match),
        ],
        'draft' => [
            'status' => $draft ? (string) $draft['status'] : 'completed',
            'current_team' => $currentTeam,
            'current_captain' => $draft
                ? ($currentTeam === 1 ? (string) $draft['captain1_name'] : ($currentTeam === 2 ? (string) $draft['captain2_name'] : ''))
                : '',
            'captains' => [
                1 => [
                    'id' => $draft ? (int) $draft['captain1_player_id'] : 0,
                    'name' => $draft ? (string) $draft['captain1_name'] : (string) ($teamLabels[1] ?? 'Equipo 1'),
                ],
                2 => [
                    'id' => $draft ? (int) $draft['captain2_player_id'] : 0,
                    'name' => $draft ? (string) $draft['captain2_name'] : (string) ($teamLabels[2] ?? 'Equipo 2'),
                ],
            ],
        ],
        'teams' => $teams,
        'available' => $available,
        'pick_rule' => $pickRule,
    ];
}

function finish_captain_draft(int $matchId): void
{
    $pdo = db();
    $stmtDraft = $pdo->prepare('SELECT * FROM captain_drafts WHERE match_id = :mid LIMIT 1');
    $stmtDraft->execute(['mid' => $matchId]);
    $draft = $stmtDraft->fetch() ?: [];
    $participants = repo_match_participants($matchId);
    $teams = [1 => [], 2 => []];
    foreach ($participants as $p) {
        $teamNumber = $p['team_number'] !== null ? (int) $p['team_number'] : 0;
        if ($teamNumber === 1 || $teamNumber === 2) {
            $teams[$teamNumber][] = $p;
        }
    }

    $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $saveTeam = $pdo->prepare(
        'INSERT INTO match_teams (match_id, team_number, team_name, captain_player_id, total_skill, formation_name, formation_data)
         VALUES (:mid, :team_number, :team_name, :captain_player_id, :total_skill, :formation_name, :formation_data)'
    );
    $savePlayer = $pdo->prepare(
        'UPDATE match_players
         SET assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper, lineup_order = :lineup_order, formation_line_order = :formation_line_order
         WHERE match_id = :mid AND player_id = :pid'
    );

    foreach ([1, 2] as $teamNumber) {
        $team = $teams[$teamNumber];
        $assignmentData = build_team_position_assignment($team);
        $totalSkill = 0.0;
        foreach ($team as $p) {
            $totalSkill += (float) $p['skill'];
        }
        $lineCounts = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
        foreach ($team as $p) {
            $line = $assignmentData['assignment'][(int) $p['id']] ?? primary_position($p);
            $lineCounts[$line] = ($lineCounts[$line] ?? 0) + 1;
        }
        $saveTeam->execute([
            'mid' => $matchId,
            'team_number' => $teamNumber,
            'team_name' => 'Equipo ' . $teamNumber,
            'captain_player_id' => $teamNumber === 1 ? ($draft['captain1_player_id'] ?? null) : ($draft['captain2_player_id'] ?? null),
            'total_skill' => $totalSkill,
            'formation_name' => implode('-', [$lineCounts['ARQ'], $lineCounts['DEF'], $lineCounts['MED'], $lineCounts['DEL']]),
            'formation_data' => json_encode(array_map(static function (array $p) use ($assignmentData): array {
                $line = $assignmentData['assignment'][(int) $p['id']] ?? primary_position($p);
                return ['id' => (int) $p['id'], 'position' => $line];
            }, $team), JSON_UNESCAPED_UNICODE),
        ]);
        $lineOrder = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
        foreach ($team as $lineupIndex => $p) {
            $line = $assignmentData['assignment'][(int) $p['id']] ?? primary_position($p);
            $lineOrder[$line] = ($lineOrder[$line] ?? 0) + 1;
            $savePlayer->execute([
                'mid' => $matchId,
                'pid' => (int) $p['id'],
                'assigned_position' => $line,
                'is_goalkeeper' => $line === 'ARQ' ? 1 : 0,
                'lineup_order' => $lineupIndex + 1,
                'formation_line_order' => $lineOrder[$line],
            ]);
        }
    }

    $pdo->prepare(
        'UPDATE matches
         SET status = "sorteado", draw_mode = "captains", draw_completed_at = NOW(), formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR)
         WHERE id = :mid'
    )->execute(['mid' => $matchId]);
    $pdo->prepare('UPDATE captain_drafts SET status = "completed", current_team = NULL, completed_at = NOW() WHERE match_id = :mid')->execute(['mid' => $matchId]);
}

$action = (string) ($_GET['action'] ?? $_POST['action'] ?? '');

if ($action === 'state') {
    $matchId = (int) ($_GET['match_id'] ?? 0);
    json_response(captain_state($matchId));
}

if (!in_array($action, ['pick', 'save_formation'], true) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Accion no valida'], 400);
}

$data = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($data)) {
    json_response(['ok' => false, 'message' => 'JSON invalido'], 400);
}

$matchId = (int) ($data['match_id'] ?? 0);
$teamNumber = (int) ($data['team_number'] ?? 0);
$playerId = (int) ($data['player_id'] ?? 0);
$token = trim((string) ($data['token'] ?? ''));
if ($matchId <= 0 || !in_array($teamNumber, [1, 2], true) || ($action === 'pick' && $playerId <= 0)) {
    json_response(['ok' => false, 'message' => 'Datos incompletos'], 422);
}

$pdo = db();
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT * FROM captain_drafts WHERE match_id = :mid FOR UPDATE');
    $stmt->execute(['mid' => $matchId]);
    $draft = $stmt->fetch();
    if (!$draft && !($action === 'save_formation' && is_admin())) {
        throw new RuntimeException('No hay draft de capitanes para esta fecha.');
    }
    if ($action === 'pick' && $draft['status'] !== 'active') {
        throw new RuntimeException('El draft no esta activo.');
    }
    if ($action === 'pick' && (int) $draft['current_team'] !== $teamNumber) {
        throw new RuntimeException('No es el turno de este capitan.');
    }

    $captainId = $draft ? ($teamNumber === 1 ? (int) $draft['captain1_player_id'] : (int) $draft['captain2_player_id']) : 0;
    $expectedToken = $draft ? ($teamNumber === 1 ? (string) ($draft['captain1_token'] ?? '') : (string) ($draft['captain2_token'] ?? '')) : '';
    $isAdminFormationSave = $action === 'save_formation' && is_admin();
    if (!$isAdminFormationSave && ($expectedToken === '' || $token === '' || !hash_equals($expectedToken, $token))) {
        throw new RuntimeException('Token de capitan invalido.');
    }

    if ($action === 'save_formation') {
        $match = repo_match_by_id($matchId);
        if (!$match) {
            throw new RuntimeException('Fecha no encontrada.');
        }
        if ($draft && (string) $draft['status'] !== 'completed') {
            throw new RuntimeException('La formacion se puede ajustar cuando el draft esta completo.');
        }
        if (!$draft && !in_array((string) ($match['status'] ?? ''), ['sorteado', 'finalizado'], true)) {
            throw new RuntimeException('La formacion se puede ajustar cuando los equipos ya estan generados.');
        }
        if (!can_edit_captain_formation($match)) {
            throw new RuntimeException('La formacion ya no se puede editar porque la fecha esta finalizada.');
        }
        $assignments = $data['assignments'] ?? [];
        if (!is_array($assignments)) {
            throw new RuntimeException('Datos de formacion invalidos.');
        }
        $allowed = ['ARQ', 'DEF', 'MED', 'DEL'];
        $update = $pdo->prepare(
            'UPDATE match_players
             SET assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper, lineup_order = :lineup_order, formation_line_order = :formation_line_order
             WHERE match_id = :mid AND player_id = :pid AND team_number = :team'
        );
        $lineOrder = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
        $formationData = [];
        foreach ($assignments as $index => $row) {
            if (!is_array($row)) {
                continue;
            }
            $pid = (int) ($row['player_id'] ?? 0);
            $position = strtoupper(trim((string) ($row['assigned_position'] ?? '')));
            if ($pid <= 0 || !in_array($position, $allowed, true)) {
                continue;
            }
            $lineOrder[$position] = ($lineOrder[$position] ?? 0) + 1;
            $formationData[] = ['id' => $pid, 'position' => $position];
            $update->execute([
                'mid' => $matchId,
                'pid' => $pid,
                'team' => $teamNumber,
                'assigned_position' => $position,
                'is_goalkeeper' => $position === 'ARQ' ? 1 : 0,
                'lineup_order' => $index + 1,
                'formation_line_order' => $lineOrder[$position],
            ]);
        }
        $pdo->prepare(
            'UPDATE match_teams
             SET formation_name = :formation_name, formation_data = :formation_data
             WHERE match_id = :mid AND team_number = :team'
        )->execute([
            'mid' => $matchId,
            'team' => $teamNumber,
            'formation_name' => implode('-', [$lineOrder['ARQ'], $lineOrder['DEF'], $lineOrder['MED'], $lineOrder['DEL']]),
            'formation_data' => json_encode($formationData, JSON_UNESCAPED_UNICODE),
        ]);
        $pdo->commit();
        json_response(captain_state($matchId));
    }

    $playerStmt = $pdo->prepare(
        'SELECT mp.player_id, mp.team_number, p.skill
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid AND mp.player_id = :pid
         LIMIT 1
         FOR UPDATE'
    );
    $playerStmt->execute(['mid' => $matchId, 'pid' => $playerId]);
    $row = $playerStmt->fetch();
    if (!$row) {
        throw new RuntimeException('El jugador no pertenece a esta fecha.');
    }
    if ($row['team_number'] !== null) {
        throw new RuntimeException('Ese jugador ya fue elegido.');
    }

    $targetSize = (int) ($pdo->query('SELECT COUNT(*) FROM match_players WHERE match_id = ' . $matchId)->fetchColumn() / 2);
    $teamCountStmt = $pdo->prepare('SELECT COUNT(*) FROM match_players WHERE match_id = :mid AND team_number = :team');
    $teamCountStmt->execute(['mid' => $matchId, 'team' => $teamNumber]);
    if ((int) $teamCountStmt->fetchColumn() >= $targetSize) {
        throw new RuntimeException('Ese equipo ya esta completo.');
    }

    $draftDetails = captain_draft_row($matchId);
    if (!$draftDetails) {
        throw new RuntimeException('No hay draft de capitanes para esta fecha.');
    }
    $availableStmt = $pdo->prepare(
        'SELECT p.id, p.skill
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid AND mp.team_number IS NULL'
    );
    $availableStmt->execute(['mid' => $matchId]);
    $pickRule = captain_pick_rule($matchId, $availableStmt->fetchAll(), $draftDetails);
    if ($pickRule['enforced'] && !in_array($playerId, array_map('intval', $pickRule['allowed_ids'] ?? []), true)) {
        if (($pickRule['mode'] ?? '') === 'initial') {
            throw new RuntimeException('Primera eleccion restringida: debes elegir un jugador con el puntaje habilitado por el capitan rival.');
        }
        throw new RuntimeException('Por equilibrio, este turno solo permite elegir jugadores dentro del rango habilitado.');
    }

    $orderStmt = $pdo->prepare('SELECT COALESCE(MAX(pick_order), 0) + 1 FROM captain_picks WHERE match_id = :mid');
    $orderStmt->execute(['mid' => $matchId]);
    $pickOrder = (int) $orderStmt->fetchColumn();

    $pdo->prepare(
        'INSERT INTO captain_picks (match_id, player_id, team_number, picked_by_player_id, pick_order)
         VALUES (:mid, :pid, :team, :picker, :pick_order)'
    )->execute([
        'mid' => $matchId,
        'pid' => $playerId,
        'team' => $teamNumber,
        'picker' => $captainId,
        'pick_order' => $pickOrder,
    ]);
    $pdo->prepare(
        'UPDATE match_players SET team_number = :team WHERE match_id = :mid AND player_id = :pid'
    )->execute(['team' => $teamNumber, 'mid' => $matchId, 'pid' => $playerId]);

    $remainingStmt = $pdo->prepare('SELECT COUNT(*) FROM match_players WHERE match_id = :mid AND team_number IS NULL');
    $remainingStmt->execute(['mid' => $matchId]);
    $remaining = (int) $remainingStmt->fetchColumn();
    if ($remaining === 0) {
        finish_captain_draft($matchId);
    } else {
        $nextTeam = $teamNumber === 1 ? 2 : 1;
        $pdo->prepare('UPDATE captain_drafts SET current_team = :team WHERE match_id = :mid')
            ->execute(['team' => $nextTeam, 'mid' => $matchId]);
    }

    $pdo->commit();
    json_response(captain_state($matchId));
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['ok' => false, 'message' => $e->getMessage()], 409);
}
