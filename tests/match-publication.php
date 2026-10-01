<?php
require_once __DIR__ . '/../lib/repository.php';

$draft = ['status' => 'programado', 'teams_published_at' => null];
foreach (['usuario', 'jugador', 'directivo'] as $role) {
    $_SESSION = ['user_id' => 1, 'user_role' => $role];
    if (repo_match_visible_to_current_user($draft) !== ($role === 'directivo')) {
        throw new RuntimeException('Incorrect draft visibility for ' . $role);
    }
    if (!repo_match_visible_to_current_user(array_merge($draft, ['teams_published_at' => '2026-10-01 10:00:00']))) {
        throw new RuntimeException('Published match must be visible');
    }
    if (!repo_match_visible_to_current_user(['status' => 'finalizado'])) {
        throw new RuntimeException('History must remain visible');
    }
}
$_SESSION = [];
if (repo_match_visible_to_current_user($draft)) throw new RuntimeException('Guest can see draft');
echo "Publication visibility OK\n";
