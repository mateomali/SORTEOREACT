<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();
ensure_control_schema();

if (!function_exists('repo_match_participants_basic')) {
    function repo_match_participants_basic(int $matchId): array
    {
        $stmt = db()->prepare(
            'SELECT p.id, p.name, p.positions, p.pace, p.skill, p.photo_path, p.photo_position_x, p.photo_position_y, p.photo_zoom,
                    mp.availability_percent,
                    p.technique, p.pass_vision, p.rhythm, p.stamina, p.defense_physical, p.attack, p.teamwork, p.mentality, p.regularity, p.goalkeeper_skill
             FROM match_players mp
             INNER JOIN players p ON p.id = mp.player_id
             WHERE mp.match_id = :mid
             ORDER BY p.name ASC'
        );
        $stmt->execute(['mid' => $matchId]);
        return $stmt->fetchAll();
    }
}

$legacyMatchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$legacyLoadError = '';
$legacyMatch = null;
$legacyPlayers = [];
$legacyPairHistory = [];
$legacySavedDrawSignature = '';

try {
    $legacyMatch = $legacyMatchId > 0 ? repo_match_by_id($legacyMatchId) : null;
    if ($legacyMatch) {
        $participants = repo_match_participants_basic($legacyMatchId);
        $participantIds = [];
        foreach ($participants as $p) {
            $participantIds[] = (int) $p['id'];
            $legacyPlayers[] = [
                'id' => (int) $p['id'],
                'nombre' => (string) $p['name'],
                'posicion' => (string) $p['positions'],
                'ritmo' => ((string) $p['pace'] === 'lento') ? 'lento' : 'rápido',
                'photo_path' => player_photo_path($p),
                'has_custom_photo' => player_has_custom_photo($p),
                'photo_position_x' => player_photo_position_x($p),
                'photo_position_y' => player_photo_position_y($p),
                'photo_zoom' => player_photo_zoom($p),
                'availability_percent' => max(1, min(100, (int) ($p['availability_percent'] ?? 100))),
                'puntuacion' => player_overall_rating($p),
                'tecnica' => player_effective_stat($p, 'technique'),
                'pase_vision' => player_effective_stat($p, 'pass_vision'),
                'ritmo_stat' => player_effective_stat($p, 'rhythm'),
                'resistencia' => player_effective_stat($p, 'stamina'),
                'solidez' => player_effective_stat($p, 'defense_physical'),
                'ataque' => player_effective_stat($p, 'attack'),
                'compromiso' => player_effective_stat($p, 'teamwork'),
                'mentalidad' => player_effective_stat($p, 'mentality'),
                'regularidad' => player_effective_stat($p, 'regularity'),
                'habilidad_arquero' => player_effective_stat($p, 'goalkeeper_skill'),
                'selected' => true,
            ];
        }
        if ($participantIds) {
            $resultAdjustments = repo_player_result_adjustments($participantIds, $legacyMatchId);
            foreach ($legacyPlayers as &$legacyPlayer) {
                $playerId = (int) ($legacyPlayer['id'] ?? 0);
                $baseRating = (float) ($legacyPlayer['puntuacion'] ?? 3.0);
                $resultAdjustment = (float) ($resultAdjustments[$playerId]['adjustment'] ?? 0.0);
                $legacyPlayer['puntuacion_base'] = $baseRating;
                $legacyPlayer['rendimiento_historico_ajuste'] = $resultAdjustment;
                $legacyPlayer['rendimiento_historico_partidos'] = (int) ($resultAdjustments[$playerId]['matches'] ?? 0);
                $legacyPlayer['puntuacion'] = normalize_player_stat($baseRating + $resultAdjustment, $baseRating);
            }
            unset($legacyPlayer);
        }
        if ($participantIds) {
            $in = implode(',', array_fill(0, count($participantIds), '?'));
            if ((string) ($legacyMatch['status'] ?? '') === 'sorteado' && (string) ($legacyMatch['draw_mode'] ?? '') === 'random') {
                $currentDrawStmt = db()->prepare(
                    "SELECT team_number, player_id
                     FROM match_players
                     WHERE match_id = ?
                       AND team_number IS NOT NULL
                     ORDER BY team_number ASC, player_id ASC"
                );
                $currentDrawStmt->execute([$legacyMatchId]);
                $currentTeams = [];
                foreach ($currentDrawStmt->fetchAll() as $row) {
                    $currentTeams[(int) $row['team_number']][] = (string) (int) $row['player_id'];
                }
                $teamSignatures = [];
                foreach ($currentTeams as $teamIds) {
                    sort($teamIds, SORT_STRING);
                    $teamSignatures[] = implode(',', $teamIds);
                }
                sort($teamSignatures, SORT_STRING);
                $legacySavedDrawSignature = implode('|', $teamSignatures);
            }
            $historyStmt = db()->prepare(
                "SELECT mp.match_id, mp.team_number, mp.player_id
                 FROM match_players mp
                 INNER JOIN matches m ON m.id = mp.match_id
                 WHERE mp.player_id IN ($in)
                   AND mp.team_number IS NOT NULL
                   AND mp.match_id <> ?
                   AND m.status IN ('sorteado', 'finalizado')
                 ORDER BY m.match_date DESC, mp.match_id DESC"
            );
            $historyStmt->execute(array_merge($participantIds, [$legacyMatchId]));
            $groupedHistory = [];
            foreach ($historyStmt->fetchAll() as $row) {
                $key = (int) $row['match_id'] . ':' . (int) $row['team_number'];
                $groupedHistory[$key][] = (int) $row['player_id'];
            }
            foreach ($groupedHistory as $ids) {
                $ids = array_values(array_unique($ids));
                sort($ids);
                $count = count($ids);
                for ($i = 0; $i < $count; $i++) {
                    for ($j = $i + 1; $j < $count; $j++) {
                        $pairKey = $ids[$i] . '-' . $ids[$j];
                        $legacyPairHistory[$pairKey] = ($legacyPairHistory[$pairKey] ?? 0) + 1;
                    }
                }
            }
        }
    }
} catch (Throwable $e) {
    $legacyLoadError = 'No se pudieron cargar datos de la fecha: ' . $e->getMessage();
}

