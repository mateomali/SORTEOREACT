<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

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
         WHERE captain1_token = :token1 OR captain2_token = :token2
         LIMIT 1'
    );

    for ($attempt = 0; $attempt < 100; $attempt++) {
        $token = (string) random_int(1000, 9999);
        if (in_array($token, $reserved, true)) {
            continue;
        }
        $stmt->execute(['token1' => $token, 'token2' => $token]);
        if (!$stmt->fetchColumn()) {
            return $token;
        }
    }

    throw new RuntimeException('No se pudo generar un token disponible.');
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
    if (!in_array($teamNumber, [1, 2], true) || $token === '') {
        return null;
    }

    $stmt = $pdo->prepare(
        'SELECT d.captain1_token, d.captain2_token, m.status AS match_status
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

    $expectedToken = $teamNumber === 1 ? (string) $draft['captain1_token'] : (string) $draft['captain2_token'];
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
        'SELECT d.match_id, d.captain1_token, d.captain2_token, m.status AS match_status
         FROM captain_drafts d
         INNER JOIN matches m ON m.id = d.match_id
         WHERE d.captain1_token = :token1 OR d.captain2_token = :token2
         LIMIT 1'
    );
    $stmt->execute(['token1' => $postedToken, 'token2' => $postedToken]);
    $draftByToken = $stmt->fetch();
    if (!$draftByToken) {
        flash('error', 'Token de capitan invalido.');
        redirect('index.php');
    }
    if ((string) ($draftByToken['match_status'] ?? '') === 'finalizado') {
        flash('error', 'Ese partido ya finalizo.');
        redirect('index.php');
    }

    $tokenTeam = hash_equals((string) $draftByToken['captain1_token'], $postedToken) ? 1 : 2;
    remember_captain_access((int) $draftByToken['match_id'], $tokenTeam, $postedToken);
    redirect('capitanes.php?match_id=' . (int) $draftByToken['match_id'] . '&team=' . $tokenTeam . '&token=' . urlencode($postedToken));
}

if ($matchId > 0 && ($captainToken === '' || !in_array($teamView, [1, 2], true))) {
    $storedAccess = stored_captain_access($pdo, $matchId);
    if ($storedAccess) {
        $teamView = (int) $storedAccess['team'];
        $captainToken = (string) $storedAccess['token'];
    }
}

$isCaptainView = in_array($teamView, [1, 2], true) && $captainToken !== '';

