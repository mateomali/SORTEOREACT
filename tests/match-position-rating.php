<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/helpers.php';

$player = ['positions' => 'MED/DEL', 'skill' => 4, 'regularity' => 3.5,
    'technique' => 4, 'pass_vision' => 5, 'rhythm' => 4, 'stamina' => 4,
    'defense_physical' => 1, 'attack' => 6, 'teamwork' => 4,
    'mentality' => 4, 'goalkeeper_skill' => 1];
$general = player_best_natural_rating($player);
$enabled = $player + ['position_rating_discount' => 1];
$disabled = $player + ['position_rating_discount' => 0];
foreach (allowed_positions() as $role) {
    if (player_position_rating($disabled, $role) !== $general) {
        throw new RuntimeException("Disabled discount must preserve general in {$role}");
    }
    if (player_position_rating($enabled, $role) !== player_position_rating($player, $role)) {
        throw new RuntimeException("Existing behavior must remain in {$role}");
    }
}
if (player_position_rating($enabled, 'DEF') === $general) {
    throw new RuntimeException('Enabled discount must still adjust an unsuitable position');
}
echo "PASS: match position rule preserves general and existing positional behavior\n";
