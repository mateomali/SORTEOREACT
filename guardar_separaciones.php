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
    ensure_draw_pots_schema();
    $pdo = db();
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT * FROM matches WHERE id = ? FOR UPDATE');
    $stmt->execute([(int) ($body['match_id'] ?? 0)]);
    $match = $stmt->fetch();
    if (!$match) throw new InvalidArgumentException('La fecha no existe.');
    $preparation = json_decode((string) ($match['draw_preparation_json'] ?? '{}'), true) ?: [];
    if (array_key_exists('goalkeeper_ids', $body)) {
        if (!is_array($body['goalkeeper_ids']) || count($body['goalkeeper_ids']) > 4) throw new InvalidArgumentException('Seleccion de arqueros invalida.');
        $ids = array_values(array_unique(array_map('intval', $body['goalkeeper_ids'])));
        foreach ($ids as $id) {
            $check = $pdo->prepare('SELECT COUNT(*) FROM match_players WHERE match_id = ? AND player_id = ?');
            $check->execute([$match['id'], $id]);
            if (!(int) $check->fetchColumn()) throw new InvalidArgumentException('El arquero debe estar convocado para esta fecha.');
        }
        $preparation['goalkeeper_ids'] = $ids;
    }
    $preparation['separated_pairs'] = $groups;
    $pdo->prepare('UPDATE matches SET draw_preparation_json = ? WHERE id = ?')->execute([json_encode($preparation, JSON_THROW_ON_ERROR), $match['id']]);
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
