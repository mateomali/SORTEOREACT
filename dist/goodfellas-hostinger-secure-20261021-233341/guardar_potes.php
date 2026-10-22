<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/admin_config.php';
require_once __DIR__ . '/lib/draw_pots.php';
require_directivo_or_admin();
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Método no permitido.']);
    exit;
}
try {
    $body = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body) || !is_string($body['csrf'] ?? null) || !hash_equals(draw_pots_csrf(), $body['csrf'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'La sesión venció. Recargá la página.']);
        exit;
    }
    $pots = draw_pots_validate_template($body['pots'] ?? null);
    $ids = array_merge([], ...array_column($pots, 'playerIds'));
    if ($ids) {
        $stmt = db()->prepare('SELECT COUNT(*) FROM players WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
        $stmt->execute($ids);
        if ((int) $stmt->fetchColumn() !== count($ids)) throw new InvalidArgumentException('Hay jugadores que ya no están registrados. Revisá los potes.');
    }
    ensure_admin_config_schema();
    admin_config_set_default('draw_pots_template', json_encode($pots, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    echo json_encode(['ok' => true, 'pots' => $pots]);
} catch (InvalidArgumentException | JsonException $error) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('guardar_potes: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No se pudieron guardar los potes. Intentá nuevamente.']);
}
