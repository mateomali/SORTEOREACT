<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/directivos.php';

require_directivo_or_admin();
ensure_directivos_schema();

$voterId = current_directivo_id();
if (is_admin() && isset($_GET['directivo_id'])) {
    $voterId = max(0, (int) $_GET['directivo_id']);
}
$currentMember = $voterId > 0 ? directive_member_by_id($voterId) : null;
if (!$currentMember && is_directivo()) {
    flash('error', 'No se pudo identificar tu usuario directivo.');
    redirect('junta_votaciones.php');
}

$players = repo_all_players(true);
$fields = director_player_stat_fields();
$labels = director_player_stat_labels();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!$currentMember) {
            throw new RuntimeException('Directivo invalido.');
        }
        $statsInput = is_array($_POST['stats'] ?? null) ? $_POST['stats'] : [];
        $savePlayerId = isset($_POST['save_player_id']) ? (int) $_POST['save_player_id'] : 0;
        if ($savePlayerId > 0) {
            $statsInput = array_key_exists($savePlayerId, $statsInput)
                ? [$savePlayerId => $statsInput[$savePlayerId]]
                : [];
        }
        $saved = director_save_player_stat_votes(
            (int) $currentMember['id'],
            $statsInput
        );
        flash('success', $savePlayerId > 0 ? 'Valoracion guardada.' : 'Valoraciones guardadas. Jugadores actualizados: ' . (string) $saved . '.');
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    $redirect = 'mis_valoraciones.php';
    if (is_admin() && $voterId > 0) {
        $redirect .= '?directivo_id=' . $voterId;
    }
    redirect($redirect);
}

$votes = $currentMember ? director_member_stat_votes((int) $currentMember['id']) : [];
$members = is_admin() ? directive_members(true) : [];
$progress = director_player_stat_vote_progress(count($players));

function valuation_input_value(array $player, array $vote, string $field): string
{
    if (array_key_exists($field, $vote) && $vote[$field] !== null && $vote[$field] !== '') {
        return (string) (int) $vote[$field];
    }
    return (string) director_stat_0_99_from_internal(player_effective_stat($player, $field));
}

$valuationIslandPayload = [
    'isAdmin' => is_admin(),
    'voterId' => $voterId,
    'currentMember' => $currentMember ? [
        'id' => (int) $currentMember['id'],
        'name' => (string) $currentMember['name'],
    ] : null,
    'members' => array_map(
        static fn(array $member): array => [
            'id' => (int) $member['id'],
            'name' => (string) $member['name'],
        ],
        $members
    ),
    'progress' => array_map(
        static fn(array $row): array => [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'voted_players' => (int) $row['voted_players'],
            'complete' => (bool) $row['complete'],
        ],
        $progress
    ),
    'fields' => $fields,
    'labels' => $labels,
    'positionWeights' => player_position_stat_weights_config(),
    'players' => array_map(
        static function (array $player) use ($votes, $fields): array {
            $playerId = (int) $player['id'];
            $storedVote = $votes[$playerId] ?? [];
            $hasVote = (int) ($storedVote['manually_modified'] ?? 0) === 1;
            $vote = $hasVote ? $storedVote : [];
            $stats = [];
            foreach ($fields as $field) {
                $stats[$field] = valuation_input_value($player, $vote, $field);
            }
            return [
                'id' => $playerId,
                'name' => (string) $player['name'],
                'positions' => (string) $player['positions'],
                'primaryPosition' => player_primary_position($player),
                'general' => director_stat_0_99_from_internal(player_overall_rating($player)),
                'stats' => $stats,
                'voted' => $hasVote,
            ];
        },
        $players
    ),
];

$title = 'Mis valoraciones | ' . APP_NAME;
$activePage = 'mis_valoraciones.php';
$bodyClass = 'page-mis-valoraciones';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="mis_valoraciones_page">
  <script type="application/json">
    <?= json_encode($valuationIslandPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