if (!$isCaptainView) {
    require_admin();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'start_draft') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $captain1 = (int) ($_POST['captain1'] ?? 0);
    $captain2 = (int) ($_POST['captain2'] ?? 0);
    $participants = repo_match_participants_basic($matchId);
    $participantIds = array_map(static fn(array $p): int => (int) $p['id'], $participants);

    if ($matchId <= 0 || !$participants) {
        flash('error', 'Selecciona un partido con convocados.');
        redirect('capitanes.php');
    }
    if (count($participants) % 2 !== 0) {
        flash('error', 'El modo capitanes requiere una cantidad par de jugadores.');
        redirect('capitanes.php?match_id=' . $matchId);
    }
    if ($captain1 <= 0 || $captain2 <= 0 || $captain1 === $captain2 || !in_array($captain1, $participantIds, true) || !in_array($captain2, $participantIds, true)) {
        flash('error', 'Elige dos capitanes distintos dentro de los convocados.');
        redirect('capitanes.php?match_id=' . $matchId);
    }

    $captainSkills = [];
    foreach ($participants as $participant) {
        $pid = (int) $participant['id'];
        if ($pid === $captain1 || $pid === $captain2) {
            $captainSkills[$pid] = (float) $participant['skill'];
        }
    }
    $firstTeam = ($captainSkills[$captain2] ?? 0.0) < ($captainSkills[$captain1] ?? 0.0) ? 2 : 1;

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

        $token1 = generated_captain_token($pdo);
        $token2 = generated_captain_token($pdo, [$token1]);
        $pdo->prepare(
            'INSERT INTO captain_drafts (match_id, captain1_player_id, captain2_player_id, captain1_token, captain2_token, current_team, status, started_at)
             VALUES (:mid, :c1, :c2, :t1, :t2, :current_team, "active", NOW())'
        )->execute(['mid' => $matchId, 'c1' => $captain1, 'c2' => $captain2, 't1' => $token1, 't2' => $token2, 'current_team' => $firstTeam]);
        $pdo->prepare(
            'INSERT INTO captain_picks (match_id, player_id, team_number, picked_by_player_id, pick_order)
             VALUES (:mid, :pid, :team, :picker, :pick_order)'
        )->execute(['mid' => $matchId, 'pid' => $captain1, 'team' => 1, 'picker' => $captain1, 'pick_order' => 1]);
        $pdo->prepare(
            'INSERT INTO captain_picks (match_id, player_id, team_number, picked_by_player_id, pick_order)
             VALUES (:mid, :pid, :team, :picker, :pick_order)'
        )->execute(['mid' => $matchId, 'pid' => $captain2, 'team' => 2, 'picker' => $captain2, 'pick_order' => 2]);
        $pdo->prepare('UPDATE match_players SET team_number = 1 WHERE match_id = :mid AND player_id = :pid')
            ->execute(['mid' => $matchId, 'pid' => $captain1]);
        $pdo->prepare('UPDATE match_players SET team_number = 2 WHERE match_id = :mid AND player_id = :pid')
            ->execute(['mid' => $matchId, 'pid' => $captain2]);
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
    $needsShortTokens = $draft
        && (!preg_match('/^\d{4}$/', (string) ($draft['captain1_token'] ?? ''))
            || !preg_match('/^\d{4}$/', (string) ($draft['captain2_token'] ?? '')));
    if ($needsShortTokens) {
        $draft['captain1_token'] = generated_captain_token($pdo);
        $draft['captain2_token'] = generated_captain_token($pdo, [(string) $draft['captain1_token']]);
        $pdo->prepare(
            'UPDATE captain_drafts SET captain1_token = :t1, captain2_token = :t2 WHERE match_id = :mid'
        )->execute([
            'mid' => (int) $selectedMatch['id'],
            't1' => $draft['captain1_token'],
            't2' => $draft['captain2_token'],
        ]);
    }
}
$generatedTeams = $selectedMatch ? repo_match_teams((int) $selectedMatch['id']) : [];
$hasGeneratedTeams = $selectedMatch
    && in_array((string) ($selectedMatch['status'] ?? ''), ['sorteado', 'finalizado'], true)
    && count($generatedTeams) >= 2;

$captain1Name = 'Capitan 1';
$captain2Name = 'Capitan 2';
$captain1ShareText = '';
$captain2ShareText = '';
$captain1OpenUrl = '';
$captain2OpenUrl = '';
if ($selectedMatch && $draft) {
    foreach ($participants as $participant) {
        $participantId = (int) ($participant['id'] ?? 0);
        if ($participantId === (int) ($draft['captain1_player_id'] ?? 0)) {
            $captain1Name = (string) $participant['name'];
        }
        if ($participantId === (int) ($draft['captain2_player_id'] ?? 0)) {
            $captain2Name = (string) $participant['name'];
        }
    }
    $matchLabel = (string) ($selectedMatch['title'] ?: ('Partido #' . $selectedMatch['id']));
    $captain1ShareText = "Token para elegir equipo como " . $captain1Name . "\n" . $matchLabel . "\n\n" . (string) ($draft['captain1_token'] ?? '');
    $captain2ShareText = "Token para elegir equipo como " . $captain2Name . "\n" . $matchLabel . "\n\n" . (string) ($draft['captain2_token'] ?? '');
    $captain1OpenUrl = 'capitanes.php?match_id=' . (int) $selectedMatch['id'] . '&team=1&token=' . urlencode((string) ($draft['captain1_token'] ?? ''));
    $captain2OpenUrl = 'capitanes.php?match_id=' . (int) $selectedMatch['id'] . '&team=2&token=' . urlencode((string) ($draft['captain2_token'] ?? ''));
}

