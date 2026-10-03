<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/player_profile_visual.php';
$defaults = player_normalize_position_stat_weights(player_position_stat_weight_defaults());
$legacy = player_rating_policy()['legacyWeights'];
if (player_resolve_position_stat_weights($legacy) !== $defaults) {
    throw new RuntimeException('Previous defaults must upgrade to the current policy.');
}
$custom = $legacy;
$custom['DEF']['defense_physical'] = 0.5;
if (player_resolve_position_stat_weights($custom) !== player_normalize_position_stat_weights($custom)) {
    throw new RuntimeException('Customized position weights must be preserved.');
}
$weights = player_position_stat_weights_config();
$cases = [];
mt_srand(20261002);
foreach (allowed_positions() as $primary) {
    foreach (range(1, 40) as $index) {
        $player = ['positions' => $primary . '/MED', 'skill' => 3.0];
        foreach (player_stat_fields() as $field) {
            $player[$field] = mt_rand(10, 60) / 10;
        }
        foreach (allowed_positions() as $position) {
            foreach ([false, true] as $ignore) {
                $rating = player_position_rating($player, $position, $ignore);
                $cases[] = ['player' => $player, 'position' => $position, 'ignore' => $ignore,
                    'rating' => $rating, 'card' => shared_profile_player_fifa_overall($rating)];
            }
        }
    }
}
echo json_encode(['policy' => array_replace(player_rating_policy(), ['weights' => $weights]), 'cases' => $cases], JSON_THROW_ON_ERROR);
