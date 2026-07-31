<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/player_profile_visual.php';

ensure_control_schema();

$players = array_slice(repo_all_players(true), 0, 12);

function card_preview_stat(array $player, string $field): int
{
    return shared_profile_player_fifa_overall(player_effective_stat($player, $field));
}

function card_preview_demo_photo(int $index): string
{
    return 'assets/players/default-player-silhouette.png';
}

function card_preview_tier(int $overall): string
{
    if ($overall >= 88) {
        return 'supreme';
    }
    if ($overall >= 84) {
        return 'elite';
    }
    if ($overall >= 76) {
        return 'gold';
    }
    if ($overall >= 66) {
        return 'silver';
    }
    return 'bronze';
}

$previewPlayers = array_map(static function (array $player, int $index): array {
    $positions = parse_positions_csv((string) $player['positions']);
    $overall = shared_profile_player_fifa_overall(player_overall_rating($player));

    return [
        'id' => (int) ($player['id'] ?? 0),
        'name' => (string) ($player['name'] ?? ''),
        'primary' => $positions[0] ?? 'MED',
        'secondary' => $positions[1] ?? '',
        'active' => (int) ($player['active'] ?? 0) === 1,
        'overall' => $overall,
        'tier' => card_preview_tier($overall),
        'photo' => card_preview_demo_photo($index),
        'stats' => [
            ['label' => 'RIT', 'value' => card_preview_stat($player, 'rhythm')],
            ['label' => 'TEC', 'value' => card_preview_stat($player, 'technique')],
            ['label' => 'SOL', 'value' => card_preview_stat($player, 'defense_physical')],
            ['label' => 'ATA', 'value' => card_preview_stat($player, 'attack')],
            ['label' => 'EQU', 'value' => card_preview_stat($player, 'teamwork')],
            ['label' => 'MEN', 'value' => card_preview_stat($player, 'mentality')],
        ],
    ];
}, $players, array_keys($players));

$previewPayloadJson = json_encode(
    ['players' => $previewPlayers],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);

$title = 'Preview tarjetas | ' . APP_NAME;
$activePage = 'jugadores2.php';
$bodyClass = 'page-card-preview';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="jugadores_card_preview_page" data-payload="<?= h($previewPayloadJson !== false ? $previewPayloadJson : '{}') ?>"></div>

<?php require __DIR__ . '/includes/footer.php'; ?>
