<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/draw_invitation.php';
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');
$prefix = draw_invitation_short_prefix((string) ($_SERVER['QUERY_STRING'] ?? ''));
if ($prefix === null) {
    http_response_code(404);
    exit('Invitacion no disponible.');
}
require_once __DIR__ . '/lib/helpers.php';
// Escape LIKE metacharacters by accepting only a hexadecimal prefix above.
// Reject ambiguous prefixes instead of ever selecting the wrong match.
$statement = db()->prepare('SELECT id, draw_invitation_token FROM matches WHERE draw_invitation_token LIKE ? LIMIT 2');
$statement->execute([$prefix . '%']);
$matches = $statement->fetchAll(PDO::FETCH_ASSOC);
if (count($matches) !== 1) {
    http_response_code(404);
    exit('Invitacion no disponible.');
}
$match = $matches[0];
redirect('sorteo_legacy_csv.php?match_id=' . (int) $match['id'] . '&invite=' . rawurlencode((string) $match['draw_invitation_token']));
