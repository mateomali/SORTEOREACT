<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();

if (!function_exists('repo_match_participants_basic')) {
    function repo_match_participants_basic(int $matchId): array
    {
        $stmt = db()->prepare(
            'SELECT p.id, p.name, p.positions, p.pace, p.skill,
                    p.technique, p.rhythm, p.defense_physical, p.attack, p.teamwork, p.mentality, p.regularity, p.goalkeeper_skill
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
                'puntuacion' => player_overall_rating($p),
                'tecnica' => player_effective_stat($p, 'technique'),
                'ritmo_stat' => player_effective_stat($p, 'rhythm'),
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

$legacyPlayersJson = json_encode($legacyPlayers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$legacyPairHistoryJson = json_encode($legacyPairHistory, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$drawBalanceWeights = player_draw_balance_weights();
$legacyDrawWeightsJson = json_encode([
    'general' => $drawBalanceWeights['general'],
    'ataque' => $drawBalanceWeights['attack'],
    'solidez' => $drawBalanceWeights['defense_physical'],
    'ritmo' => $drawBalanceWeights['rhythm'],
    'tecnica' => $drawBalanceWeights['technique'],
    'compromiso' => $drawBalanceWeights['teamwork'],
    'mentalidad' => $drawBalanceWeights['mentality'],
    'regularidad' => $drawBalanceWeights['regularity'],
    'arquero' => $drawBalanceWeights['goalkeeper_skill'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$legacyNumTeams = $legacyMatch ? (int) $legacyMatch['num_teams'] : 2;
$legacyMaxDiff = 0.5;
$title = 'Sortear equipos | ' . APP_NAME;
$activePage = 'editar_partidos.php';
require __DIR__ . '/includes/header.php';
?>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<section class="sorteo-page">
  <div class="container">
    <div class="sorteo-backbar">
      <button type="button" data-sorteo-action="navigate" data-url="editar_partidos.php">Volver a fechas</button>
    </div>
    <h1><span class="soccer-ball"></span> Generador de Equipos GOODFELLAS <span class="soccer-ball"></span></h1>
    <?php if ($legacyMatch): ?>
      <div class="success mb-3">
        Fecha: <strong><?= h((string) ($legacyMatch['title'] ?: ('Fecha #' . $legacyMatch['id']))) ?></strong>
        | Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $legacyMatch['match_date']))) ?>
      </div>
    <?php endif; ?>
    <?php if ($legacyLoadError !== ''): ?>
      <div class="error mb-3"><?= h($legacyLoadError) ?></div>
    <?php endif; ?>
    <div class="controls">
      <?php if ($legacyMatch): ?>
        <button type="button" data-sorteo-action="navigate" data-url="finalizar_partido.php?match_id=<?= (int) $legacyMatch['id'] ?>">Finalizar fecha</button>
      <?php else: ?>
        <button type="button" data-sorteo-action="open-add-player"><span class="text-lg">+</span> Añadir Jugador</button>
      <?php endif; ?>
    </div>
    <div class="accordion">
      <div class="accordion-header" data-sorteo-action="toggle-accordion">
        <h3>👥 Jugadores Disponibles</h3>
      </div>
      <div class="accordion-content">
        <div class="players-list">
          <?php if (!$legacyMatch): ?>
            <div class="data-controls">
              <button type="button" data-sorteo-action="export-players-csv">💾 Guardar lista de jugadores</button>
              <label class="file-label">
                📥 Importar lista de jugadores
                <input type="file" class="file-input" id="csvInput" accept=".csv" data-sorteo-action="import-players-csv">
              </label>
            </div>
          <?php endif; ?>
          <div class="sort-controls">
            <div class="sort-dropdown" id="sortDropdown">
              <button class="sort-dropdown-btn" type="button" data-sorteo-action="toggle-sort-dropdown">
                <span>🔽 Ordenar por: Nombre</span>
                <span>▼</span>
              </button>
              <div class="sort-dropdown-content">
                <a href="#" data-sorteo-action="select-sort" data-sort-key="nombre">Nombre</a>
                <a href="#" data-sorteo-action="select-sort" data-sort-key="puntuacion">Puntuación</a>
                <a href="#" data-sorteo-action="select-sort" data-sort-key="ritmo">Ritmo</a>
              </div>
            </div>
          </div>
          <?php if (!$legacyMatch): ?>
            <div class="select-all">
              <label>
                <input type="checkbox" id="select-all" data-sorteo-action="toggle-select-all" checked>
                Seleccionar todos
              </label>
            </div>
          <?php endif; ?>
          <div id="jugadores-container"></div>
        </div>
      </div>
    </div>
    <div class="controls main-controls">
      <span id="teamDisplay" class="hidden"><?= h((string) $legacyNumTeams) ?></span>
      <span id="diffDisplay" class="hidden">0.5</span>
      <button id="generateTeamsButton" type="button" data-sorteo-action="generate-teams">⚽ Generar Equipos</button>
    </div>
    <div id="generateTeamsLoading" class="draw-loading" role="status" aria-live="polite" hidden>
      <strong>Generando equipos...</strong>
      <span>Buscando la combinacion mas equilibrada. Esto puede tardar unos segundos.</span>
      <div class="draw-loading-bar" aria-hidden="true"><span></span></div>
    </div>
    <div id="error" class="error"></div>
    <div id="success" class="success"></div>
    <div id="equipos-generados" class="teams-container"></div>
    <div class="controls mt-5 hidden" id="download-controls">
      <div class="download-action-row hidden" data-feature-flag="BOTONES DE CAPTURA">
        <button type="button" data-sorteo-action="copy-teams">📋 Copiar al Portapapeles</button>
        <button type="button" data-sorteo-action="download-teams-jpg">📸 Descargar como JPG</button>
        <button type="button" data-sorteo-action="download-teams-text">📝 Descargar como Texto</button>
      </div>
      <?php if ($legacyMatch): ?>
        <div class="download-save-row">
          <button type="button" data-sorteo-action="save-draw">💾 GUARDAR SORTEO</button>
        </div>
      <?php endif; ?>
    </div>
  </div>

  <div id="addModal" class="modal hidden">
    <div class="modal-content">
      <button type="button" class="close-modal" data-sorteo-action="close-modal" data-modal-id="addModal">×</button>
      <h3>Añadir Jugador</h3>
      <div class="form-row">
        <label>Nombre:</label>
        <input type="text" id="addNombre" required>
      </div>
      <div class="form-row">
        <label>Posiciones:</label>
        <div class="position-checkboxes">
          <label><input type="checkbox" class="addPosicion" value="ARQ"> 🥅 ARQ</label>
          <label><input type="checkbox" class="addPosicion" value="DEF"> 🛡️ DEF</label>
          <label><input type="checkbox" class="addPosicion" value="MED"> 🎯 MED</label>
          <label><input type="checkbox" class="addPosicion" value="DEL"> ⚽ DEL</label>
        </div>
      </div>
      <div class="form-row">
        <label>Ritmo:</label>
        <select id="addEdad">
          <option value="rápido">Rápido</option>
          <option value="lento">Lento</option>
        </select>
      </div>
      <div class="form-row">
        <label>Puntuación:</label>
        <div class="score-control" id="addScoreControl">
          <button type="button" data-sorteo-action="score-down" data-score-mode="add">−</button>
          <span id="addScoreDisplay">1.0</span>
          <button type="button" data-sorteo-action="score-up" data-score-mode="add">+</button>
        </div>
      </div>
      <div class="controls">
        <button type="button" data-sorteo-action="save-new-player">💾 Guardar</button>
        <button type="button" class="btn-muted" data-sorteo-action="close-modal" data-modal-id="addModal">❌ Cancelar</button>
      </div>
    </div>
  </div>

  <div id="editModal" class="modal hidden">
    <div class="modal-content">
      <button type="button" class="close-modal" data-sorteo-action="close-modal" data-modal-id="editModal">×</button>
      <h3>Editar Jugador</h3>
      <div class="form-row">
        <label>Nombre:</label>
        <input type="text" id="editNombre" required>
      </div>
      <div class="form-row">
        <label>Posiciones:</label>
        <div class="position-checkboxes">
          <label><input type="checkbox" class="editPosicion" value="ARQ"> 🥅 ARQ</label>
          <label><input type="checkbox" class="editPosicion" value="DEF"> 🛡️ DEF</label>
          <label><input type="checkbox" class="editPosicion" value="MED"> 🎯 MED</label>
          <label><input type="checkbox" class="editPosicion" value="DEL"> ⚽ DEL</label>
        </div>
      </div>
      <div class="form-row">
        <label>Ritmo:</label>
        <select id="editEdad">
          <option value="rápido">Rápido</option>
          <option value="lento">Lento</option>
        </select>
      </div>
      <div class="form-row">
        <label>Puntuación:</label>
        <div class="score-control" id="editScoreControl">
          <button type="button" data-sorteo-action="score-down" data-score-mode="edit">−</button>
          <span id="editScoreDisplay">1.0</span>
          <button type="button" data-sorteo-action="score-up" data-score-mode="edit">+</button>
        </div>
      </div>
      <div class="controls">
        <button type="button" data-sorteo-action="save-player-edit">💾 Guardar</button>
        <button type="button" class="btn-muted" data-sorteo-action="close-modal" data-modal-id="editModal">❌ Cancelar</button>
      </div>
    </div>
  </div>

  <script type="application/json" data-sorteo-legacy-config><?= json_encode([
    'matchId' => (int) $legacyMatchId,
    'players' => $legacyPlayers,
    'pairHistory' => $legacyPairHistory,
    'drawBalanceWeights' => json_decode($legacyDrawWeightsJson ?: '{}', true),
    'allowRedraw' => $legacyMatch ? ((int) ($legacyMatch['allow_redraw'] ?? 1) === 1) : true,
    'redrawLimit' => $legacyMatch ? (int) ($legacyMatch['redraw_limit'] ?? 3) : 3,
    'redrawCount' => $legacyMatch ? (int) ($legacyMatch['redraw_count'] ?? 0) : 0,
    'hasSavedDraw' => $legacyMatch ? ((string) ($legacyMatch['status'] ?? '') === 'sorteado' && (string) ($legacyMatch['draw_mode'] ?? '') === 'random') : false,
    'savedDrawSignature' => $legacySavedDrawSignature,
    'maxFieldPlayersPerLine' => 5,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
  <script src="assets/sorteo-legacy.js?v=<?= h((string) (@filemtime(__DIR__ . '/assets/sorteo-legacy.js') ?: time())) ?>"></script>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
