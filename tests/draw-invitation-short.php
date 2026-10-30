<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/draw_invitation.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
foreach ([str_repeat('0', 64), str_repeat('f', 64), ...array_map(fn() => bin2hex(random_bytes(32)), range(1, 100))] as $token) {
    $code = draw_invitation_short_code($token);
    check(strlen($code) === 12, 'Code must have 12 characters');
    check(draw_invitation_short_prefix($code) === substr($token, 0, 15), 'Token prefix round trip');
    check(draw_invitation_short_prefix(strtolower($code)) === substr($token, 0, 15), 'Lowercase accepted');
}
foreach (['', 'ABCDEFGHIJKL', '../config.php', '2222222222222', '22222222222', '22222222222&', '222222222220'] as $invalid) check(draw_invitation_short_prefix($invalid) === null, 'Invalid code rejected');
check(draw_invitation_short_code('invalid') === '', 'Invalid token rejected');
echo "Short invitation tests passed.\n";
