<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

ensure_control_schema();

$pdo = db();
$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$teamView = isset($_GET['team']) ? (int) $_GET['team'] : 0;
$captainToken = trim((string) ($_GET['token'] ?? ''));
$viewMode = (string) ($_GET['view'] ?? '');

function captain_access_cookie_name(int $matchId): string
{
    return 'captain_access_' . $matchId;
}

function remember_captain_access(int $matchId, int $teamNumber, string $token): void
{
    $_SESSION['captain_access'][$matchId] = ['team' => $teamNumber, 'token' => $token];
    setcookie(captain_access_cookie_name($matchId), $teamNumber . '|' . $token, [
        'expires' => time() + 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function generated_captain_token(PDO $pdo, array $reserved = []): string
{
    $stmt = $pdo->prepare(
        'SELECT 1
         FROM captain_drafts
         WHERE captain1_token = :token1
            OR captain2_token = :token2
            OR captain3_token = :token3
            OR captain4_token = :token4
         LIMIT 1'
    );

    for ($attempt = 0; $attempt < 100; $attempt++) {
        $token = (string) random_int(1000, 9999);
        if (in_array($token, $reserved, true)) {
            continue;
        }
        $stmt->execute(['token1' => $token, 'token2' => $token, 'token3' => $token, 'token4' => $token]);
        if (!$stmt->fetchColumn()) {
            return $token;
        }
    }

    throw new RuntimeException('No se pudo generar un token disponible.');
}

function captain_numbers_from_draft(array $draft): array
{
    $numbers = [];
    foreach ([1, 2, 3, 4] as $teamNumber) {
        if ((int) ($draft['captain' . $teamNumber . '_player_id'] ?? 0) > 0) {
            $numbers[] = $teamNumber;
        }
    }
    return $numbers ?: [1, 2];
}

function captain_token_for_team(array $draft, int $teamNumber): string
{
    return (string) ($draft['captain' . $teamNumber . '_token'] ?? '');
}

function stored_captain_access(PDO $pdo, int $matchId): ?array
{
    if ($matchId <= 0) {
        return null;
    }

    $stored = $_SESSION['captain_access'][$matchId] ?? null;
    if (!is_array($stored)) {
        $cookie = (string) ($_COOKIE[captain_access_cookie_name($matchId)] ?? '');
        if ($cookie !== '' && str_contains($cookie, '|')) {
            [$team, $token] = explode('|', $cookie, 2);
            $stored = ['team' => (int) $team, 'token' => trim($token)];
        }
    }

    $teamNumber = (int) ($stored['team'] ?? 0);
    $token = trim((string) ($stored['token'] ?? ''));
    if (!in_array($teamNumber, [1, 2, 3, 4], true) || $token === '') {
        return null;
    }

    $stmt = $pdo->prepare(
        'SELECT d.*, m.status AS match_status
         FROM captain_drafts d
         INNER JOIN matches m ON m.id = d.match_id
         WHERE d.match_id = :mid
         LIMIT 1'
    );
    $stmt->execute(['mid' => $matchId]);
    $draft = $stmt->fetch();
    if (!$draft || (string) ($draft['match_status'] ?? '') === 'finalizado') {
        return null;
    }

    $expectedToken = captain_token_for_team($draft, $teamNumber);
    if ($expectedToken === '' || !hash_equals($expectedToken, $token)) {
        return null;
    }

    remember_captain_access($matchId, $teamNumber, $token);
    return ['team' => $teamNumber, 'token' => $token];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'captain_token_login') {
    $postedToken = trim((string) ($_POST['captain_token'] ?? ''));
    if ($postedToken === '') {
        flash('error', 'Ingresa el token de capitan.');
        redirect('index.php');
    }

    $stmt = $pdo->prepare(
        'SELECT d.*, m.status AS match_status
         FROM captain_drafts d
         INNER JOIN matches m ON m.id = d.match_id
         WHERE d.captain1_token = :token1
            OR d.captain2_token = :token2
            OR d.captain3_token = :token3
            OR d.captain4_token = :token4
         LIMIT 1'
    );
    $stmt->execute(['token1' => $postedToken, 'token2' => $postedToken, 'token3' => $postedToken, 'token4' => $postedToken]);
    $draftByToken = $stmt->fetch();
    if (!$draftByToken) {
        flash('error', 'Token de capitan invalido.');
        redirect('index.php');
    }
    if ((string) ($draftByToken['match_status'] ?? '') === 'finalizado') {
        flash('error', 'Esa fecha ya finalizo.');
        redirect('index.php');
    }

    $tokenTeam = 0;
    foreach (captain_numbers_from_draft($draftByToken) as $candidateTeam) {
        if (hash_equals(captain_token_for_team($draftByToken, $candidateTeam), $postedToken)) {
            $tokenTeam = $candidateTeam;
            break;
        }
    }
    if ($tokenTeam === 0) {
        flash('error', 'Token de capitan invalido.');
        redirect('index.php');
    }
    remember_captain_access((int) $draftByToken['match_id'], $tokenTeam, $postedToken);
    redirect('capitanes.php?match_id=' . (int) $draftByToken['match_id'] . '&team=' . $tokenTeam . '&token=' . urlencode($postedToken));
}

if ($matchId > 0 && ($captainToken === '' || !in_array($teamView, [1, 2, 3, 4], true))) {
    $storedAccess = stored_captain_access($pdo, $matchId);
    if ($storedAccess) {
        $teamView = (int) $storedAccess['team'];
        $captainToken = (string) $storedAccess['token'];
    }
}

$isCaptainView = in_array($teamView, [1, 2, 3, 4], true) && $captainToken !== '';

if (!$isCaptainView) {
    require_admin();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'start_draft') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $captainCount = (int) ($_POST['captain_count'] ?? 2);
    $captains = [];
    foreach ([1, 2, 3, 4] as $teamNumber) {
        $captainId = (int) ($_POST['captain' . $teamNumber] ?? 0);
        if ($teamNumber <= $captainCount) {
            $captains[$teamNumber] = $captainId;
        }
    }
    $participants = repo_match_participants_basic($matchId);
    $participantIds = array_map(static fn(array $p): int => (int) $p['id'], $participants);

    if ($matchId <= 0 || !$participants) {
        flash('error', 'Selecciona una fecha con convocados.');
        redirect('capitanes.php');
    }
    if (!in_array($captainCount, [2, 3, 4], true)) {
        flash('error', 'Elige si el draft sera de 2, 3 o 4 capitanes.');
        redirect('capitanes.php?match_id=' . $matchId);
    }
    if (count($participants) % $captainCount !== 0) {
        flash('error', 'La cantidad de convocados debe dividirse exacto entre ' . $captainCount . ' capitanes.');
        redirect('capitanes.php?match_id=' . $matchId);
    }
    $captainIds = array_values($captains);
    if (count(array_filter($captainIds)) !== $captainCount || count(array_unique($captainIds)) !== $captainCount) {
        flash('error', 'Elige ' . $captainCount . ' capitanes distintos.');
        redirect('capitanes.php?match_id=' . $matchId);
    }
    foreach ($captainIds as $captainId) {
        if (!in_array($captainId, $participantIds, true)) {
            flash('error', 'Todos los capitanes deben estar dentro de los convocados.');
            redirect('capitanes.php?match_id=' . $matchId);
        }
    }

    $participantSkills = [];
    foreach ($participants as $participant) {
        $pid = (int) $participant['id'];
        $participantSkills[$pid] = (float) $participant['skill'];
    }
    $orderedTeams = array_keys($captains);
    usort($orderedTeams, static function (int $a, int $b) use ($captains, $participantSkills): int {
        $skillCompare = ($participantSkills[$captains[$a]] ?? 0.0) <=> ($participantSkills[$captains[$b]] ?? 0.0);
        return $skillCompare !== 0 ? $skillCompare : $a <=> $b;
    });
    $firstTeam = $orderedTeams[0];

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare(
            'UPDATE match_players
             SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0
             WHERE match_id = :mid'
        )->execute(['mid' => $matchId]);

        $tokens = [];
        foreach ($captains as $teamNumber => $_captainId) {
            $tokens[$teamNumber] = generated_captain_token($pdo, array_values($tokens));
        }
        $pdo->prepare(
            'INSERT INTO captain_drafts (
                match_id,
                captain1_player_id, captain2_player_id, captain3_player_id, captain4_player_id,
                captain1_token, captain2_token, captain3_token, captain4_token,
                current_team, status, started_at
             )
             VALUES (
                :mid,
                :c1, :c2, :c3, :c4,
                :t1, :t2, :t3, :t4,
                :current_team, "active", NOW()
             )'
        )->execute([
            'mid' => $matchId,
            'c1' => $captains[1] ?? null,
            'c2' => $captains[2] ?? null,
            'c3' => $captains[3] ?? null,
            'c4' => $captains[4] ?? null,
            't1' => $tokens[1] ?? null,
            't2' => $tokens[2] ?? null,
            't3' => $tokens[3] ?? null,
            't4' => $tokens[4] ?? null,
            'current_team' => $firstTeam,
        ]);
        $insertPick = $pdo->prepare(
            'INSERT INTO captain_picks (match_id, player_id, team_number, picked_by_player_id, pick_order)
             VALUES (:mid, :pid, :team, :picker, :pick_order)'
        );
        $updateCaptainTeam = $pdo->prepare('UPDATE match_players SET team_number = :team WHERE match_id = :mid AND player_id = :pid');
        foreach ($orderedTeams as $index => $teamNumber) {
            $captainId = $captains[$teamNumber];
            $insertPick->execute([
                'mid' => $matchId,
                'pid' => $captainId,
                'team' => $teamNumber,
                'picker' => $captainId,
                'pick_order' => $index + 1,
            ]);
            $updateCaptainTeam->execute(['mid' => $matchId, 'pid' => $captainId, 'team' => $teamNumber]);
        }
        $pdo->prepare('UPDATE matches SET status = "programado", draw_mode = "captains", draw_started_at = NOW(), draw_completed_at = NULL, finalized_at = NULL WHERE id = :mid')->execute(['mid' => $matchId]);

        $pdo->commit();
        flash('success', 'Modo capitanes iniciado.');
        redirect('capitanes.php?match_id=' . $matchId);
    } catch (Throwable $e) {
        $pdo->rollBack();
        flash('error', 'No se pudo iniciar: ' . $e->getMessage());
        redirect('capitanes.php?match_id=' . $matchId);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'reset_draft') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    if ($matchId > 0) {
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
            $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
            $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
            $pdo->prepare(
                'UPDATE match_players
                 SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0
                 WHERE match_id = :mid'
            )->execute(['mid' => $matchId]);
            $pdo->prepare('UPDATE matches SET status = "programado", draw_mode = "none", draw_started_at = NULL, draw_completed_at = NULL, finalized_at = NULL WHERE id = :mid')->execute(['mid' => $matchId]);
            $pdo->commit();
            flash('success', 'Draft reiniciado.');
        } catch (Throwable $e) {
            $pdo->rollBack();
            flash('error', 'No se pudo reiniciar: ' . $e->getMessage());
        }
    }
    redirect($matchId > 0 ? 'capitanes.php?match_id=' . $matchId : 'capitanes.php');
}

