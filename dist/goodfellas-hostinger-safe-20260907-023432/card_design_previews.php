<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();

function preview_card_overall(float $value): int
{
    $clamped = max(1.0, min(6.0, $value));
    $anchors = [
        [1.0, 35.0], [2.5, 54.0], [3.0, 64.0], [3.2, 69.0], [3.5, 74.0],
        [3.8, 79.0], [4.0, 81.0], [4.4, 86.0], [4.5, 87.0], [5.0, 92.0],
        [5.2, 93.0], [5.3, 94.0], [6.0, 99.0],
    ];
    for ($i = 0, $count = count($anchors) - 1; $i < $count; $i++) {
        [$fromRating, $fromOverall] = $anchors[$i];
        [$toRating, $toOverall] = $anchors[$i + 1];
        if ($clamped <= $toRating) {
            $ratio = ($clamped - $fromRating) / ($toRating - $fromRating);
            return (int) round($fromOverall + (($toOverall - $fromOverall) * $ratio));
        }
    }
    return 99;
}

function preview_stat_overall(array $player, string $field): int
{
    return preview_card_overall(player_effective_stat($player, $field));
}

function preview_player_photo_path(array $player): string
{
    $playerId = (int) ($player['id'] ?? 0);
    if ($playerId > 0) {
        $matches = glob(__DIR__ . '/uploads/players/transparent/player-' . $playerId . '-*.png') ?: [];
        if ($matches) {
            usort($matches, static fn(string $a, string $b): int => filemtime($b) <=> filemtime($a));
            return 'uploads/players/transparent/' . basename($matches[0]);
        }
    }
    return player_photo_path($player);
}

$players = array_values(array_filter(repo_all_players(true), static fn(array $player): bool => player_has_custom_photo($player)));
if (!$players) {
    $players = repo_all_players(true);
}

$previewPlayers = array_map(static function (array $player): array {
    $position = player_best_natural_position($player);
    $isGoalkeeper = $position === 'ARQ';
    return [
        'id' => (int) ($player['id'] ?? 0),
        'name' => (string) ($player['name'] ?? ''),
        'position' => $position,
        'positions' => parse_positions_csv((string) ($player['positions'] ?? '')),
        'photo' => preview_player_photo_path($player),
        'rating' => preview_card_overall(player_position_rating($player, $position)),
        'stats' => [
            ['label' => $isGoalkeeper ? 'ARQ' : 'TEC', 'value' => preview_stat_overall($player, $isGoalkeeper ? 'goalkeeper_skill' : 'technique')],
            ['label' => 'VEL', 'value' => preview_stat_overall($player, 'rhythm')],
            ['label' => 'DEF', 'value' => preview_stat_overall($player, 'defense_physical')],
            ['label' => $isGoalkeeper ? 'TEC' : 'ATA', 'value' => preview_stat_overall($player, $isGoalkeeper ? 'technique' : 'attack')],
            ['label' => 'EQU', 'value' => preview_stat_overall($player, 'teamwork')],
            ['label' => 'MEN', 'value' => preview_stat_overall($player, 'mentality')],
        ],
    ];
}, $players);

$previewPayloadJson = json_encode(
    ['players' => $previewPlayers],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);

$title = 'Previews de card | ' . APP_NAME;
$activePage = 'jugadores2.php';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="card_design_previews_page" data-payload="<?= h($previewPayloadJson !== false ? $previewPayloadJson : '{}') ?>"></div>

<?php require __DIR__ . '/includes/footer.php'; ?>
