<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/helpers.php';

foreach (['jugador', 'directivo', 'usuario', 'admin'] as $role) {
    foreach ([0, 42] as $playerId) {
        $_SESSION = ['user_id' => 7, 'user_role' => $role, 'player_id' => $playerId];
        if ($role === 'admin') {
            $_SESSION['is_admin'] = true;
        }
        $expected = $playerId > 0 && in_array($role, ['jugador', 'directivo'], true);
        if (is_player_user() !== $expected) {
            throw new RuntimeException("Unexpected player permissions for $role / $playerId");
        }
        if (is_directivo() !== ($role === 'directivo')) {
            throw new RuntimeException("Directive permissions changed for $role");
        }
    }
}
echo "Player and directive permissions passed.\n";
