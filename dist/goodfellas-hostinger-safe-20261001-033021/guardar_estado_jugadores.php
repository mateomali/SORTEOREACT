<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

require_admin();
ensure_control_schema();

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
$players = $data['players'] ?? [];
if ($matchId <= 0 || !is_array($players) || !$players) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Faltan jugadores para guardar el estado']);
    exit;
}

$match = repo_match_by_id($matchId);
if (!$match) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'Fecha no encontrada']);
    exit;
}

if ((string) ($match['status'] ?? '') === 'finalizado') {
    http_response_code(409);
    echo json_encode(['ok' => false, 'message' => 'La fecha ya esta finalizada']);
    exit;
}

$normalized = [];
foreach ($players as $row) {
    if (!is_array($row)) {
        continue;
    }
    $playerId = (int) ($row['id'] ?? 0);
    $percent = max(1, min(100, (int) round((float) ($row['availability_percent'] ?? 100))));
    if ($playerId > 0) {
        $normalized[$playerId] = $percent;
    }
}

if (!$normalized) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'No hay porcentajes validos para guardar']);
    exit;
}

$pdo = db();
$stmt = $pdo->prepare(
    'UPDATE match_players
     SET availability_percent = :availability_percent
     WHERE match_id = :match_id AND player_id = :player_id'
);

$updated = 0;
$pdo->beginTransaction();
try {
    foreach ($normalized as $playerId => $percent) {
        $stmt->execute([
            'availability_percent' => $percent,
            'match_id' => $matchId,
            'player_id' => $playerId,
        ]);
        $updated += $stmt->rowCount();
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No se pudo guardar el estado: ' . $e->getMessage()]);
    exit;
}

echo json_encode(['ok' => true, 'message' => 'Estado de jugadores guardado', 'updated' => $updated]);