$title = 'Capitanes | ' . APP_NAME;
$activePage = 'capitanes.php';
$backUrl = $isCaptainView
    ? 'index.php'
    : 'editar_partidos.php' . ($selectedMatch ? '#partido-admin-' . (int) $selectedMatch['id'] : '');
$backLabel = $isCaptainView ? 'Volver al inicio' : 'Volver a partidos';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1><?= $isCaptainView ? 'Eleccion de capitan' : 'Modo capitanes' ?></h1>
    <p class="small-muted"><?= $isCaptainView ? 'Espera tu turno y elige un jugador.' : 'Draft remoto por turnos sobre los convocados del partido.' ?></p>
  </div>
  <a class="btn btn-muted" href="<?= h($backUrl) ?>"><?= h($backLabel) ?></a>
</section>

<?php if (!$isCaptainView): ?>
<section class="card mb-3.5">
  <form method="get" class="form-grid">
    <div class="form-row">
      <label>Seleccionar partido</label>
      <select name="match_id" onchange="this.form.submit()">
        <option value="">Elegir...</option>
        <?php foreach ($matches as $m): ?>
          <option value="<?= (int) $m['id'] ?>" <?= selected_attr($selectedMatch && (int) $selectedMatch['id'] === (int) $m['id']) ?>>
            <?= h(date('d/m H:i', strtotime((string) $m['match_date'])) . ' - ' . ($m['title'] ?: ('Partido #' . $m['id'])) . ' [' . $m['participants_count'] . ' jugadores]') ?>
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
        <label>Capitan equipo 1</label>
        <select name="captain1" required>
          <option value="">Elegir...</option>
          <?php foreach ($participants as $p): ?>
            <option value="<?= (int) $p['id'] ?>"><?= h((string) $p['name'] . ' - ' . $p['positions'] . ' - ' . skill_label((float) $p['skill'])) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-row">
        <label>Capitan equipo 2</label>
        <select name="captain2" required>
          <option value="">Elegir...</option>
          <?php foreach ($participants as $p): ?>
            <option value="<?= (int) $p['id'] ?>"><?= h((string) $p['name'] . ' - ' . $p['positions'] . ' - ' . skill_label((float) $p['skill'])) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" type="submit">Iniciar modo capitanes</button>
      </div>
    </form>
  </section>
