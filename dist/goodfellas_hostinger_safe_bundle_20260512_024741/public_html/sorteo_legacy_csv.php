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
<section class="mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 text-emerald-950 sm:px-5" data-sorteo-legacy-root>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <button class="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-extrabold text-emerald-950 shadow-sm transition hover:border-lime-300 hover:bg-lime-50" type="button" data-sorteo-action="navigate" data-url="editar_partidos.php">Volver a fechas</button>
    </div>
    <h1 class="m-0 rounded-2xl border border-lime-200/70 bg-emerald-950 px-4 py-4 text-2xl font-black leading-tight text-lime-50 shadow-lg shadow-emerald-950/20 sm:text-3xl">Generador de Equipos GOODFELLAS</h1>
    <?php if ($legacyMatch): ?>
      <div class="rounded-xl border border-lime-200/70 bg-lime-50 px-4 py-3 text-sm font-bold text-emerald-950">
        Fecha: <strong><?= h((string) ($legacyMatch['title'] ?: ('Fecha #' . $legacyMatch['id']))) ?></strong>
        | Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $legacyMatch['match_date']))) ?>
      </div>
    <?php endif; ?>
    <?php if ($legacyLoadError !== ''): ?>
      <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-800"><?= h($legacyLoadError) ?></div>
    <?php endif; ?>
    <div class="flex flex-wrap gap-2">
      <?php if ($legacyMatch): ?>
        <button class="inline-flex min-h-11 items-center justify-center rounded-xl border border-lime-200 bg-lime-100 px-4 py-2 text-sm font-extrabold text-emerald-950 shadow-sm transition hover:bg-lime-200" type="button" data-sorteo-action="navigate" data-url="finalizar_partido.php?match_id=<?= (int) $legacyMatch['id'] ?>">Finalizar fecha</button>
      <?php else: ?>
        <button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-lime-200 bg-lime-100 px-4 py-2 text-sm font-extrabold text-emerald-950 shadow-sm transition hover:bg-lime-200" type="button" data-sorteo-action="open-add-player"><span class="text-lg">+</span> Añadir Jugador</button>
      <?php endif; ?>
    </div>
    <div class="rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div class="flex cursor-pointer items-center justify-between gap-3 border-b border-emerald-100 px-4 py-3" data-sorteo-action="toggle-accordion">
        <h3>👥 Jugadores Disponibles</h3>
      </div>
      <div class="p-3">
        <div class="grid gap-3">
          <?php if (!$legacyMatch): ?>
            <div class="flex flex-wrap gap-2">
              <button class="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50" type="button" data-sorteo-action="export-players-csv">Guardar lista de jugadores</button>
              <label class="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50">
                📥 Importar lista de jugadores
                <input type="file" class="sr-only" id="csvInput" accept=".csv" data-sorteo-action="import-players-csv">
              </label>
            </div>
          <?php endif; ?>
          <div class="relative w-full sm:w-72">
            <div id="sortDropdown">
              <button class="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-950 px-3 py-2 text-sm font-extrabold text-lime-50 shadow-sm transition hover:bg-emerald-900" type="button" data-sorteo-action="toggle-sort-dropdown">
                <span>🔽 Ordenar por: Nombre</span>
                <span>▼</span>
              </button>
              <div class="absolute z-30 mt-2 hidden w-full overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xl" data-sort-dropdown-content>
                <a class="block px-3 py-2 text-sm font-bold text-emerald-950 hover:bg-lime-50" href="#" data-sorteo-action="select-sort" data-sort-key="nombre">Nombre</a>
                <a class="block px-3 py-2 text-sm font-bold text-emerald-950 hover:bg-lime-50" href="#" data-sorteo-action="select-sort" data-sort-key="puntuacion">Puntuación</a>
                <a class="block px-3 py-2 text-sm font-bold text-emerald-950 hover:bg-lime-50" href="#" data-sorteo-action="select-sort" data-sort-key="ritmo">Ritmo</a>
              </div>
            </div>
          </div>
          <?php if (!$legacyMatch): ?>
            <div>
              <label class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-950">
                <input class="h-4 w-4 accent-emerald-700" type="checkbox" id="select-all" data-sorteo-action="toggle-select-all" checked>
                Seleccionar todos
              </label>
            </div>
          <?php endif; ?>
          <div class="grid max-h-80 gap-2 overflow-auto rounded-xl border border-emerald-100 bg-emerald-50/40 p-2" id="jugadores-container"></div>
        </div>
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <span id="teamDisplay" class="hidden"><?= h((string) $legacyNumTeams) ?></span>
      <span id="diffDisplay" class="hidden">0.5</span>
      <button class="inline-flex min-h-12 items-center justify-center rounded-xl border border-lime-200 bg-lime-100 px-5 py-3 text-base font-black text-emerald-950 shadow-sm transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-70" id="generateTeamsButton" type="button" data-sorteo-action="generate-teams">Generar equipos</button>
    </div>
    <div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800" id="generateTeamsLoading" role="status" aria-live="polite" hidden>
      <strong class="block">Generando equipos...</strong>
      <span>Buscando la combinación más equilibrada. Esto puede tardar unos segundos.</span>
    </div>
    <div id="error" class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-800"></div>
    <div id="success" class="hidden rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-extrabold text-emerald-950"></div>
    <div id="equipos-generados" class="grid gap-4"></div>
    <div class="mt-2 hidden" id="download-controls">
      <div class="download-action-row hidden" data-feature-flag="BOTONES DE CAPTURA">
        <button type="button" data-sorteo-action="copy-teams">📋 Copiar al Portapapeles</button>
        <button type="button" data-sorteo-action="download-teams-jpg">📸 Descargar como JPG</button>
        <button type="button" data-sorteo-action="download-teams-text">📝 Descargar como Texto</button>
      </div>
      <?php if ($legacyMatch): ?>
        <div class="flex justify-center">
          <button class="inline-flex min-h-12 items-center justify-center rounded-xl border border-lime-200 bg-emerald-950 px-5 py-3 text-base font-black text-lime-50 shadow-sm transition hover:bg-emerald-900" type="button" data-sorteo-action="save-draw">Guardar sorteo</button>
        </div>
      <?php endif; ?>
    </div>
  </div>

  <div id="addModal" class="fixed inset-0 z-50 hidden grid place-items-center bg-emerald-950/70 p-4">
    <div class="grid w-full max-w-md gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl">
      <button type="button" class="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-lg font-black text-emerald-950 hover:bg-emerald-50" data-sorteo-action="close-modal" data-modal-id="addModal">×</button>
      <h3 class="m-0 text-lg font-black text-emerald-950">Añadir Jugador</h3>
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

  <div id="editModal" class="fixed inset-0 z-50 hidden grid place-items-center bg-emerald-950/70 p-4">
    <div class="grid w-full max-w-md gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl">
      <button type="button" class="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-lg font-black text-emerald-950 hover:bg-emerald-50" data-sorteo-action="close-modal" data-modal-id="editModal">×</button>
      <h3 class="m-0 text-lg font-black text-emerald-950">Editar Jugador</h3>
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