$drawBalanceWeights = player_draw_balance_weights();
$legacyDrawWeightsJson = json_encode([
    'general' => $drawBalanceWeights['general'],
    'ataque' => $drawBalanceWeights['attack'],
    'solidez' => $drawBalanceWeights['defense_physical'],
    'ritmo' => $drawBalanceWeights['rhythm'],
    'resistencia' => $drawBalanceWeights['stamina'],
    'pase_vision' => $drawBalanceWeights['pass_vision'],
    'tecnica' => $drawBalanceWeights['technique'],
    'compromiso' => $drawBalanceWeights['teamwork'],
    'mentalidad' => $drawBalanceWeights['mentality'],
    'regularidad' => $drawBalanceWeights['regularity'],
    'arquero' => $drawBalanceWeights['goalkeeper_skill'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$legacyNumTeams = $legacyMatch ? (int) $legacyMatch['num_teams'] : 2;
$sorteoLegacyPayload = [
    'matchId' => (int) $legacyMatchId,
    'match' => $legacyMatch ? [
        'id' => (int) $legacyMatch['id'],
        'title' => (string) ($legacyMatch['title'] ?: ('Fecha #' . $legacyMatch['id'])),
        'matchDate' => date('d/m/Y H:i', strtotime((string) $legacyMatch['match_date'])),
        'numTeams' => $legacyNumTeams,
    ] : null,
    'loadError' => $legacyLoadError,
    'players' => $legacyPlayers,
    'pairHistory' => $legacyPairHistory,
    'drawBalanceWeights' => json_decode($legacyDrawWeightsJson ?: '{}', true),
    'allowRedraw' => $legacyMatch ? ((int) ($legacyMatch['allow_redraw'] ?? 1) === 1) : true,
    'redrawLimit' => $legacyMatch ? (int) ($legacyMatch['redraw_limit'] ?? 3) : 3,
    'redrawCount' => $legacyMatch ? (int) ($legacyMatch['redraw_count'] ?? 0) : 0,
    'hasSavedDraw' => $legacyMatch ? ((string) ($legacyMatch['status'] ?? '') === 'sorteado' && (string) ($legacyMatch['draw_mode'] ?? '') === 'random') : false,
    'savedDrawSignature' => $legacySavedDrawSignature,
    'maxFieldPlayersPerLine' => 5,
    'numTeams' => $legacyNumTeams,
    'links' => [
        'back' => 'editar_partidos.php',
        'finish' => $legacyMatch ? 'finalizar_partido.php?match_id=' . (int) $legacyMatch['id'] : '',
    ],
];
$sorteoLegacyPayloadJson = json_encode(
    $sorteoLegacyPayload,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);
$title = 'Sortear equipos | ' . APP_NAME;
$activePage = 'editar_partidos.php';
$bodyClass = 'page-sorteo-legacy sorteo-page';
require __DIR__ . '/includes/header.php';
?>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<div
  class="sorteo-page"
  data-react-root
  data-react-island="sorteo_legacy_page"
  data-payload="<?= h($sorteoLegacyPayloadJson !== false ? $sorteoLegacyPayloadJson : '{}') ?>"
></div>
<?php require __DIR__ . '/includes/footer.php'; ?>