$matches = repo_matches("status IN ('programado','sorteado')");
$selectedMatch = $matchId > 0 ? repo_match_by_id($matchId) : null;
$participants = $selectedMatch ? repo_match_participants_basic((int) $selectedMatch['id']) : [];
$draft = null;
if ($selectedMatch) {
    $stmt = $pdo->prepare('SELECT * FROM captain_drafts WHERE match_id = :mid LIMIT 1');
    $stmt->execute(['mid' => (int) $selectedMatch['id']]);
    $draft = $stmt->fetch() ?: null;
    $needsShortTokens = false;
    if ($draft) {
        foreach (captain_numbers_from_draft($draft) as $teamNumber) {
            if (!preg_match('/^\d{4}$/', captain_token_for_team($draft, $teamNumber))) {
                $needsShortTokens = true;
                break;
            }
        }
    }
    if ($needsShortTokens) {
        $tokens = [];
        $params = ['mid' => (int) $selectedMatch['id']];
        $sets = [];
        foreach (captain_numbers_from_draft($draft) as $teamNumber) {
            $token = generated_captain_token($pdo, array_values($tokens));
            $tokens[$teamNumber] = $token;
            $draft['captain' . $teamNumber . '_token'] = $token;
            $sets[] = 'captain' . $teamNumber . '_token = :t' . $teamNumber;
            $params['t' . $teamNumber] = $token;
        }
        if ($sets) {
            $pdo->prepare('UPDATE captain_drafts SET ' . implode(', ', $sets) . ' WHERE match_id = :mid')->execute($params);
        }
    }
}
$generatedTeams = $selectedMatch ? repo_match_teams((int) $selectedMatch['id']) : [];
$hasGeneratedTeams = $selectedMatch
    && in_array((string) ($selectedMatch['status'] ?? ''), ['sorteado', 'finalizado'], true)
    && count($generatedTeams) >= 2;

$captainCards = [];
if ($selectedMatch && $draft) {
    $participantNames = [];
    foreach ($participants as $participant) {
        $participantId = (int) ($participant['id'] ?? 0);
        $participantNames[$participantId] = (string) $participant['name'];
    }
    $matchLabel = (string) ($selectedMatch['title'] ?: ('Fecha #' . $selectedMatch['id']));
    foreach (captain_numbers_from_draft($draft) as $teamNumber) {
        $captainId = (int) ($draft['captain' . $teamNumber . '_player_id'] ?? 0);
        $name = $participantNames[$captainId] ?? ('Capitan ' . $teamNumber);
        $token = captain_token_for_team($draft, $teamNumber);
        $captainCards[] = [
            'team' => $teamNumber,
            'name' => $name,
            'token' => $token,
            'share_text' => "Token para elegir equipo como " . $name . "\n" . $matchLabel . "\n\n" . $token,
            'open_url' => 'capitanes.php?match_id=' . (int) $selectedMatch['id'] . '&team=' . $teamNumber . '&token=' . urlencode($token),
        ];
    }
}

$title = 'Capitanes | ' . APP_NAME;
$activePage = 'capitanes.php';
$backUrl = $isCaptainView
    ? 'index.php'
    : 'editar_partidos.php' . ($selectedMatch ? '#partido-admin-' . (int) $selectedMatch['id'] : '');
$backLabel = $isCaptainView ? 'Volver al inicio' : 'Volver a fechas';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1><?= $isCaptainView ? 'Eleccion de capitan' : 'Modo capitanes' ?></h1>
    <p class="small-muted"><?= $isCaptainView ? 'Espera tu turno y elige un jugador.' : 'Draft remoto por turnos sobre los convocados de la fecha.' ?></p>
  </div>
  <a class="btn btn-muted" href="<?= h($backUrl) ?>"><?= h($backLabel) ?></a>
</section>

<?php if (!$isCaptainView): ?>
<section class="card mb-3.5">
  <form method="get" class="form-grid">
    <div class="form-row">
      <label>Seleccionar fecha</label>
      <select name="match_id" onchange="this.form.submit()">
        <option value="">Elegir...</option>
        <?php foreach ($matches as $m): ?>
          <option value="<?= (int) $m['id'] ?>" <?= selected_attr($selectedMatch && (int) $selectedMatch['id'] === (int) $m['id']) ?>>
            <?= h(date('d/m H:i', strtotime((string) $m['match_date'])) . ' - ' . ($m['title'] ?: ('Fecha #' . $m['id'])) . ' [' . $m['participants_count'] . ' jugadores]') ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
  </form>
</section>
<?php endif; ?>

<?php if ($selectedMatch && !$draft && !$hasGeneratedTeams && !$isCaptainView): ?>
  <section class="card">
    <h3>Iniciar draft</h3>
    <form method="post" class="form-grid">
      <input type="hidden" name="action" value="start_draft">
      <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
      <div class="form-row">
        <label>Cantidad de capitanes</label>
        <select name="captain_count" id="captainCountSelect" required>
          <option value="2">2 capitanes</option>
          <option value="3">3 capitanes</option>
          <option value="4">4 capitanes</option>
        </select>
      </div>
      <?php for ($teamNumber = 1; $teamNumber <= 4; $teamNumber++): ?>
      <div class="form-row">
        <label>Capitan equipo <?= $teamNumber ?></label>
        <select name="captain<?= $teamNumber ?>" <?= $teamNumber <= 2 ? 'required' : '' ?>>
          <option value="">Elegir...</option>
          <?php foreach ($participants as $p): ?>
            <option value="<?= (int) $p['id'] ?>"><?= h((string) $p['name'] . ' - ' . $p['positions'] . ' - ' . skill_label((float) $p['skill'])) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <?php endfor; ?>
      <div class="btn-row">
        <button class="btn btn-primary" type="submit">Iniciar modo capitanes</button>
      </div>
    </form>
    <script>
      (() => {
        const countSelect = document.getElementById('captainCountSelect');
        if (!countSelect) return;
        const rows = [...countSelect.form.querySelectorAll('select[name^="captain"]')]
          .filter(select => select.name !== 'captain_count')
          .map(select => select.closest('.form-row'));
        const syncCaptainRows = () => {
          const count = parseInt(countSelect.value || '2', 10);
          rows.forEach((row, index) => {
            const enabled = index < count;
            row.hidden = !enabled;
            const select = row.querySelector('select');
            select.required = enabled;
            if (!enabled) {
              select.value = '';
            }
          });
        };
        countSelect.addEventListener('change', syncCaptainRows);
        syncCaptainRows();
      })();
    </script>
  </section>