<?php elseif ($selectedMatch && ($draft || $hasGeneratedTeams)): ?>
  <?php if (!$isCaptainView): ?>
  <section class="card mb-3.5">
    <h3><?= h((string) ($selectedMatch['title'] ?: ('Partido #' . $selectedMatch['id']))) ?></h3>
    <?php if ($draft): ?>
      <p class="small-muted">Pasa estos tokens a cada capitan. Desde Inicio pueden tocar Soy capitan, pegar el token y entrar a elegir.</p>
      <div class="grid cols-2 mb-3">
        <div class="stat-box">
          <div class="label">Token <?= h($captain1Name) ?></div>
          <input type="text" readonly value="<?= h((string) ($draft['captain1_token'] ?? '')) ?>" onclick="this.select()">
          <div class="captain-link-actions">
            <button class="btn btn-primary" type="button" data-share-token="<?= h($captain1ShareText) ?>">Compartir</button>
            <button class="btn btn-muted" type="button" data-copy-token="<?= h((string) ($draft['captain1_token'] ?? '')) ?>">Copiar</button>
            <a class="btn btn-muted" href="<?= h($captain1OpenUrl) ?>">Abrir</a>
          </div>
        </div>
        <div class="stat-box">
          <div class="label">Token <?= h($captain2Name) ?></div>
          <input type="text" readonly value="<?= h((string) ($draft['captain2_token'] ?? '')) ?>" onclick="this.select()">
          <div class="captain-link-actions">
            <button class="btn btn-primary" type="button" data-share-token="<?= h($captain2ShareText) ?>">Compartir</button>
            <button class="btn btn-muted" type="button" data-copy-token="<?= h((string) ($draft['captain2_token'] ?? '')) ?>">Copiar</button>
            <a class="btn btn-muted" href="<?= h($captain2OpenUrl) ?>">Abrir</a>
          </div>
        </div>
      </div>
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
    data-team-view="<?= in_array($teamView, [1, 2], true) ? $teamView : 0 ?>"
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
          <section>
            <h4 id="captainWaitingTeam1Title">Equipo 1</h4>
            <div id="captainWaitingTeam1List"></div>
          </section>
          <section>
            <h4 id="captainWaitingTeam2Title">Equipo 2</h4>
            <div id="captainWaitingTeam2List"></div>
          </section>
        </div>
      </div>
    </div>

    <div class="captain-status card">
      <h3 id="draftTitle">Cargando...</h3>
      <p id="draftTurn" class="small-muted"></p>
      <p id="draftFormationHint" class="captain-formation-hint" hidden>Arrastra y suelta jugadores para cambiar el orden o intercambiar posiciones entre filas.</p>
      <div id="draftMessage" class="flash flash-info hidden"></div>
    </div>

    <div class="grid cols-2 captain-teams-grid mt-3.5">
      <article class="card" data-captain-team-card="1">
        <h3 id="team1Title">Equipo 1</h3>
        <div id="team1List" class="captain-team-list"></div>
      </article>
      <article class="card" data-captain-team-card="2">
        <h3 id="team2Title">Equipo 2</h3>
        <div id="team2List" class="captain-team-list"></div>
      </article>
    </div>

    <section class="card mt-3.5">
      <h3>Jugadores disponibles</h3>
      <div id="availablePots" class="captain-pots"></div>
    </section>
  </section>

  <script>
    (() => {
      const copyText = async (text) => {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(input);
        return copied;
      };

      document.querySelectorAll('[data-copy-token]').forEach(button => {
        button.addEventListener('click', async () => {
          await copyText(button.dataset.copyToken || '');
          button.textContent = 'Copiado';
          window.setTimeout(() => { button.textContent = 'Copiar'; }, 1600);
        });
      });

      document.querySelectorAll('[data-share-token]').forEach(button => {
        button.addEventListener('click', async () => {
          const text = button.dataset.shareToken || '';
          if (navigator.share) {
            await navigator.share({ text });
            button.textContent = 'Compartido';
          } else {
            await copyText(text);
            button.textContent = 'Copiado';
          }
          window.setTimeout(() => { button.textContent = 'Compartir'; }, 1600);
        });
      });
    })();

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

      const updateWaitingPanel = () => {
        const panel = document.getElementById('captainWaitingPanel');
        const text = document.getElementById('captainWaitingText');
        if (!panel || !state || !state.ok) return;

        const isWaiting = captainToken !== ''
          && (teamView === 1 || teamView === 2)
          && state.draft.status === 'active'
          && state.draft.current_team !== teamView;

        panel.hidden = !isWaiting;
        if (isWaiting && text) {
          text.textContent = state.draft.current_captain
            ? `Turno de ${state.draft.current_captain}.`
            : 'Aguardando la eleccion del otro capitan.';
          renderWaitingTeam(1);
          renderWaitingTeam(2);
        }
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

      const renderFormationLines = (container, players) => {
        const field = container.querySelector('.captain-formation-field');
        if (!field) return;
        const teamNumber = parseInt(container.dataset.formationTeam || '0', 10);
        ensureFormationState(teamNumber, players);
        field.innerHTML = positions.map(pos => {
          const linePlayers = orderedFormationPlayers(teamNumber, players, pos);
          return `
            <div class="formation-line captain-formation-line">
              <div class="line-label">${pos}</div>
              <div class="line-players" data-formation-line="${pos}">
                ${linePlayers.length ? linePlayers.map(player => `
                  <div class="formation-player captain-formation-player" draggable="true" data-drag-player-id="${player.id}" data-drag-position="${pos}">
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
        field.querySelectorAll('[data-drag-player-id]').forEach(card => {
          card.addEventListener('dragstart', (event) => {
            if (event.target.closest?.('.captain-position-select')) {
              event.preventDefault();
              return;
            }
            markFormationInteraction();
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `${card.dataset.dragPlayerId}|${card.dataset.dragPosition}`);
            card.classList.add('is-dragging');
          });
          card.addEventListener('dragend', () => {
            card.classList.remove('is-dragging');
          });
          card.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            card.classList.add('is-drag-over');
          });
          card.addEventListener('dragleave', () => {
            card.classList.remove('is-drag-over');
          });
          card.addEventListener('drop', (event) => {
            event.preventDefault();
            const [sourceId] = String(event.dataTransfer.getData('text/plain') || '').split('|');
            card.classList.remove('is-drag-over');
            const changed = swapFormationPlayers(teamNumber, Number(sourceId), Number(card.dataset.dragPlayerId));
            if (changed) {
              formationInteractionUntil = Date.now() + 80;
              renderFormationLines(container, players);
            }
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
        <div class="team-formation captain-formation-field"></div>
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
        document.getElementById('draftTitle').textContent = `${state.match.title} - ${state.match.participants_count} convocados`;
        document.getElementById('team1Title').textContent = `Equipo 1 - ${state.draft.captains[1].name} (${state.teams[1].length}/${state.match.target_team_size}) - ${teamTotalSkill(1).toFixed(1)} pts`;
        document.getElementById('team2Title').textContent = `Equipo 2 - ${state.draft.captains[2].name} (${state.teams[2].length}/${state.match.target_team_size}) - ${teamTotalSkill(2).toFixed(1)} pts`;
        const turn = document.getElementById('draftTurn');
        const formationHint = document.getElementById('draftFormationHint');
        const canShowFormationHint = state.draft.status === 'completed'
          && ((teamView > 0 && captainToken !== '') || adminEditor)
          && state.match.can_edit_formations;
        if (formationHint) {
          formationHint.hidden = !canShowFormationHint;
        }
        if (state.draft.status === 'completed') {
          if (adminEditor && state.match.can_edit_formations) {
            turn.innerHTML = 'Draft completo. Como admin podes reorganizar la formacion de ambos equipos y guardar cada una.';
          } else if (teamView > 0 && captainToken !== '' && state.match.can_edit_formations) {
            turn.innerHTML = 'Draft completo. Ajusta la formacion de tu equipo y toca Guardar formacion.';
          } else if (teamView > 0 && captainToken !== '') {
            turn.innerHTML = 'Draft completo. La formacion ya no se puede editar porque el partido esta finalizado.';
          } else {
            turn.innerHTML = 'Draft completo. Los equipos ya quedaron guardados para finalizar el partido.';
          }
        } else if (teamView > 0 && captainToken === '') {
          turn.innerHTML = 'Este acceso no tiene token de capitan. Vuelve a Inicio y toca Soy capitan.';
        } else if (teamView === state.draft.current_team) {
          turn.innerHTML = `<strong>Tu turno:</strong> elige un jugador.`;
        } else if (teamView === 1 || teamView === 2) {
          turn.innerHTML = `Turno de ${escapeHtml(state.draft.current_captain)}. Espera a que el otro capitan elija.`;
        } else {
          turn.innerHTML = `Turno de ${escapeHtml(state.draft.current_captain)}. Entra con el link del capitan correspondiente para elegir.`;
        }
        renderTeam(1, 'team1List');
        renderTeam(2, 'team2List');
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

      loadState({ forceRender: true });
      pollingTimer = window.setInterval(() => loadState(), 2500);
    })();
  </script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
