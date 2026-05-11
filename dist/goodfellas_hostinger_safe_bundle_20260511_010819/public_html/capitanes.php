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
    $matchForDraft = $matchId > 0 ? repo_match_by_id($matchId) : null;
    $captainCount = $matchForDraft ? (int) ($matchForDraft['num_teams'] ?? 2) : 0;
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
        flash('error', 'La fecha debe tener entre 2 y 4 equipos para iniciar modo capitanes.');
        redirect('capitanes.php?match_id=' . $matchId);
    }
    if (count($participants) % $captainCount !== 0) {
        flash('error', 'La cantidad de convocados debe dividirse exacto entre los ' . $captainCount . ' equipos de la fecha.');
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
$selectedTeamCount = $selectedMatch ? max(2, min(4, (int) ($selectedMatch['num_teams'] ?? 2))) : 2;

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

<?php if (!$selectedMatch && !$isCaptainView): ?>
<section class="card mb-3.5">
  <h3>Elegí una fecha desde el panel</h3>
  <p class="small-muted">Modo capitanes se inicia desde la fecha correspondiente, para evitar elegir la misma fecha dos veces.</p>
  <a class="btn btn-primary" href="editar_partidos.php">Volver a fechas</a>
</section>
<?php endif; ?>

<?php if ($selectedMatch && !$draft && !$hasGeneratedTeams && !$isCaptainView): ?>
  <section class="card">
    <h3><?= h((string) ($selectedMatch['title'] ?: ('Fecha #' . $selectedMatch['id']))) ?></h3>
    <p class="small-muted">La fecha esta configurada para <?= h((string) $selectedTeamCount) ?> equipos, por eso se eligen <?= h((string) $selectedTeamCount) ?> capitanes.</p>
    <form method="post" class="form-grid">
      <input type="hidden" name="action" value="start_draft">
      <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
      <input type="hidden" name="captain_count" value="<?= h((string) $selectedTeamCount) ?>">
      <?php for ($teamNumber = 1; $teamNumber <= $selectedTeamCount; $teamNumber++): ?>
      <div class="form-row">
        <label>Capitan equipo <?= $teamNumber ?></label>
        <select name="captain<?= $teamNumber ?>" required>
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

  <script src="assets/capitanes.js"></script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