<?php elseif ($selectedMatch && ($draft || $hasGeneratedTeams)): ?>
  <?php if (!$isCaptainView): ?>
  <section class="card mb-3.5">
    <h3><?= h((string) ($selectedMatch['title'] ?: ('Fecha #' . $selectedMatch['id']))) ?></h3>
    <?php if ($draft): ?>
      <p class="small-muted">Pasa estos tokens a cada capitan. Desde Inicio pueden tocar Soy capitan, pegar el token y entrar a elegir.</p>
      <div
        data-react-root
        data-react-island="captain_tokens"
        data-captain-cards="<?= h(json_encode($captainCards, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
      ></div>
    <?php else: ?>
      <p class="small-muted">Equipos generados. Como admin podes ajustar formaciones, usar presets y arrastrar jugadores en ambos equipos.</p>
    <?php endif; ?>
    <div class="btn-row">
      <a class="btn btn-muted" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>">Ver equipos</a>
      <?php if ($draft): ?>
        <form method="post" class="inline">
          <input type="hidden" name="action" value="reset_draft">
          <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
          <button class="btn btn-danger" type="submit" data-confirm="Reiniciar el draft de capitanes?">Reiniciar</button>
        </form>
      <?php endif; ?>
    </div>
  </section>
  <?php endif; ?>

  <section
    class="captain-board"
    id="formacion"
    data-match-id="<?= (int) $selectedMatch['id'] ?>"
    data-team-view="<?= in_array($teamView, [1, 2, 3, 4], true) ? $teamView : 0 ?>"
    data-token="<?= h($captainToken) ?>"
    data-view-mode="<?= h($viewMode) ?>"
    data-admin-editor="<?= (!$isCaptainView && is_admin()) ? '1' : '0' ?>"
  >
    <div class="captain-waiting-panel" id="captainWaitingPanel" hidden>
      <div class="captain-waiting-card" role="status" aria-live="polite">
        <span class="captain-waiting-kicker">Modo capitanes</span>
        <strong>ESPERANDO JUGADOR</strong>
        <span id="captainWaitingText" class="captain-waiting-text">Aguardando la eleccion del otro capitan.</span>
        <div class="captain-waiting-teams" aria-label="Estado actual del draft">
        </div>
      </div>
    </div>

    <div class="captain-status card">
      <h3 id="draftTitle">Cargando...</h3>
      <div id="captainTurnBanner" class="captain-turn-banner hidden" role="status" aria-live="polite"></div>
      <p id="draftTurn" class="small-muted"></p>
      <p id="draftFormationHint" class="captain-formation-hint" hidden>Arrastra y suelta jugadores para cambiar el orden o intercambiar posiciones entre filas.</p>
      <div id="draftMessage" class="flash flash-info hidden"></div>
    </div>

    <div class="grid cols-2 captain-teams-grid mt-3.5" id="captainTeamsGrid">
    </div>

    <section class="card mt-3.5">
      <h3>Jugadores disponibles</h3>
      <div id="availablePots" class="captain-pots"></div>
    </section>
  </section>

  <script>
    (() => {
      const board = document.querySelector('.captain-board');
      const matchId = parseInt(board.dataset.matchId, 10);
      const teamView = parseInt(board.dataset.teamView, 10);
      const captainToken = board.dataset.token || '';
      const viewMode = board.dataset.viewMode || '';
      const adminEditor = board.dataset.adminEditor === '1';
      const positions = ['ARQ', 'DEF', 'MED', 'DEL'];
      let state = null;
      const formationDrafts = {};
      const formationOrders = {};
      let formationInteractionUntil = 0;
      let formationDragState = null;
      let formationDragTarget = null;
      let formationDropHandled = false;
      let hasRenderedState = false;
      let pollingTimer = null;

      const escapeHtml = (value) => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

      const formatSkill = (value) => {
        const number = Number(value || 0);
        return `${Number.isInteger(number) ? String(number) : number.toFixed(1)}⭐`;
      };
      const playerMeta = (p) => `${escapeHtml(p.positions)} | ${escapeHtml(p.pace_label)} | ${formatSkill(p.skill)}`;
      const teamTotalSkill = (teamNumber) => {
        const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
        return players.reduce((total, player) => total + Number(player.skill || 0), 0);
      };
      const statValue = (player, field) => {
        const value = Number(player[field]);
        if (Number.isFinite(value) && value > 0) return value;
        return field === 'regularity' ? 3.5 : Number(player.skill || 0);
      };
      const lowRhythm = (player) => statValue(player, 'rhythm') <= 3;
      const teamCharacteristics = (players) => {
        const average = (field) => players.length
          ? players.reduce((sum, player) => sum + statValue(player, field), 0) / players.length
          : 0;
        const goalkeeperSkill = players.reduce((max, player) => {
          if (!String(player.positions || '').split('/').map(pos => pos.trim().toUpperCase()).includes('ARQ')) return max;
          return Math.max(max, statValue(player, 'goalkeeper_skill'));
        }, 0);
        return {
          total: players.reduce((sum, player) => sum + Number(player.skill || 0), 0),
          attack: average('attack'),
          defensePhysical: average('defense_physical'),
          rhythm: average('rhythm'),
          technique: average('technique'),
          teamwork: average('teamwork'),
          regularity: average('regularity'),
          goalkeeperSkill,
          slow: players.filter(lowRhythm).length,
          fast: players.filter(player => !lowRhythm(player)).length,
        };
      };
      const teamCharacteristicsHtml = (teamNumber, players) => {
        const summary = teamCharacteristics(players);
        return `
          <div class="team-characteristics-card captain-team-characteristics" data-team-characteristics="${teamNumber}">
            <strong>Caracteristicas del equipo</strong>
            <div class="team-characteristics-main">
              <span>General ${summary.total.toFixed(1)}</span>
              <span>${summary.fast} rapidos / ${summary.slow} lentos</span>
            </div>
            <div class="team-characteristics-stats">
              ${summary.goalkeeperSkill > 0 ? `<span>Arquero ${summary.goalkeeperSkill.toFixed(1)}</span>` : `<span>Ataque ${summary.attack.toFixed(1)}</span>`}
              <span>Solidez ${summary.defensePhysical.toFixed(1)}</span>
              <span>Ritmo ${summary.rhythm.toFixed(1)}</span>
              <span>Tecnica ${summary.technique.toFixed(1)}</span>
              <span>Compromiso ${summary.teamwork.toFixed(1)}</span>
              <span>Regularidad ${summary.regularity.toFixed(1)}</span>
            </div>
          </div>
        `;
      };
      const teamNumbers = () => (state?.match?.team_numbers || Object.keys(state?.draft?.captains || {})).map(Number).filter(Boolean);
      const updateTeamTitle = (teamNumber) => {
        const title = document.getElementById(`team${teamNumber}Title`);
        if (!title || !state?.ok) return;
        const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
        const captainName = state.draft?.captains?.[teamNumber]?.name || `Equipo ${teamNumber}`;
        const targetSize = state.match?.target_team_size || players.length;
        title.textContent = `Equipo ${teamNumber} - ${captainName} (${players.length}/${targetSize}) - ${teamTotalSkill(teamNumber).toFixed(1)} pts`;
      };
      const updateTeamTitles = () => {
        teamNumbers().forEach(updateTeamTitle);
      };
      const currentCaptainName = () => state?.draft?.current_captain || (state?.draft?.current_team ? state.draft.captains[state.draft.current_team]?.name : '') || '';
      const isMyTurn = () => captainToken !== '' && teamView > 0 && state?.draft?.status === 'active' && state.draft.current_team === teamView;
      const isMyWaitingTurn = () => captainToken !== '' && teamNumbers().includes(teamView) && state?.draft?.status === 'active' && state.draft.current_team !== teamView;

      const ensureTeamCards = () => {
        const grid = document.getElementById('captainTeamsGrid');
        if (!grid || !state?.ok) return;
        const existing = [...grid.querySelectorAll('[data-captain-team-card]')].map(card => parseInt(card.dataset.captainTeamCard, 10));
        const desired = teamNumbers();
        if (existing.length === desired.length && existing.every((team, index) => team === desired[index])) {
          return;
        }
        grid.innerHTML = desired.map(teamNumber => `
          <article class="card" data-captain-team-card="${teamNumber}">
            <h3 id="team${teamNumber}Title">Equipo ${teamNumber}</h3>
            <div id="team${teamNumber}List" class="captain-team-list"></div>
          </article>
        `).join('');
      };

      const renderWaitingTeam = (teamNumber) => {
        const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
        const captain = state.draft.captains[teamNumber]?.name || `Equipo ${teamNumber}`;
        const targetSize = state.match.target_team_size || players.length;
        const title = document.getElementById(`captainWaitingTeam${teamNumber}Title`);
        const list = document.getElementById(`captainWaitingTeam${teamNumber}List`);
        if (!title || !list) return;

        title.textContent = `${captain} (${players.length}/${targetSize}) - ${teamTotalSkill(teamNumber).toFixed(1)} pts`;
        list.innerHTML = players.length
          ? players.map(player => `<span>${escapeHtml(player.name)}</span>`).join('')
          : '<em>Sin jugadores.</em>';
      };

      const markFormationInteraction = () => {
        formationInteractionUntil = Date.now() + 5000;
      };

      const isDesktopDrag = () => window.matchMedia('(min-width: 761px)').matches;

      const isFormationInteractionActive = () => {
        const active = document.activeElement;
        return Date.now() < formationInteractionUntil
          || active?.classList?.contains('captain-position-select')
          || active?.closest?.('.captain-formation-field')
          || active?.closest?.('.captain-board button, .captain-board select, .captain-board input');
      };

      const shouldStopAutoRefresh = () => {
        return state
          && state.ok
          && state.draft.status === 'completed'
          && (
            (teamView > 0 && captainToken !== '' && viewMode === 'formacion')
            || adminEditor
          );
      };

      const stopAutoRefresh = () => {
        if (pollingTimer) {
          window.clearInterval(pollingTimer);
          pollingTimer = null;
        }
      };

      const clearFormationDragHighlights = () => {
        document.querySelectorAll('.is-team-drag-over, .is-drag-over')
          .forEach(el => el.classList.remove('is-team-drag-over', 'is-drag-over'));
      };

      board.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button, select, input, .captain-formation-player')) {
          markFormationInteraction();
        }
      });

      board.addEventListener('focusin', (event) => {
        if (event.target.closest('button, select, input, .captain-formation-field')) {
          markFormationInteraction();
        }
      });

      board.addEventListener('dragover', (event) => {
        if (!formationDragState) return;
        const target = event.target.closest('[data-drag-player-id], [data-drop-team], [data-captain-team-card]');
        if (target) {
          formationDragTarget = target;
        }
      }, true);

      board.addEventListener('drop', (event) => {
        if (!formationDragState) return;
        const changed = handleFormationDrop(event, event.target);
        if (changed) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);

      const updateWaitingPanel = () => {
        const panel = document.getElementById('captainWaitingPanel');
        const text = document.getElementById('captainWaitingText');
        const waitingTeams = panel?.querySelector('.captain-waiting-teams');
        if (!panel || !state || !state.ok) return;

        const isWaiting = isMyWaitingTurn();

        panel.hidden = !isWaiting;
        if (isWaiting && text) {
          if (waitingTeams) {
            waitingTeams.innerHTML = teamNumbers().map(teamNumber => `
              <section>
                <h4 id="captainWaitingTeam${teamNumber}Title">Equipo ${teamNumber}</h4>
                <div id="captainWaitingTeam${teamNumber}List"></div>
              </section>
            `).join('');
          }
          text.textContent = currentCaptainName()
            ? `Esperando a ${currentCaptainName()}.`
            : 'Aguardando la eleccion del otro capitan.';
          teamNumbers().forEach(renderWaitingTeam);
        }
      };

      const updateTurnBanner = () => {
        const banner = document.getElementById('captainTurnBanner');
        if (!banner || !state || !state.ok) return;

        banner.className = 'captain-turn-banner hidden';
        banner.innerHTML = '';

        if (state.draft.status !== 'active') {
          return;
        }

        const captainName = currentCaptainName();
        const currentTeam = state.draft.current_team;
        if (!captainName || !currentTeam) {
          return;
        }

        banner.classList.remove('hidden');
        if (isMyTurn()) {
          banner.classList.add('is-your-turn');
          banner.innerHTML = `
            <span>TU TURNO</span>
            <strong>${escapeHtml(captainName)}, te toca elegir</strong>
            <small>Selecciona un jugador disponible para pasar el turno.</small>
          `;
          return;
        }

        banner.classList.add('is-waiting-turn');
        const waitingText = teamNumbers().includes(teamView)
          ? 'Cuando termine su eleccion, la pantalla se actualiza sola.'
          : 'El draft esta esperando esa eleccion para continuar.';
        banner.innerHTML = `
          <span>ESPERANDO A</span>
          <strong>${escapeHtml(captainName)}</strong>
          <small>${escapeHtml(waitingText)}</small>
        `;
      };

      const formationPresets = (playersCount) => {
        const fieldPlayers = Math.max(0, playersCount - 1);
        const balancedDef = Math.max(1, Math.floor(fieldPlayers / 3));
        const balancedMed = Math.max(1, Math.ceil(fieldPlayers / 3));
        const balancedDel = Math.max(0, fieldPlayers - balancedDef - balancedMed);
        const offensiveDef = Math.max(1, Math.floor(fieldPlayers / 4));
        const offensiveDel = Math.max(1, Math.ceil(fieldPlayers / 3));
        const offensiveMed = Math.max(0, fieldPlayers - offensiveDef - offensiveDel);
        const defensiveDef = Math.max(1, Math.ceil(fieldPlayers / 3));
        const defensiveDel = Math.max(1, Math.floor(fieldPlayers / 4));
        const defensiveMed = Math.max(0, fieldPlayers - defensiveDef - defensiveDel);
        return [
          { name: `Equilibrada ${balancedDef}-${balancedMed}-${balancedDel}`, counts: { DEF: balancedDef, MED: balancedMed, DEL: balancedDel } },
          { name: `Ofensiva ${offensiveDef}-${offensiveMed}-${offensiveDel}`, counts: { DEF: offensiveDef, MED: offensiveMed, DEL: offensiveDel } },
          { name: `Defensiva ${defensiveDef}-${defensiveMed}-${defensiveDel}`, counts: { DEF: defensiveDef, MED: defensiveMed, DEL: defensiveDel } },
        ];
      };

      const applyFormationPreset = (container, players, presetIndex) => {
        const preset = formationPresets(players.length)[presetIndex];
        if (!preset) return;
        const teamNumber = parseInt(container.dataset.formationTeam || '0', 10);
        const goalkeeper = players.find(p => String(p.positions).split('/').includes('ARQ')) || players[0];
        const remaining = players.filter(p => p.id !== goalkeeper.id);
        const assignments = {};
        if (goalkeeper) {
          assignments[goalkeeper.id] = 'ARQ';
        }
        for (const line of ['DEF', 'MED', 'DEL']) {
          let needed = preset.counts[line] || 0;
          const preferred = remaining.filter(p => !assignments[p.id] && String(p.positions).split('/').includes(line));
          const fallback = remaining.filter(p => !assignments[p.id] && !preferred.includes(p));
          for (const player of [...preferred, ...fallback]) {
            if (needed <= 0) break;
            assignments[player.id] = line;
            needed--;
          }
        }
        remaining.filter(p => !assignments[p.id]).forEach(p => {
          assignments[p.id] = p.primary_position && p.primary_position !== 'ARQ' ? p.primary_position : 'MED';
        });
        if (teamNumber > 0) {
          formationDrafts[teamNumber] = { ...(formationDrafts[teamNumber] || {}), ...assignments };
        }
        renderFormationLines(container, players);
        renderCustomFormationControls(container, players);
      };

      const fieldLineCounts = (teamNumber, players) => {
        const counts = { DEF: 0, MED: 0, DEL: 0 };
        players.forEach((player) => {
          const position = formationDrafts[teamNumber]?.[player.id] || player.assigned_position || player.primary_position || 'MED';
          if (counts[position] !== undefined) {
            counts[position]++;
          }
        });
        return counts;
      };

      const normalizeCustomCounts = (currentCounts, changedLine, nextValue, total) => {
        const lines = ['DEF', 'MED', 'DEL'];
        const counts = { ...currentCounts };
        counts[changedLine] = Math.max(0, Math.min(total, Number(nextValue) || 0));
        let remaining = total - counts[changedLine];
        const others = lines.filter(line => line !== changedLine);
        const originalOtherTotal = others.reduce((sum, line) => sum + (currentCounts[line] || 0), 0);

        others.forEach((line, index) => {
          if (index === others.length - 1) {
            counts[line] = remaining;
            return;
          }
          const share = originalOtherTotal > 0
            ? Math.min(remaining, Math.round(remaining * ((currentCounts[line] || 0) / originalOtherTotal)))
            : Math.floor(remaining / (others.length - index));
          counts[line] = Math.max(0, share);
          remaining -= counts[line];
        });

        return counts;
      };

      const applyFormationCounts = (container, players, counts) => {
        const teamNumber = parseInt(container.dataset.formationTeam || '0', 10);
        ensureFormationState(teamNumber, players);
        const currentGoalkeeper = players.find(player => formationDrafts[teamNumber]?.[player.id] === 'ARQ');
        const capableGoalkeeper = players.find(player => String(player.positions).split('/').includes('ARQ'));
        const goalkeeper = currentGoalkeeper || capableGoalkeeper || players[0];
        const fieldPlayers = orderedFormationPlayers(teamNumber, players, 'DEF')
          .concat(orderedFormationPlayers(teamNumber, players, 'MED'))
          .concat(orderedFormationPlayers(teamNumber, players, 'DEL'))
          .concat(players.filter(player => player.id !== goalkeeper?.id && formationDrafts[teamNumber]?.[player.id] === 'ARQ'))
          .filter(player => player.id !== goalkeeper?.id);

        if (goalkeeper) {
          formationDrafts[teamNumber][goalkeeper.id] = 'ARQ';
        }

        let cursor = 0;
        ['DEF', 'MED', 'DEL'].forEach((line) => {
          const needed = counts[line] || 0;
          for (let i = 0; i < needed && cursor < fieldPlayers.length; i++, cursor++) {
            formationDrafts[teamNumber][fieldPlayers[cursor].id] = line;
          }
        });

        renderFormationLines(container, players);
        renderCustomFormationControls(container, players);
      };

      const renderCustomFormationControls = (container, players) => {
        const panel = container.querySelector('[data-custom-formation-panel]');
        if (!panel) return;
        const presetSelect = container.querySelector('[data-formation-preset]');
        const isCustom = !presetSelect || presetSelect.value === '';
        panel.hidden = !isCustom;
        if (!isCustom) return;

        const teamNumber = parseInt(container.dataset.formationTeam || '0', 10);
        ensureFormationState(teamNumber, players);
        const total = Math.max(0, players.length - 1);
        const counts = fieldLineCounts(teamNumber, players);
        panel.innerHTML = `
          <span class="captain-custom-total">${counts.DEF + counts.MED + counts.DEL}/${total} jugadores de campo</span>
          ${['DEF', 'MED', 'DEL'].map(line => `
            <label class="captain-custom-count">
              <span>${line}</span>
              <button type="button" data-custom-line="${line}" data-custom-delta="-1">-</button>
              <input type="number" min="0" max="${total}" value="${counts[line]}" data-custom-line-input="${line}">
              <button type="button" data-custom-line="${line}" data-custom-delta="1">+</button>
            </label>
          `).join('')}
        `;

        panel.querySelectorAll('[data-custom-delta]').forEach((button) => {
          button.addEventListener('click', () => {
            markFormationInteraction();
            const line = button.dataset.customLine;
            const delta = Number(button.dataset.customDelta || 0);
            const current = fieldLineCounts(teamNumber, players);
            applyFormationCounts(container, players, normalizeCustomCounts(current, line, (current[line] || 0) + delta, total));
          });
        });

        panel.querySelectorAll('[data-custom-line-input]').forEach((input) => {
          input.addEventListener('change', () => {
            markFormationInteraction();
            const line = input.dataset.customLineInput;
            const current = fieldLineCounts(teamNumber, players);
            applyFormationCounts(container, players, normalizeCustomCounts(current, line, input.value, total));
          });
        });
      };

      const currentPlayerPosition = (container, player) => {
        const teamNumber = parseInt(container.dataset.formationTeam || '0', 10);
        return formationDrafts[teamNumber]?.[player.id] || player.assigned_position || player.primary_position || 'MED';
      };

      const ensureFormationState = (teamNumber, players) => {
        formationDrafts[teamNumber] = formationDrafts[teamNumber] || {};
        const knownIds = new Set(players.map(player => Number(player.id)));
        players.forEach((player) => {
          if (!formationDrafts[teamNumber][player.id]) {
            formationDrafts[teamNumber][player.id] = player.assigned_position || player.primary_position || 'MED';
          }
        });
        const goalkeeper = players.find(player => formationDrafts[teamNumber][player.id] === 'ARQ')
          || players.find(player => String(player.positions).split('/').includes('ARQ'))
          || players[0];
        if (goalkeeper) {
          formationDrafts[teamNumber][goalkeeper.id] = 'ARQ';
          players.forEach((player) => {
            if (player.id !== goalkeeper.id && formationDrafts[teamNumber][player.id] === 'ARQ') {
              formationDrafts[teamNumber][player.id] = player.primary_position && player.primary_position !== 'ARQ' ? player.primary_position : 'MED';
            }
          });
        }
        formationOrders[teamNumber] = (formationOrders[teamNumber] || []).filter(id => knownIds.has(Number(id)));
        players.forEach((player) => {
          if (!formationOrders[teamNumber].includes(Number(player.id))) {
            formationOrders[teamNumber].push(Number(player.id));
          }
        });
      };

      const orderedFormationPlayers = (teamNumber, players, position) => {
        const order = formationOrders[teamNumber] || [];
        return players
          .filter(player => (formationDrafts[teamNumber]?.[player.id] || player.assigned_position || player.primary_position || 'MED') === position)
          .sort((a, b) => {
            const indexA = order.indexOf(Number(a.id));
            const indexB = order.indexOf(Number(b.id));
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });
      };

      const moveFormationPlayer = (teamNumber, fromId, toId, position) => {
        if (!fromId || !toId || fromId === toId) return false;
        if ((formationDrafts[teamNumber]?.[fromId] || '') !== position || (formationDrafts[teamNumber]?.[toId] || '') !== position) {
          return false;
        }
        const order = formationOrders[teamNumber] || [];
        const fromIndex = order.indexOf(Number(fromId));
        const toIndex = order.indexOf(Number(toId));
        if (fromIndex === -1 || toIndex === -1) return false;
        const [moved] = order.splice(fromIndex, 1);
        order.splice(toIndex, 0, moved);
        formationOrders[teamNumber] = order;
        return true;
      };

      const swapFormationPlayers = (teamNumber, fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return false;
        const sourcePosition = formationDrafts[teamNumber]?.[fromId] || '';
        const targetPosition = formationDrafts[teamNumber]?.[toId] || '';
        if (!sourcePosition || !targetPosition) return false;
        if (sourcePosition === targetPosition) {
          return moveFormationPlayer(teamNumber, fromId, toId, sourcePosition);
        }

        formationDrafts[teamNumber][fromId] = targetPosition;
        formationDrafts[teamNumber][toId] = sourcePosition;

        const order = formationOrders[teamNumber] || [];
        const fromIndex = order.indexOf(Number(fromId));
        const toIndex = order.indexOf(Number(toId));
        if (fromIndex !== -1 && toIndex !== -1) {
          [order[fromIndex], order[toIndex]] = [order[toIndex], order[fromIndex]];
        }
        formationOrders[teamNumber] = order;
        return true;
      };

      const swapFormationPlayersAcrossTeams = (sourceTeam, sourceId, targetTeam, targetId) => {
        if (!adminEditor || !sourceTeam || !targetTeam || !sourceId || !targetId || sourceId === targetId) {
          return false;
        }
        if (sourceTeam === targetTeam) {
          return swapFormationPlayers(sourceTeam, sourceId, targetId);
        }

        const sourcePlayers = state.teams[String(sourceTeam)] || state.teams[sourceTeam] || [];
        const targetPlayers = state.teams[String(targetTeam)] || state.teams[targetTeam] || [];
        const sourceIndex = sourcePlayers.findIndex(player => Number(player.id) === Number(sourceId));
        const targetIndex = targetPlayers.findIndex(player => Number(player.id) === Number(targetId));
        if (sourceIndex === -1 || targetIndex === -1) return false;

        ensureFormationState(sourceTeam, sourcePlayers);
        ensureFormationState(targetTeam, targetPlayers);

        const sourcePlayer = sourcePlayers[sourceIndex];
        const targetPlayer = targetPlayers[targetIndex];
        const sourcePosition = formationDrafts[sourceTeam]?.[sourceId] || sourcePlayer.assigned_position || sourcePlayer.primary_position || 'MED';
        const targetPosition = formationDrafts[targetTeam]?.[targetId] || targetPlayer.assigned_position || targetPlayer.primary_position || 'MED';

        sourcePlayers[sourceIndex] = targetPlayer;
        targetPlayers[targetIndex] = sourcePlayer;
        state.teams[String(sourceTeam)] = sourcePlayers;
        state.teams[String(targetTeam)] = targetPlayers;

        formationDrafts[sourceTeam][targetId] = sourcePosition;
        formationDrafts[targetTeam][sourceId] = targetPosition;
        delete formationDrafts[sourceTeam][sourceId];
        delete formationDrafts[targetTeam][targetId];

        formationOrders[sourceTeam] = (formationOrders[sourceTeam] || [])
          .map(id => Number(id) === Number(sourceId) ? Number(targetId) : Number(id));
        formationOrders[targetTeam] = (formationOrders[targetTeam] || [])
          .map(id => Number(id) === Number(targetId) ? Number(sourceId) : Number(id));

        return true;
      };

      const rerenderEditableFormations = () => {
        updateTeamTitles();
        teamNumbers().forEach(renderTeamNumber => {
          const teamContainer = document.getElementById(`team${renderTeamNumber}List`);
          if (teamContainer && teamContainer.querySelector('.captain-formation-field')) {
            const players = state.teams[String(renderTeamNumber)] || state.teams[renderTeamNumber] || [];
            renderFormationLines(teamContainer, players);
            renderCustomFormationControls(teamContainer, players);
            const summary = teamContainer.querySelector(`[data-team-characteristics="${renderTeamNumber}"]`);
            if (summary) {
              summary.outerHTML = teamCharacteristicsHtml(renderTeamNumber, players);
            }
          }
        });
      };

      const swapIntoTeam = (sourceTeam, sourceId, targetTeam, preferredPosition = '') => {
        if (!adminEditor || !sourceTeam || !sourceId || !targetTeam || sourceTeam === targetTeam) {
          return false;
        }
        const targetPlayers = preferredPosition
          ? orderedFormationPlayers(targetTeam, state.teams[String(targetTeam)] || state.teams[targetTeam] || [], preferredPosition)
          : [];
        const fallbackPlayers = state.teams[String(targetTeam)] || state.teams[targetTeam] || [];
        const targetPlayer = targetPlayers[0] || fallbackPlayers[0] || null;
        if (!targetPlayer) {
          showMessage('Ese equipo no tiene jugador para intercambiar.', 'error');
          return false;
        }
        const changed = swapFormationPlayersAcrossTeams(sourceTeam, Number(sourceId), targetTeam, Number(targetPlayer.id));
        if (changed) {
          formationInteractionUntil = Date.now() + 80;
          rerenderEditableFormations();
        }
        return changed;
      };

      const nearestFormationCard = (teamNumber, clientX, clientY) => {
        if (!clientX && !clientY) return null;
        const teamContainer = document.getElementById(`team${teamNumber}List`);
        const cards = [...(teamContainer?.querySelectorAll('[data-drag-player-id]') || [])];
        let nearest = null;
        let nearestDistance = Infinity;
        cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distance = Math.hypot(centerX - clientX, centerY - clientY);
          if (distance < nearestDistance) {
            nearest = card;
            nearestDistance = distance;
          }
        });
        return nearest;
      };

      const handleFormationDrop = (event, targetElement) => {
        if (!formationDragState) return false;
        const fallback = formationDragTarget || (
          event?.clientX && event?.clientY
            ? document.elementFromPoint(event.clientX, event.clientY)
            : null
        );
        const target = targetElement?.closest?.('[data-drag-player-id], [data-drop-team], [data-captain-team-card]')
          || fallback?.closest?.('[data-drag-player-id], [data-drop-team], [data-captain-team-card]')
          || fallback;
        if (!target) return false;

        const targetCard = target.closest?.('[data-drag-player-id]');
        const targetTeam = Number(
          targetCard?.dataset.dragTeam
          || target.closest?.('[data-drop-team]')?.dataset.dropTeam
          || target.closest?.('[data-captain-team-card]')?.dataset.captainTeamCard
          || 0
        );
        const sourceTeam = Number(formationDragState.team || 0);
        const sourceId = Number(formationDragState.playerId || 0);
        if (!adminEditor || !sourceTeam || !sourceId || !targetTeam) return false;

        const targetSwapCard = targetCard || nearestFormationCard(targetTeam, event?.clientX || 0, event?.clientY || 0);
        const changed = targetSwapCard
          ? swapFormationPlayersAcrossTeams(sourceTeam, sourceId, targetTeam, Number(targetSwapCard.dataset.dragPlayerId))
          : swapIntoTeam(sourceTeam, sourceId, targetTeam, target.dataset?.formationLine || '');
        if (changed) {
          formationDropHandled = true;
          formationInteractionUntil = Date.now() + 80;
          rerenderEditableFormations();
          showMessage('Intercambio realizado. Toca Guardar formacion para confirmarlo.', 'success');
        }
        return changed;
      };

      const startFormationPointerDrag = (event, card, teamNumber) => {
        if (!adminEditor || !isDesktopDrag() || event.button !== 0 || event.target.closest?.('.captain-position-select')) {
          return false;
        }
        event.preventDefault();
        markFormationInteraction();

        const sourceCard = card;
        const sourceRect = sourceCard.getBoundingClientRect();
        const offsetX = event.clientX - sourceRect.left;
        const offsetY = event.clientY - sourceRect.top;
        let hasMoved = false;
        let ghost = null;

        formationDragState = {
          team: Number(card.dataset.dragTeam || teamNumber),
          playerId: Number(card.dataset.dragPlayerId || 0),
        };
        formationDragTarget = null;
        formationDropHandled = false;
        sourceCard.classList.add('is-dragging');

        const moveGhost = (moveEvent) => {
          if (!ghost) return;
          ghost.style.left = `${moveEvent.clientX - offsetX}px`;
          ghost.style.top = `${moveEvent.clientY - offsetY}px`;
        };

        const targetFromPoint = (moveEvent) => {
          if (ghost) ghost.style.display = 'none';
          const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          if (ghost) ghost.style.display = '';
          return target?.closest?.('[data-drag-player-id], [data-drop-team], [data-captain-team-card]') || null;
        };

        const markTarget = (target) => {
          clearFormationDragHighlights();
          if (!target) return;
          const targetCard = target.closest?.('[data-drag-player-id]');
          const targetField = target.closest?.('.captain-formation-field');
          const targetList = target.closest?.('.captain-team-list');
          if (targetCard) {
            targetCard.classList.add('is-drag-over');
          } else if (targetField) {
            targetField.classList.add('is-team-drag-over');
          } else if (targetList) {
            targetList.classList.add('is-team-drag-over');
          }
          formationDragTarget = target;
        };

        const onPointerMove = (moveEvent) => {
          const distance = Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY);
          if (!hasMoved && distance < 4) return;
          if (!hasMoved) {
            hasMoved = true;
            ghost = sourceCard.cloneNode(true);
            ghost.classList.add('is-pointer-drag-ghost');
            ghost.style.width = `${sourceRect.width}px`;
            ghost.style.height = `${sourceRect.height}px`;
            document.body.appendChild(ghost);
          }
          moveEvent.preventDefault();
          moveGhost(moveEvent);
          markTarget(targetFromPoint(moveEvent));
        };

        const onPointerUp = (upEvent) => {
          window.removeEventListener('pointermove', onPointerMove, true);
          window.removeEventListener('pointerup', onPointerUp, true);
          window.removeEventListener('pointercancel', onPointerUp, true);

          const target = hasMoved ? targetFromPoint(upEvent) || formationDragTarget : null;
          if (target) {
            handleFormationDrop(upEvent, target);
          }

          sourceCard.classList.remove('is-dragging');
          ghost?.remove();
          formationDragState = null;
          formationDragTarget = null;
          formationDropHandled = false;
          clearFormationDragHighlights();
        };

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerUp, true);
        return true;
      };

      const renderFormationLines = (container, players) => {
        const field = container.querySelector('.captain-formation-field');
        if (!field) return;
        const teamNumber = parseInt(container.dataset.formationTeam || '0', 10);
        ensureFormationState(teamNumber, players);
        field.dataset.dropTeam = String(teamNumber);
        field.innerHTML = positions.map(pos => {
          const linePlayers = orderedFormationPlayers(teamNumber, players, pos);
          return `
            <div class="formation-line captain-formation-line">
              <div class="line-label">${pos}</div>
              <div class="line-players" data-formation-line="${pos}" data-drop-team="${teamNumber}">
                ${linePlayers.length ? linePlayers.map(player => `
                  <div class="formation-player captain-formation-player" draggable="true" data-drag-player-id="${player.id}" data-drag-position="${pos}" data-drag-team="${teamNumber}">
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>${formatSkill(player.skill)}</span>
                    <select class="captain-position-select" data-player-id="${player.id}">
                      ${positions.map(option => `<option value="${option}" ${currentPlayerPosition(container, player) === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                  </div>
                `).join('') : '<span class="formation-player empty-slot">-</span>'}
              </div>
            </div>
          `;
        }).join('');
        field.querySelectorAll('.captain-position-select').forEach(select => {
          ['pointerdown', 'mousedown', 'touchstart', 'focus'].forEach((eventName) => {
            select.addEventListener(eventName, markFormationInteraction);
          });
          select.addEventListener('change', () => {
            const playerId = parseInt(select.dataset.playerId, 10);
            formationDrafts[teamNumber][playerId] = select.value;
            const order = formationOrders[teamNumber] || [];
            formationOrders[teamNumber] = order.filter(id => Number(id) !== playerId).concat(playerId);
          });
          select.addEventListener('blur', () => {
            formationInteractionUntil = Date.now() + 80;
            window.setTimeout(() => {
              if (!isFormationInteractionActive()) {
                renderFormationLines(container, players);
              }
            }, 120);
          });
        });
        field.querySelectorAll('.captain-position-select').forEach(select => {
          select.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              select.blur();
            }
          });
        });
        field.addEventListener('focusout', () => {
          formationInteractionUntil = Date.now() + 80;
          window.setTimeout(() => {
            if (!isFormationInteractionActive()) {
              renderFormationLines(container, players);
            }
          }, 160);
        }, { once: true });
        field.addEventListener('dragover', (event) => {
          if (!adminEditor || event.target !== field) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          formationDragTarget = field;
          field.classList.add('is-team-drag-over');
        });
        field.addEventListener('dragleave', (event) => {
          if (field.contains(event.relatedTarget)) return;
          field.classList.remove('is-team-drag-over');
        });
        field.addEventListener('drop', (event) => {
          if (!adminEditor || event.target !== field) return;
          event.preventDefault();
          field.classList.remove('is-team-drag-over');
          handleFormationDrop(event, field);
        });
        field.querySelectorAll('[data-drop-team]').forEach(line => {
          line.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            formationDragTarget = line;
            line.classList.add('is-drag-over');
          });
          line.addEventListener('dragleave', (event) => {
            if (line.contains(event.relatedTarget)) return;
            line.classList.remove('is-drag-over');
          });
          line.addEventListener('drop', (event) => {
            event.preventDefault();
            line.classList.remove('is-drag-over');
            if (event.target.closest('[data-drag-player-id]')) return;
            handleFormationDrop(event, line);
          });
        });
        field.querySelectorAll('[data-drag-player-id]').forEach(card => {
          card.addEventListener('pointerdown', (event) => {
            startFormationPointerDrag(event, card, teamNumber);
          });
          card.addEventListener('dragstart', (event) => {
            if (adminEditor && isDesktopDrag()) {
              event.preventDefault();
              return;
            }
            if (event.target.closest?.('.captain-position-select')) {
              event.preventDefault();
              return;
            }
            markFormationInteraction();
            formationDragState = {
              team: Number(card.dataset.dragTeam || teamNumber),
              playerId: Number(card.dataset.dragPlayerId || 0),
            };
            formationDragTarget = null;
            formationDropHandled = false;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `${card.dataset.dragTeam}|${card.dataset.dragPlayerId}|${card.dataset.dragPosition}`);
            card.classList.add('is-dragging');
          });
          card.addEventListener('dragend', (event) => {
            card.classList.remove('is-dragging');
            if (!formationDropHandled && formationDragTarget) {
              handleFormationDrop(event, formationDragTarget);
            }
            formationDragState = null;
            formationDragTarget = null;
            formationDropHandled = false;
            clearFormationDragHighlights();
          });
          card.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            formationDragTarget = card;
            card.classList.add('is-drag-over');
          });
          card.addEventListener('dragleave', () => {
            card.classList.remove('is-drag-over');
          });
          card.addEventListener('drop', (event) => {
            event.preventDefault();
            card.classList.remove('is-drag-over');
            handleFormationDrop(event, card);
          });
        });
      };

      const renderFormationEditor = (teamNumber, players) => `
        <div class="captain-formation-tools">
          <label>Formacion</label>
          <select data-formation-preset="${teamNumber}">
            <option value="">Personalizada</option>
            ${formationPresets(players.length).map((preset, index) => `<option value="${index}">${escapeHtml(preset.name)}</option>`).join('')}
          </select>
          <div class="captain-custom-formation" data-custom-formation-panel></div>
        </div>
        <div class="team-formation captain-formation-field" data-drop-team="${teamNumber}"></div>
        ${teamCharacteristicsHtml(teamNumber, players)}
        <div class="captain-formation-message hidden" data-formation-message="${teamNumber}"></div>
        <button class="btn btn-primary captain-save-formation" type="button" data-save-formation="${teamNumber}">Guardar formacion</button>
      `;

      const renderReadonlyTeam = (players) => players.map(p => `
        <div class="captain-player picked">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${playerMeta(p)}</span>
          <span>Ubicacion: ${escapeHtml(p.assigned_position || p.primary_position)}</span>
        </div>
      `).join('') || '<p class="small-muted">Sin jugadores.</p>';

      const renderTeam = (teamNumber, containerId) => {
        const container = document.getElementById(containerId);
        container.dataset.formationTeam = String(teamNumber);
        const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
        const canEditFormation = captainToken !== ''
          && teamView === teamNumber
          && state.draft.status === 'completed'
          && state.match.can_edit_formations;
        const canAdminEditFormation = adminEditor
          && state.draft.status === 'completed'
          && state.match.can_edit_formations;
        const canEditThisFormation = canEditFormation || canAdminEditFormation;
        container.innerHTML = canEditThisFormation ? renderFormationEditor(teamNumber, players) : renderReadonlyTeam(players);
        if (canEditThisFormation) {
          renderFormationLines(container, players);
          renderCustomFormationControls(container, players);
          container.addEventListener('dragover', (event) => {
            if (!adminEditor || event.target.closest('[data-drag-player-id], [data-drop-team], select')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            formationDragTarget = container;
            container.classList.add('is-team-drag-over');
          });
          container.addEventListener('dragleave', (event) => {
            if (container.contains(event.relatedTarget)) return;
            container.classList.remove('is-team-drag-over');
          });
          container.addEventListener('drop', (event) => {
            if (!adminEditor || event.target.closest('[data-drag-player-id], [data-drop-team], select')) return;
            event.preventDefault();
            container.classList.remove('is-team-drag-over');
            handleFormationDrop(event, container);
          });
          const teamCard = container.closest('[data-captain-team-card]');
          teamCard?.addEventListener('dragover', (event) => {
            if (!adminEditor || event.target.closest('[data-drag-player-id], [data-drop-team], select')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            formationDragTarget = teamCard;
            container.classList.add('is-team-drag-over');
          });
          teamCard?.addEventListener('dragleave', (event) => {
            if (teamCard.contains(event.relatedTarget)) return;
            container.classList.remove('is-team-drag-over');
          });
          teamCard?.addEventListener('drop', (event) => {
            if (!adminEditor || event.target.closest('[data-drag-player-id], [data-drop-team], select')) return;
            event.preventDefault();
            container.classList.remove('is-team-drag-over');
            handleFormationDrop(event, teamCard);
          });
          container.querySelector('[data-save-formation]').addEventListener('click', () => saveFormation(teamNumber, container));
          container.querySelector('[data-formation-preset]')?.addEventListener('change', (event) => {
            if (event.target.value !== '') {
              applyFormationPreset(container, players, parseInt(event.target.value, 10));
            } else {
              renderCustomFormationControls(container, players);
            }
          });
        }
      };

      const renderAvailable = () => {
        const container = document.getElementById('availablePots');
        const canPick = captainToken !== '' && teamView > 0 && state.draft.status === 'active' && state.draft.current_team === teamView;
        const rule = state.pick_rule || { enforced: false, message: '' };
        const available = state.available || [];
        const groups = {};
        for (const pos of positions) groups[pos] = [];
        for (const player of available) {
          (groups[player.primary_position] || groups.MED).push(player);
        }
        const ruleHtml = rule.message ? `<div class="captain-rule ${rule.enforced ? 'active' : ''}">${escapeHtml(rule.message)}</div>` : '';
        container.innerHTML = ruleHtml + positions.map(pos => `
          <section class="captain-pot">
            <h4>${pos}</h4>
            ${groups[pos].length ? groups[pos].map(p => `
              <button class="captain-player ${p.pick_allowed ? '' : 'not-available'} ${canPick && p.pick_allowed ? 'is-pickable' : ''}" type="button" data-player-id="${p.id}" ${canPick && p.pick_allowed ? '' : 'disabled'}>
                <strong>${escapeHtml(p.name)}</strong>
                <span>${playerMeta(p)}</span>
                ${p.pick_allowed ? '' : '<span class="captain-player-unavailable">No disponible aun</span>'}
              </button>
            `).join('') : '<p class="small-muted">Sin jugadores disponibles.</p>'}
          </section>
        `).join('');

        container.querySelectorAll('[data-player-id]').forEach(button => {
          button.addEventListener('click', () => pickPlayer(parseInt(button.dataset.playerId, 10)));
        });
      };

      const render = () => {
        if (!state || !state.ok) return;
        if (shouldRedirectToFormation()) {
          redirectToFormation();
          return;
        }
        ensureTeamCards();
        document.getElementById('draftTitle').textContent = `${state.match.title} - ${state.match.participants_count} convocados`;
        const turn = document.getElementById('draftTurn');
        const formationHint = document.getElementById('draftFormationHint');
        const canShowFormationHint = state.draft.status === 'completed'
          && ((teamView > 0 && captainToken !== '') || adminEditor)
          && state.match.can_edit_formations;
        if (formationHint) {
          formationHint.hidden = !canShowFormationHint;
        }
        updateTurnBanner();
        if (state.draft.status === 'completed') {
          if (adminEditor && state.match.can_edit_formations) {
            turn.innerHTML = 'Draft completo. Como admin podes reorganizar la formacion de ambos equipos y guardar cada una.';
          } else if (teamView > 0 && captainToken !== '' && state.match.can_edit_formations) {
            turn.innerHTML = 'Draft completo. Ajusta la formacion de tu equipo y toca Guardar formacion.';
          } else if (teamView > 0 && captainToken !== '') {
            turn.innerHTML = 'Draft completo. La formacion ya no se puede editar porque la fecha esta finalizada.';
          } else {
            turn.innerHTML = 'Draft completo. Los equipos ya quedaron guardados para finalizar la fecha.';
          }
        } else if (teamView > 0 && captainToken === '') {
          turn.innerHTML = 'Este acceso no tiene token de capitan. Vuelve a Inicio y toca Soy capitan.';
        } else if (teamView === state.draft.current_team) {
          turn.innerHTML = `<strong>Tu turno:</strong> elige un jugador disponible.`;
        } else if (teamNumbers().includes(teamView)) {
          turn.innerHTML = `Esperando a ${escapeHtml(currentCaptainName())}. Todavia no te toca elegir.`;
        } else {
          turn.innerHTML = `Esperando a ${escapeHtml(currentCaptainName())}. Entra con el link de ese capitan si queres elegir.`;
        }
        updateTeamTitles();
        teamNumbers().forEach(teamNumber => renderTeam(teamNumber, `team${teamNumber}List`));
        updateWaitingPanel();
        const formationOnly = state.draft.status === 'completed' && teamView > 0 && captainToken !== '';
        document.querySelector('.captain-teams-grid')?.classList.toggle('formation-only', formationOnly);
        document.querySelectorAll('[data-captain-team-card]').forEach(card => {
          const cardTeam = parseInt(card.dataset.captainTeamCard, 10);
          card.toggleAttribute('hidden', formationOnly && cardTeam !== teamView);
        });
        renderAvailable();
        document.querySelector('#availablePots')?.closest('.card')?.toggleAttribute('hidden', state.draft.status === 'completed' && ((teamView > 0 && captainToken !== '') || adminEditor));
      };

      const shouldRedirectToFormation = () => {
        return state
          && state.ok
          && state.draft.status === 'completed'
          && teamView > 0
          && captainToken !== ''
          && viewMode !== 'formacion';
      };

      const redirectToFormation = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'formacion');
        url.hash = 'formacion';
        window.location.replace(url.toString());
      };

      const returnToPreviousPage = () => {
        const fallbackUrl = 'index.php';
        try {
          if (document.referrer) {
            const referrerUrl = new URL(document.referrer);
            if (referrerUrl.origin === window.location.origin && referrerUrl.href !== window.location.href) {
              window.location.href = referrerUrl.href;
              return;
            }
          }
        } catch (error) {
          // Ignore malformed referrers and fall back to browser history.
        }
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.href = fallbackUrl;
      };

      const loadState = async ({ forceRender = false } = {}) => {
        const response = await fetch(`capitanes_api.php?action=state&match_id=${matchId}`, { cache: 'no-store' });
        state = await response.json();
        if (shouldRedirectToFormation()) {
          redirectToFormation();
          return;
        }
        if (!forceRender && hasRenderedState && shouldStopAutoRefresh()) {
          stopAutoRefresh();
          return;
        }
        if (!forceRender && isFormationInteractionActive()) {
          return;
        }
        render();
        hasRenderedState = true;
        if (shouldStopAutoRefresh()) {
          stopAutoRefresh();
        }
      };

      const showMessage = (message, type = 'info') => {
        const el = document.getElementById('draftMessage');
        el.className = `flash flash-${type}`;
        el.textContent = message;
        el.classList.remove('hidden');
      };

      const pickPlayer = async (playerId) => {
        const response = await fetch('capitanes_api.php?action=pick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId, team_number: teamView, player_id: playerId, token: captainToken })
        });
        const data = await response.json();
        if (!data.ok) {
          showMessage(data.message || 'No se pudo elegir el jugador.', 'error');
          await loadState({ forceRender: true });
          return;
        }
        state = data;
        if (shouldRedirectToFormation()) {
          redirectToFormation();
          return;
        }
        showMessage('Jugador elegido. Turno actualizado.', 'success');
        render();
        hasRenderedState = true;
      };

      const saveFormation = async (teamNumber, container) => {
        if (adminEditor) {
          await saveAllFormations();
          return;
        }
        const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
        const draft = formationDrafts[teamNumber] || {};
        const order = formationOrders[teamNumber] || players.map(player => Number(player.id));
        const orderedPlayers = [...players].sort((a, b) => {
          const indexA = order.indexOf(Number(a.id));
          const indexB = order.indexOf(Number(b.id));
          return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });
        const assignments = orderedPlayers.map(player => ({
          player_id: parseInt(player.id, 10),
          assigned_position: draft[player.id] || player.assigned_position || player.primary_position || 'MED'
        }));
        const response = await fetch('capitanes_api.php?action=save_formation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId, team_number: teamNumber, token: captainToken, assignments })
        });
        const data = await response.json();
        if (!data.ok) {
          showMessage(data.message || 'No se pudo guardar la formacion.', 'error');
          await loadState({ forceRender: true });
          return;
        }
        state = data;
        formationDrafts[teamNumber] = {};
        formationOrders[teamNumber] = [];
        (state.teams[String(teamNumber)] || state.teams[teamNumber] || []).forEach((player) => {
          formationDrafts[teamNumber][player.id] = player.assigned_position || player.primary_position || 'MED';
          formationOrders[teamNumber].push(Number(player.id));
        });
        render();
        hasRenderedState = true;
        const message = document.querySelector(`[data-formation-message="${teamNumber}"]`);
        if (message) {
          message.className = 'captain-formation-message flash flash-success';
          message.textContent = 'Formacion guardada.';
          window.setTimeout(() => {
            message.classList.add('hidden');
          }, 2200);
        }
      };

      const saveAllFormations = async () => {
        const teamsPayload = teamNumbers().map(teamNumber => {
          const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
          const draft = formationDrafts[teamNumber] || {};
          const order = formationOrders[teamNumber] || players.map(player => Number(player.id));
          const orderedPlayers = [...players].sort((a, b) => {
            const indexA = order.indexOf(Number(a.id));
            const indexB = order.indexOf(Number(b.id));
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });
          return {
            team_number: teamNumber,
            assignments: orderedPlayers.map(player => ({
              player_id: parseInt(player.id, 10),
              assigned_position: draft[player.id] || player.assigned_position || player.primary_position || 'MED'
            }))
          };
        });

        const response = await fetch('capitanes_api.php?action=save_all_formations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId, teams: teamsPayload })
        });
        const data = await response.json();
        if (!data.ok) {
          showMessage(data.message || 'No se pudieron guardar las formaciones.', 'error');
          await loadState({ forceRender: true });
          return;
        }
        state = data;
        teamNumbers().forEach(number => {
          formationDrafts[number] = {};
          formationOrders[number] = [];
          (state.teams[String(number)] || state.teams[number] || []).forEach((player) => {
            formationDrafts[number][player.id] = player.assigned_position || player.primary_position || 'MED';
            formationOrders[number].push(Number(player.id));
          });
        });
        render();
        hasRenderedState = true;
        showMessage('Formaciones guardadas.', 'success');
        window.setTimeout(returnToPreviousPage, 900);
      };

      loadState({ forceRender: true });
      pollingTimer = window.setInterval(() => loadState(), 2500);
    })();
  </script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
