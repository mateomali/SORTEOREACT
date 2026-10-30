<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/draw_pots.php';
require_once __DIR__ . '/lib/draw_separations.php';
require_admin();
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Metodo no permitido.']);
    exit;
}
try {
    $body = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body) || !is_string($body['csrf'] ?? null) || !hash_equals(draw_pots_csrf(), $body['csrf'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'La sesion vencio. Recarga la pagina.']);
        exit;
    }
    $groups = draw_separations_validate($body['separated_pairs'] ?? null);
    draw_separations_assert_registered($groups);
    $pdo = db();
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT * FROM matches WHERE id = ? FOR UPDATE');
    $stmt->execute([(int) ($body['match_id'] ?? 0)]);
    $match = $stmt->fetch();
    if (!$match || $match['status'] === 'finalizado') throw new InvalidArgumentException('La fecha no existe o ya esta finalizada.');
    $audit = json_decode((string) ($match['draw_audit_snapshot'] ?? '{}'), true) ?: [];
    $audit['criteria']['separated_pairs'] = $groups;
    $pdo->prepare('UPDATE matches SET draw_audit_snapshot = ? WHERE id = ?')->execute([json_encode($audit, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $match['id']]);
    $pdo->commit();
    echo json_encode(['ok' => true]);
} catch (InvalidArgumentException | JsonException $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('guardar_separaciones: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No se pudieron guardar las restricciones.']);
}
