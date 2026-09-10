<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

require_admin();
ensure_control_schema();

$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$selectedMatch = $matchId > 0 ? repo_match_by_id($matchId) : null;
$participants = $selectedMatch ? repo_match_participants_basic($matchId) : [];
$numTeams = $selectedMatch ? max(2, min(4, (int) ($selectedMatch['num_teams'] ?? 2))) : 2;
$playersPerTeam = $selectedMatch ? max(1, (int) ($selectedMatch['players_per_team'] ?? 1)) : 1;
$expectedPlayers = $numTeams * $playersPerTeam;

$players = array_map(static fn(array $p): array => [
    'id' => (int) $p['id'],
    'name' => (string) $p['name'],
    'positions' => (string) $p['positions'],
    'pace' => (string) $p['pace'],
    'skill' => (float) $p['skill'],
    'technique' => player_effective_stat($p, 'technique'),
    'rhythm' => player_effective_stat($p, 'rhythm'),
    'defense_physical' => player_effective_stat($p, 'defense_physical'),
    'attack' => player_effective_stat($p, 'attack'),
    'teamwork' => player_effective_stat($p, 'teamwork'),
    'mentality' => player_effective_stat($p, 'mentality'),
    'regularity' => player_effective_stat($p, 'regularity'),
    'goalkeeper_skill' => player_effective_stat($p, 'goalkeeper_skill'),
], $participants);

$title = 'Equipos manuales | ' . APP_NAME;
$activePage = 'editar_partidos.php';
$backUrl = 'editar_partidos.php' . ($selectedMatch ? '#partido-admin-' . (int) $selectedMatch['id'] : '');
$manualTeamsConfig = $selectedMatch ? [
    'matchId' => (int) $selectedMatch['id'],
    'numTeams' => (int) $numTeams,
    'playersPerTeam' => (int) $playersPerTeam,
    'players' => $players,
] : [];
$manualTeamsPayload = [
    'backUrl' => $backUrl,
    'state' => !$selectedMatch ? 'missing' : ((string) $selectedMatch['status'] === 'finalizado' ? 'finished' : 'ready'),
    'match' => $selectedMatch ? [
        'id' => (int) $selectedMatch['id'],
        'title' => (string) ($selectedMatch['title'] ?: ('Fecha #' . $selectedMatch['id'])),
        'date' => date('d/m/Y H:i', strtotime((string) $selectedMatch['match_date'])),
        'participants' => count($players),
        'expectedPlayers' => $expectedPlayers,
        'numTeams' => $numTeams,
        'playersPerTeam' => $playersPerTeam,
    ] : null,
    'config' => $manualTeamsConfig,
];
$manualTeamsPayloadJson = json_encode(
    $manualTeamsPayload,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);

require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="equipos_manual_page" data-payload="<?= h($manualTeamsPayloadJson !== false ? $manualTeamsPayloadJson : '{}') ?>"></div>

<?php require __DIR__ . '/includes/footer.php'; ?>
