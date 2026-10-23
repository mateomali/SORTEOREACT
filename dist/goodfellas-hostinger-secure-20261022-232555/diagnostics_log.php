<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/diagnostics.php';

header('Content-Type: application/json; charset=UTF-8');

if (!is_admin()) {
    http_response_code(403);
    echo json_encode(['ok' => false]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    $payload = ['raw' => substr($raw, 0, 1000)];
}

gf_log_event('client_error', $payload);
echo json_encode(['ok' => true]);
